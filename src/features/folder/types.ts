import type { FileHandleLike, DirectoryHandleLike } from '../../storage/folderTypes';

export interface FileEntry {
  kind: 'file';
  name: string;
  path: string; // 예: "docs/guide.md"
  handle: FileHandleLike;
}

export interface DirectoryEntry {
  kind: 'directory';
  name: string;
  path: string; // 예: "docs"
  children: FolderEntry[];
  handle?: DirectoryHandleLike;
}

export type FolderEntry = FileEntry | DirectoryEntry;
