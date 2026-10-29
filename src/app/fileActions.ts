/** 메뉴·단축키에서 부르는 파일 관련 동작. UI 알림까지 여기서 처리한다. */
import { getActiveDoc, isDirty, useDocuments } from '../stores/documents';
import { toast, useUi } from '../stores/ui';
import { downloadText, getHandleFile, openFiles, readDroppedItems, readHandle, saveToDisk, type FileHandle } from '../storage/fileSystem';
import { forgetDocument } from '../editor/editorRegistry';
import { usePositions } from '../stores/positions';
import { recordCurrentPosition } from './positionTracker';
import { pickDirectory } from '../storage/folder';
import { useFolder } from '../stores/folder';
import type { FileEntry } from '../features/folder/types';
import {
  isBraveBrowser,
  canUseNativeFolderPicker,
  copyBraveFlagUrl,
  BRAVE_GUIDE_MESSAGE,
  READONLY_FOLDER_NOTICE,
} from '../features/folder/browserCompat';
import { createVirtualDirectoryHandle } from '../features/folder/virtualDirectory';

function reportError(action: string, err: unknown): void {
  console.error(err);
  useUi.getState().pushToast({ text: `${action} 중 오류가 발생했습니다: ${(err as Error)?.message ?? err}`, kind: 'error' });
}

export function newDocument(): void {
  recordCurrentPosition();
  useDocuments.getState().createDoc();
}

export async function openFromDisk(): Promise<void> {
  try {
    const files = await openFiles();
    useDocuments.getState().addOpenedFiles(files);
    if (files.length > 0) toast(`${files.length}개 파일을 열었습니다.`, 'success');
  } catch (err) {
    reportError('파일 열기', err);
  }
}

export async function openFolderFromDisk(): Promise<void> {
  try {
    const isBrave = await isBraveBrowser();
    const hasNative = canUseNativeFolderPicker();

    // Brave 브라우저에서 네이티브 API가 비활성화되어 있는 경우 안내 토스트 표시
    if (isBrave && !hasNative) {
      useUi.getState().pushToast({
        text: BRAVE_GUIDE_MESSAGE,
        kind: 'info',
        sticky: true,
        action: {
          label: '주소 복사',
          run: async () => {
            const copied = await copyBraveFlagUrl();
            if (copied) toast('주소를 복사했습니다.', 'success');
          },
        },
      });
    }

    const dirHandle = await pickDirectory();
    if (!dirHandle) return;

    await useFolder.getState().setFolderHandle(dirHandle);

    // 읽기 전용 가상 핸들(Firefox 등)인 경우 저장 방식 안내
    if ((dirHandle as unknown as { isReadOnly?: boolean }).isReadOnly) {
      toast(READONLY_FOLDER_NOTICE, 'info');
    }
    toast(`'${dirHandle.name}' 폴더를 열었습니다.`, 'success');
  } catch (err) {
    reportError('폴더 열기', err);
  }
}

export async function openFileFromFolder(entry: FileEntry): Promise<void> {
  try {
    recordCurrentPosition();
    const folderState = useFolder.getState();
    const sourceFolder = folderState.folder?.name || folderState.handle?.name;
    const opened = await readHandle(entry.handle as FileHandle, entry.path, sourceFolder);
    useDocuments.getState().addOpenedFiles([opened]);
  } catch (err) {
    reportError('파일 열기', err);
  }
}

async function collectFilesFromEntry(entry: any, pathPrefix = ''): Promise<File[]> {
  const files: File[] = [];
  if (entry.isFile) {
    await new Promise<void>((resolve) => {
      entry.file((file: File) => {
        const relPath = pathPrefix ? `${pathPrefix}/${file.name}` : file.name;
        Object.defineProperty(file, 'relativePath', { value: relPath, writable: false });
        files.push(file);
        resolve();
      }, () => resolve());
    });
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    const readBatch = (): Promise<any[]> =>
      new Promise((resolve) => {
        reader.readEntries((entries: any[]) => resolve(entries), () => resolve([]));
      });

    let batch = await readBatch();
    while (batch.length > 0) {
      for (const child of batch) {
        const subPrefix = pathPrefix ? `${pathPrefix}/${child.name}` : `${entry.name}/${child.name}`;
        const subFiles = await collectFilesFromEntry(child, subPrefix);
        files.push(...subFiles);
      }
      batch = await readBatch();
    }
  }
  return files;
}

export async function openDropped(items: DataTransferItemList): Promise<void> {
  try {
    // 1. 드롭된 항목 중 디렉터리가 있는지 검사
    for (const item of [...items]) {
      const getHandle = (item as unknown as { getAsFileSystemHandle?: () => Promise<any> }).getAsFileSystemHandle;
      if (getHandle) {
        try {
          const handle = await getHandle.call(item);
          if (handle && handle.kind === 'directory') {
            await useFolder.getState().setFolderHandle(handle);
            toast(`'${handle.name}' 폴더를 열었습니다.`, 'success');
            return;
          }
        } catch {
          // ignore fallback
        }
      }

      const entry = (item as unknown as { webkitGetAsEntry?: () => any }).webkitGetAsEntry?.();
      if (entry && entry.isDirectory) {
        const files = await collectFilesFromEntry(entry);
        if (files.length > 0) {
          const virtualHandle = createVirtualDirectoryHandle(files, entry.name);
          await useFolder.getState().setFolderHandle(virtualHandle);
          toast(READONLY_FOLDER_NOTICE, 'info');
          toast(`'${virtualHandle.name}' 폴더를 열었습니다.`, 'success');
          return;
        }
      }
    }

    // 2. 단일/복수 파일 드롭 처리
    const files = await readDroppedItems(items);
    useDocuments.getState().addOpenedFiles(files);
    if (files.length > 0) toast(`${files.length}개 파일을 열었습니다.`, 'success');
  } catch (err) {
    reportError('파일 열기', err);
  }
}

export async function saveActive(saveAs = false): Promise<void> {
  const doc = getActiveDoc();
  if (!doc) return;

  // 연결된 파일이 있는 경우 저장 직전 디스크 변경 여부 보호
  if (!saveAs && doc.handleId) {
    const info = await getHandleFile(doc.handleId);
    if (info && doc.diskModified && info.file.lastModified > doc.diskModified) {
      const ok = window.confirm(
        `'${doc.name}'이 바깥에서 바뀌었습니다. 저장하면 그 수정이 사라집니다. 그래도 저장할까요?`,
      );
      if (!ok) return;
    }
  }

  try {
    const result = await saveToDisk(doc.content, doc.name, doc.handleId, saveAs);
    if (result.kind === 'saved') {
      useDocuments.getState().markSaved(doc.id, {
        handleId: result.handleId,
        name: result.name,
        diskModified: result.diskModified,
      });
      toast(`'${result.name}'에 저장했습니다.`, 'success');
    } else if (result.kind === 'downloaded') {
      useDocuments.getState().markSaved(doc.id, { handleId: null, diskModified: 0 });
      // 폴더 파일이나 읽기 전용 환경인 경우 한국어 안내 제공
      if (doc.folderPath && (!doc.handleId || (useFolder.getState().handle as unknown as { isReadOnly?: boolean })?.isReadOnly)) {
        toast(READONLY_FOLDER_NOTICE, 'info');
      } else {
        toast(`'${doc.name}'을(를) 다운로드했습니다.`, 'success');
      }
    }
  } catch (err) {
    reportError('저장', err);
  }
}

export function closeDocument(id: string): void {
  const doc = useDocuments.getState().docs[id];
  if (!doc) return;
  if (isDirty(doc) && doc.content.trim() !== '' && !window.confirm(`'${doc.name}'의 변경 내용을 파일로 저장하지 않았습니다.\n닫으면 이 내용은 사라집니다. 닫을까요?`)) {
    return;
  }
  forgetDocument(id);
  usePositions.getState().remove(id);
  useDocuments.getState().close(id);
}

export function downloadMarkdown(): void {
  const doc = getActiveDoc();
  if (doc) downloadText(doc.content, doc.name, 'text/markdown;charset=utf-8');
}

export async function exportHtml(theme: 'light' | 'dark'): Promise<void> {
  const doc = getActiveDoc();
  if (!doc) return;
  try {
    toast('HTML 파일을 만드는 중…');
    const title = doc.name.replace(/\.(md|markdown|txt)$/i, '');
    const folderState = useFolder.getState();
    const folderContext = {
      folderPath: doc.folderPath,
      folderHandle: folderState.needPermission ? null : folderState.handle,
    };
    const { buildStandaloneHtml } = await import('../features/export/exportHtml');
    const html = await buildStandaloneHtml(doc.content, title, theme, folderContext);
    downloadText(html, `${title}.html`, 'text/html;charset=utf-8');
    toast('HTML 파일로 내보냈습니다.', 'success');
  } catch (err) {
    reportError('HTML 내보내기', err);
  }
}

export function printDocument(): void {
  window.print();
}

export async function downloadFullBackup(): Promise<void> {
  try {
    toast('전체 백업 파일을 생성하는 중…');
    const { readBackupSourceFromStores, triggerBackupDownload } = await import('../storage/backupStorage');
    const { backup, missingAttachmentCount } = await readBackupSourceFromStores();
    const downloaded = await triggerBackupDownload(backup);
    if (downloaded) {
      if (missingAttachmentCount > 0) {
        toast(`이미지 ${missingAttachmentCount}개는 이 환경에서 읽을 수 없어 백업에 포함하지 못했습니다.`, 'info');
      } else {
        toast('전체 백업 파일을 내려받았습니다.', 'success');
      }
    }
  } catch (err) {
    reportError('전체 백업 내려받기', err);
  }
}
