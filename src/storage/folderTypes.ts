export interface FileHandleLike {
  kind: 'file';
  name: string;
  isReadOnly?: boolean;
  getFile(): Promise<File>;
  createWritable?(): Promise<{ write(data: string | Blob): Promise<void>; close(): Promise<void> }>;
  queryPermission?(opts: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(opts: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  isSameEntry?(other: FileHandleLike): Promise<boolean>;
}

export interface DirectoryHandleLike {
  kind: 'directory';
  name: string;
  isReadOnly?: boolean;
  values(): AsyncIterable<DirectoryHandleLike | FileHandleLike>;
  getFileHandle?(name: string): Promise<FileHandleLike>;
  getDirectoryHandle?(name: string): Promise<DirectoryHandleLike>;
  queryPermission?(opts: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(opts: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  isSameEntry?(other: DirectoryHandleLike): Promise<boolean>;
}
