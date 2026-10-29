import type { FolderEntry } from './types';

/**
 * 폴더 항목을 정렬한다.
 * 1. 폴더가 파일보다 먼저 온다.
 * 2. 이름순(한글/숫자 자연 정렬: "2장.md" < "10장.md", "가.md" 등).
 * 3. 하위 폴더의 children도 재귀적으로 정렬한다.
 */
export function sortFolderEntries(entries: FolderEntry[]): FolderEntry[] {
  const sorted = [...entries].sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name, 'ko', { numeric: true });
  });

  return sorted.map((entry) => {
    if (entry.kind === 'directory') {
      return {
        ...entry,
        children: sortFolderEntries(entry.children),
      };
    }
    return entry;
  });
}
