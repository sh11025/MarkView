import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { FileHandle } from './fileSystem';

export interface FolderHandle {
  kind: 'directory';
  name: string;
  queryPermission?(opts: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(opts: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  isSameEntry?(other: FolderHandle): Promise<boolean>;
  values?(): AsyncIterable<any>;
  getFileHandle?(name: string): Promise<any>;
  getDirectoryHandle?(name: string): Promise<any>;
}

export type StoredHandle = FileHandle | FolderHandle;

export interface StoredDoc {
  id: string;
  name: string;
  content: string;
  /** 마지막 편집 시각 */
  updatedAt: number;
  /** 마지막으로 디스크 파일에 저장한 시각 (한 번도 없으면 0) */
  savedAt: number;
  handleId: string | null;
  /** 디스크 파일을 마지막으로 읽거나 쓴 시점의 lastModified (연결 파일 없으면 0) */
  diskModified?: number;
  /** 작업 폴더 기준 상대 경로 (예: "docs/guide.md"). 폴더에서 연 파일에만 존재 */
  folderPath?: string;
  /** 작업 폴더 이름 (예: "my-project"). (sourceFolder, folderPath) 중복 제거용 */
  sourceFolder?: string;
}

export interface StoredAttachment {
  id: string;
  name: string;
  blob: Blob;
  createdAt: number;
}

export interface ConnectedFolder {
  handleId: string;
  name: string;
}

export interface MarkviewDB extends DBSchema {
  documents: { key: string; value: StoredDoc };
  handles: { key: string; value: StoredHandle };
  attachments: { key: string; value: StoredAttachment };
  kv: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<MarkviewDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<MarkviewDB>> {
  dbPromise ??= openDB<MarkviewDB>('markview', 1, {
    upgrade(db) {
      db.createObjectStore('documents', { keyPath: 'id' });
      db.createObjectStore('handles');
      db.createObjectStore('attachments', { keyPath: 'id' });
      db.createObjectStore('kv');
    },
  });
  return dbPromise;
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await (await getDb()).get('kv', key)) as T | undefined;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await (await getDb()).put('kv', value, key);
}

export async function kvDelete(key: string): Promise<void> {
  await (await getDb()).delete('kv', key);
}

export async function storeFolderHandle(handle: FolderHandle): Promise<string> {
  // 가상 디렉터리 핸들(Firefox/Brave 읽기 전용)은 IndexedDB에 저장하지 않고 가상 ID 반환
  if ((handle as unknown as { isReadOnly?: boolean }).isReadOnly) {
    return newId('virtual-dir');
  }

  try {
    const db = await getDb();
    for (const key of await db.getAllKeys('handles')) {
      const existing = await db.get('handles', key);
      if (existing && existing.kind === 'directory' && (await existing.isSameEntry?.(handle))) {
        return key;
      }
    }
    const id = newId('dir');
    await db.put('handles', handle, id);
    return id;
  } catch (err) {
    console.warn('폴더 핸들 IndexedDB 저장 실패, 가상 ID로 대체:', err);
    return newId('virtual-dir');
  }
}

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}
