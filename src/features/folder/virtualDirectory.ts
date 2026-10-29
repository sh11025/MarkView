/**
 * @file virtualDirectory.ts
 * Firefox, Brave 등 File System Access API(showDirectoryPicker)가 지원되지 않거나
 * 비활성화된 브라우저에서 <input type="file" webkitdirectory> 또는 드래그 앤 드롭으로
 * 선택한 파일 목록을 DirectoryHandleLike / FileHandleLike 인터페이스로 감싸는 가상 핸들 구현체입니다.
 */

import type { DirectoryHandleLike, FileHandleLike } from '../../storage/folderTypes';

interface VirtualNode {
  name: string;
  files: Map<string, File>;
  subdirs: Map<string, VirtualNode>;
}

function createNode(name: string): VirtualNode {
  return {
    name,
    files: new Map(),
    subdirs: new Map(),
  };
}

/**
 * File 배열로부터 계층적 가상 디렉터리 핸들을 생성합니다.
 * @param files <input webkitdirectory> 또는 드롭 이벤트에서 수집된 File 객체 목록
 * @param overrideFolderName 루트 폴더 이름 강제 지정 (선택)
 */
export function createVirtualDirectoryHandle(
  files: File[] | FileList,
  overrideFolderName?: string,
): DirectoryHandleLike {
  const fileArray = Array.from(files);

  // 1. 루트 폴더 이름 결정
  let rootName = overrideFolderName?.trim() || '';
  if (!rootName && fileArray.length > 0) {
    const firstRel = (fileArray[0].webkitRelativePath || (fileArray[0] as unknown as { relativePath?: string }).relativePath || '').replace(/\\+/g, '/');
    const firstSeg = firstRel.split('/')[0];
    if (firstSeg) {
      rootName = firstSeg;
    }
  }
  if (!rootName) {
    rootName = 'folder';
  }

  const rootNode = createNode(rootName);

  // 2. 파일 목록을 계층 트리로 구축
  for (const file of fileArray) {
    const rawRel = (file.webkitRelativePath || (file as unknown as { relativePath?: string }).relativePath || file.name).replace(/\\+/g, '/').trim();
    const parts = rawRel.split('/').filter(Boolean);
    if (parts.length === 0) continue;

    // 만약 첫 세그먼트가 루트 폴더 이름과 일치하면 제거
    if (parts.length > 1 && parts[0] === rootName) {
      parts.shift();
    }

    const fileName = parts.pop();
    if (!fileName) continue;

    // 경로 탈출 방어: 세그먼트에 '..'나 '.'가 포함되어 있으면 보안상 제외
    let hasInvalidSeg = false;
    for (const seg of [...parts, fileName]) {
      if (seg === '.' || seg === '..' || seg.includes('/') || seg.includes('\\')) {
        hasInvalidSeg = true;
        break;
      }
    }
    if (hasInvalidSeg) continue;

    // 하위 디렉터리 순회 및 생성
    let currentNode = rootNode;
    for (const dirName of parts) {
      let sub = currentNode.subdirs.get(dirName);
      if (!sub) {
        sub = createNode(dirName);
        currentNode.subdirs.set(dirName, sub);
      }
      currentNode = sub;
    }

    // 파일 등록
    currentNode.files.set(fileName, file);
  }

  return wrapDirectoryNode(rootNode);
}

function wrapFile(name: string, file: File): FileHandleLike {
  return {
    kind: 'file',
    name,
    isReadOnly: true,
    async getFile() {
      return file;
    },
    async queryPermission() {
      return 'granted';
    },
    async requestPermission() {
      return 'granted';
    },
    async isSameEntry(other: FileHandleLike) {
      return other === this || (other.kind === 'file' && other.name === name);
    },
  };
}

function wrapDirectoryNode(node: VirtualNode): DirectoryHandleLike {
  const dirHandle: DirectoryHandleLike = {
    kind: 'directory',
    name: node.name,
    isReadOnly: true,
    async *values() {
      // 1. 하위 디렉터리 방출
      for (const subdir of node.subdirs.values()) {
        yield wrapDirectoryNode(subdir);
      }
      // 2. 직속 파일 방출
      for (const [name, file] of node.files.entries()) {
        yield wrapFile(name, file);
      }
    },
    async getDirectoryHandle(name: string) {
      // 경로 탈출 방어: '..', '.', '/', '\' 방어
      if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\')) {
        const err = new Error(`유효하지 않은 디렉터리 이름: ${name}`);
        err.name = 'TypeMismatchError';
        throw err;
      }
      const subdir = node.subdirs.get(name);
      if (!subdir) {
        const err = new Error(`디렉터리를 찾을 수 없습니다: ${name}`);
        err.name = 'NotFoundError';
        throw err;
      }
      return wrapDirectoryNode(subdir);
    },
    async getFileHandle(name: string) {
      // 경로 탈출 방어: '..', '.', '/', '\' 방어
      if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\')) {
        const err = new Error(`유효하지 않은 파일 이름: ${name}`);
        err.name = 'TypeMismatchError';
        throw err;
      }
      const file = node.files.get(name);
      if (!file) {
        const err = new Error(`파일을 찾을 수 없습니다: ${name}`);
        err.name = 'NotFoundError';
        throw err;
      }
      return wrapFile(name, file);
    },
    async queryPermission() {
      return 'granted';
    },
    async requestPermission() {
      return 'granted';
    },
    async isSameEntry(other: DirectoryHandleLike) {
      return other === this || (other.kind === 'directory' && other.name === node.name);
    },
  };

  return dirHandle;
}
