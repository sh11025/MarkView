/**
 * 폴더 스캔 및 핸들 접근 API.
 * 브라우저 File System Access API(showDirectoryPicker)를 다룬다.
 * React를 import하지 않는다.
 */
import type { DirectoryHandleLike, FileHandleLike } from './folderTypes';
import type { FolderEntry, FileEntry, DirectoryEntry } from '../features/folder/types';
import { isMarkdownFileName } from './fileSystem';
import { joinPath } from '../features/folder/path';
import { pruneEmptyDirectories } from '../features/folder/prune';
import { sortFolderEntries } from '../features/folder/sort';
import { createVirtualDirectoryHandle } from '../features/folder/virtualDirectory';

export type { DirectoryHandleLike, FileHandleLike };

const IGNORED_NAMES = new Set(['node_modules', 'dist', 'build', '.git']);
const MAX_DEPTH = 8;
const MAX_FILES = 3000;

export interface ScanOptions {
  maxDepth?: number;
  maxFiles?: number;
}

export interface ScanResult {
  tree: FolderEntry[];
  truncated: boolean;
  totalFiles: number;
}

/**
 * 브라우저에서 폴더 열기 기능 가용 여부.
 * Chrome/Edge의 showDirectoryPicker 또는 Firefox/Brave의 webkitdirectory가 지원되므로
 * 브라우저 환경(window 존재)이면 항상 true입니다.
 */
export const canUseFolderPicker = typeof window !== 'undefined';

/**
 * 네이티브 File System Access API(showDirectoryPicker) 지원 여부
 */
export const canUseNativeFolderPicker =
  typeof window !== 'undefined' &&
  typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';

/**
 * 디렉토리 핸들을 재귀적으로 스캔하여 마크다운 파일 트리를 생성한다.
 * 최소 인터페이스(DirectoryHandleLike)를 받으므로 가짜 핸들로 단위 테스트가 가능하다.
 */
export async function scanDirectory(
  rootHandle: DirectoryHandleLike,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const maxDepth = options.maxDepth ?? MAX_DEPTH;
  const maxFiles = options.maxFiles ?? MAX_FILES;

  let totalFiles = 0;
  let truncated = false;

  async function scan(
    dirHandle: DirectoryHandleLike,
    currentPath: string,
    currentDepth: number,
  ): Promise<FolderEntry[]> {
    if (truncated) return [];
    if (currentDepth > maxDepth) return [];

    const entries: FolderEntry[] = [];

    try {
      for await (const entry of dirHandle.values()) {
        if (truncated) break;

        const name = entry.name;
        // '.'으로 시작하는 폴더/파일 및 무시 대상 제외
        if (name.startsWith('.') || IGNORED_NAMES.has(name)) {
          continue;
        }

        const entryPath = joinPath(currentPath, name);

        if (entry.kind === 'file') {
          if (!isMarkdownFileName(name)) continue;

          totalFiles++;
          if (totalFiles > maxFiles) {
            truncated = true;
            break;
          }

          entries.push({
            kind: 'file',
            name,
            path: entryPath,
            handle: entry,
          } satisfies FileEntry);
        } else if (entry.kind === 'directory') {
          if (currentDepth + 1 <= maxDepth) {
            const subEntries = await scan(entry, entryPath, currentDepth + 1);
            entries.push({
              kind: 'directory',
              name,
              path: entryPath,
              children: subEntries,
              handle: entry,
            } satisfies DirectoryEntry);
          }
        }
      }
    } catch (err) {
      console.warn(`폴더 스캔 중 건너뜀 (${currentPath || rootHandle.name}):`, err);
    }

    return entries;
  }

  const rawEntries = await scan(rootHandle, '', 1);
  const pruned = pruneEmptyDirectories(rawEntries);
  const sorted = sortFolderEntries(pruned);

  return {
    tree: sorted,
    truncated,
    totalFiles,
  };
}

/**
 * <input type="file" webkitdirectory>를 통해 폴더 내 파일들을 선택받아
 * 가상 디렉터리 핸들로 반환한다 (Firefox/Brave 등 File System Access API 미지원 환경용).
 */
export async function pickDirectoryViaInput(): Promise<DirectoryHandleLike | null> {
  if (typeof document === 'undefined') return null;

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.multiple = true;
    input.style.display = 'none';

    let settled = false;

    const cleanup = () => {
      window.removeEventListener('focus', onWindowFocus);
      input.remove();
    };

    const finish = (result: DirectoryHandleLike | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const onWindowFocus = () => {
      setTimeout(() => {
        if (!settled && (!input.files || input.files.length === 0)) {
          finish(null);
        }
      }, 600);
    };

    input.addEventListener('change', () => {
      if (input.files && input.files.length > 0) {
        const handle = createVirtualDirectoryHandle(input.files);
        finish(handle);
      } else {
        finish(null);
      }
    });

    input.addEventListener('cancel', () => {
      finish(null);
    });

    window.addEventListener('focus', onWindowFocus);
    document.body.appendChild(input);
    input.click();
  });
}

/** 브라우저 폴더 선택 창을 열어 FileSystemDirectoryHandle을 반환한다. 미지원 브라우저는 input webkitdirectory 가상 핸들로 반환. 취소 시 null */
export async function pickDirectory(): Promise<DirectoryHandleLike | null> {
  const picker = (window as unknown as { showDirectoryPicker?: () => Promise<DirectoryHandleLike> }).showDirectoryPicker;
  if (typeof picker === 'function') {
    try {
      return await picker();
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return null;
      throw err;
    }
  }

  // showDirectoryPicker가 없는 경우(Firefox 등) webkitdirectory 가상 핸들 폴백
  return await pickDirectoryViaInput();
}

/** 폴더 핸들의 읽기 권한을 확인한다 (팝업 없이 확인) */
export async function queryFolderPermission(handle: DirectoryHandleLike): Promise<PermissionState> {
  if (!handle.queryPermission) return 'granted';
  try {
    return await handle.queryPermission({ mode: 'read' });
  } catch {
    return 'prompt';
  }
}

/** 폴더 핸들의 읽기 권한을 사용자에게 요청한다 (클릭 시에만 호출) */
export async function requestFolderPermission(handle: DirectoryHandleLike): Promise<PermissionState> {
  if (!handle.requestPermission) return 'granted';
  try {
    return await handle.requestPermission({ mode: 'read' });
  } catch {
    return 'denied';
  }
}

/**
 * 상대 경로(예: "img/logo.png", "docs/sub/guide.md")를 따라가 해당 파일 핸들을 가져온다.
 * 경로에 '..'나 빈 세그먼트가 있으면 보안을 위해 즉시 null을 반환한다.
 */
export async function getFileHandleByPath(
  root: DirectoryHandleLike,
  path: string,
): Promise<FileHandleLike | null> {
  if (!path || typeof path !== 'string') return null;

  const normalized = path.replace(/\\+/g, '/').trim();
  const segments = normalized.split('/');

  // 방어: 세그먼트에 '..'나 '.' 또는 빈 문자열이 포함되어 있으면 읽지 않음
  for (const seg of segments) {
    if (!seg || seg === '.' || seg === '..') return null;
  }

  const fileName = segments.pop();
  if (!fileName) return null;

  let currentDir: DirectoryHandleLike = root;
  for (const dirName of segments) {
    if (!currentDir.getDirectoryHandle) return null;
    try {
      currentDir = await currentDir.getDirectoryHandle(dirName);
    } catch {
      return null;
    }
  }

  if (!currentDir.getFileHandle) return null;
  try {
    return await currentDir.getFileHandle(fileName);
  } catch {
    return null;
  }
}

/**
 * 상대 경로로 파일(File 객체)을 읽는다. 없거나 오류 시 null을 반환한다.
 */
export async function readFileByPath(
  root: DirectoryHandleLike,
  path: string,
): Promise<File | null> {
  const handle = await getFileHandleByPath(root, path);
  if (!handle) return null;
  try {
    return await handle.getFile();
  } catch {
    return null;
  }
}
