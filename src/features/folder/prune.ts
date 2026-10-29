import type { FolderEntry } from './types';

/**
 * 마크다운 파일이 하나도 없는 폴더(자식 파일도 없고 유효한 하위 폴더도 없는 폴더)를 트리에서 제거한다.
 */
export function pruneEmptyDirectories(entries: FolderEntry[]): FolderEntry[] {
  const result: FolderEntry[] = [];

  for (const entry of entries) {
    if (entry.kind === 'file') {
      result.push(entry);
    } else {
      const prunedChildren = pruneEmptyDirectories(entry.children);
      if (prunedChildren.length > 0) {
        result.push({
          ...entry,
          children: prunedChildren,
        });
      }
    }
  }

  return result;
}
