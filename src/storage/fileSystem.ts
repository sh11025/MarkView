/**
 * File System Access API (Chrome·Edge). TS 기본 타입에 없는 부분이 있어 필요한 만큼만 직접 정의한다.
 * 지원하지 않는 브라우저는 업로드(<input type=file>)와 다운로드로 대신한다.
 */
import { getDb, newId } from './db';

export interface FileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: string | Blob): Promise<void>; close(): Promise<void> }>;
  queryPermission?(opts: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(opts: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  isSameEntry?(other: FileHandle): Promise<boolean>;
}

interface PickerType {
  description: string;
  accept: Record<string, string[]>;
}

interface FsWindow {
  showOpenFilePicker?: (opts: { multiple?: boolean; types?: PickerType[] }) => Promise<FileHandle[]>;
  showSaveFilePicker?: (opts: { suggestedName?: string; types?: PickerType[] }) => Promise<FileHandle>;
}

const MARKDOWN_TYPES: PickerType[] = [
  { description: '마크다운', accept: { 'text/markdown': ['.md', '.markdown'], 'text/plain': ['.txt'] } },
];

const fsWindow = typeof window !== 'undefined' ? (window as unknown as FsWindow) : {};
export const canUseFileHandles = typeof fsWindow.showOpenFilePicker === 'function';

export interface OpenedFile {
  name: string;
  content: string;
  lastModified: number;
  handleId: string | null;
  /** 작업 폴더 기준 상대 경로 (예: "docs/guide.md") */
  folderPath?: string;
  /** 작업 폴더 이름 (예: "my-project") */
  sourceFolder?: string;
}

export function isMarkdownFileName(name: string): boolean {
  return /\.(md|markdown|txt)$/i.test(name);
}

export async function storeHandle(handle: FileHandle): Promise<string> {
  const db = await getDb();
  // 이미 저장된 같은 파일이면 그 id를 재사용
  for (const key of await db.getAllKeys('handles')) {
    const existing = await db.get('handles', key);
    if (existing && existing.kind === 'file' && (await existing.isSameEntry?.(handle))) return key;
  }
  const id = newId('h');
  await db.put('handles', handle, id);
  return id;
}

export async function readHandle(
  handle: FileHandle,
  folderPath?: string,
  sourceFolder?: string,
): Promise<OpenedFile> {
  const file = await handle.getFile();
  let handleId: string | null = null;
  const isReadOnly = (handle as unknown as { isReadOnly?: boolean }).isReadOnly;
  if (!isReadOnly && typeof handle.createWritable === 'function') {
    try {
      handleId = await storeHandle(handle);
    } catch {
      handleId = null;
    }
  }
  return {
    name: file.name,
    content: await file.text(),
    lastModified: file.lastModified,
    handleId,
    folderPath,
    sourceFolder,
  };
}

function pickWithInput(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.md,.markdown,.txt';
    input.onchange = () => resolve([...(input.files ?? [])]);
    input.click();
  });
}

/** 파일 선택 창을 열어 마크다운 파일들을 읽는다. 취소하면 빈 배열 */
export async function openFiles(): Promise<OpenedFile[]> {
  if (fsWindow.showOpenFilePicker) {
    try {
      const handles = await fsWindow.showOpenFilePicker({ multiple: true, types: MARKDOWN_TYPES });
      return Promise.all(handles.map((h) => readHandle(h)));
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return [];
      throw err;
    }
  }
  const files = await pickWithInput();
  return Promise.all(files.map(readPlainFile));
}

export async function readPlainFile(file: File): Promise<OpenedFile> {
  return { name: file.name, content: await file.text(), lastModified: file.lastModified, handleId: null };
}

/** 드롭된 항목 읽기. Chrome에서는 파일 핸들까지 얻어 이후 같은 파일에 저장할 수 있다. */
export async function readDroppedItems(items: DataTransferItemList): Promise<OpenedFile[]> {
  const jobs: Promise<OpenedFile>[] = [];
  for (const item of [...items]) {
    if (item.kind !== 'file') continue;
    const file = item.getAsFile();
    if (!file || !isMarkdownFileName(file.name)) continue;
    const getHandle = (item as unknown as { getAsFileSystemHandle?: () => Promise<FileHandle | null> })
      .getAsFileSystemHandle;
    jobs.push(
      getHandle
        ? getHandle.call(item).then((h) => (h?.kind === 'file' ? readHandle(h) : readPlainFile(file)))
        : readPlainFile(file),
    );
  }
  return Promise.all(jobs);
}

async function ensureWritePermission(handle: FileHandle): Promise<boolean> {
  if (!handle.queryPermission) return true;
  if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
  return (await handle.requestPermission?.({ mode: 'readwrite' })) === 'granted';
}

export type SaveResult =
  | { kind: 'saved'; handleId: string; name: string; diskModified: number }
  | { kind: 'downloaded' }
  | { kind: 'cancelled' };

/**
 * 저장된 파일 핸들에서 권한 팝업 없이 파일 정보를 가져온다.
 * 이미 권한이 'granted'인 경우에만 파일을 읽고, 아니면 null을 반환한다.
 */
export async function getHandleFile(handleId: string): Promise<{ file: File; handle: FileHandle } | null> {
  try {
    const db = await getDb();
    const handle = await db.get('handles', handleId);
    if (!handle || handle.kind !== 'file') return null;
    if (handle.queryPermission) {
      const perm = await handle.queryPermission({ mode: 'read' });
      if (perm !== 'granted') return null;
    }
    const file = await handle.getFile();
    return { file, handle };
  } catch (err) {
    console.warn(`파일 확인 중 오류 건너뜀 (${handleId}):`, err);
    return null;
  }
}

/**
 * 문서를 디스크에 저장한다.
 * 연결된 파일이 있으면 그 파일에, 없거나 `saveAs`면 저장 위치를 묻고, API가 없으면 다운로드한다.
 */
export async function saveToDisk(
  content: string,
  name: string,
  handleId: string | null,
  saveAs = false,
): Promise<SaveResult> {
  const db = await getDb();
  const rawHandle = handleId && !saveAs ? await db.get('handles', handleId) : undefined;
  let handle: FileHandle | undefined = rawHandle && rawHandle.kind === 'file' ? rawHandle : undefined;

  if (!handle) {
    if (!fsWindow.showSaveFilePicker) {
      downloadText(content, name, 'text/markdown;charset=utf-8');
      return { kind: 'downloaded' };
    }
    try {
      handle = await fsWindow.showSaveFilePicker({ suggestedName: name, types: MARKDOWN_TYPES });
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return { kind: 'cancelled' };
      throw err;
    }
  }

  if (!(await ensureWritePermission(handle))) return { kind: 'cancelled' };
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
  const file = await handle.getFile();
  return { kind: 'saved', handleId: await storeHandle(handle), name: handle.name, diskModified: file.lastModified };
}

export function downloadText(content: string | Blob, filename: string, mime: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
