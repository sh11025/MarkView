import type { TocItem } from '../../render/plugins/headings';
import type { TocMaxLevel } from '../../stores/settings';

export interface VisibleTocItem extends TocItem {
  /** 현재 깊이 필터 기준으로 하위 제목이 존재하는지 여부 */
  hasChildren: boolean;
  /** 현재 항목이 접혀 있는지 여부 */
  isCollapsed: boolean;
}

export interface FilterTocOptions {
  /** 최대 제목 깊이 (6: 전체, 2: H2까지, 3: H3까지) */
  maxLevel: TocMaxLevel;
  /** 검색어 (비어 있으면 전체, 대소문자 무시·한글 부분 일치) */
  query: string;
  /** 현재 문서 탭에서 접힌 제목 ID 목록 */
  collapsedIds: Iterable<string>;
}

/**
 * 목차 배열에 깊이 필터, 접기 상태, 검색어 필터를 적용하여 화면에 표시할 목차 항목 목록을 계산한다.
 */
export function filterTocItems(items: readonly TocItem[], options: FilterTocOptions): VisibleTocItem[] {
  const { maxLevel, query, collapsedIds } = options;
  const collapsedSet = collapsedIds instanceof Set ? collapsedIds : new Set(collapsedIds);

  // 1. 깊이 필터 적용
  const depthFiltered = items.filter((item) => item.level <= maxLevel);

  // 2. 검색어가 있으면 접기 상태와 무관하게 부분 일치(대소문자 무시, 한글 포함) 항목만 반환
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length > 0) {
    return depthFiltered
      .filter((item) => item.text.toLowerCase().includes(normalizedQuery))
      .map((item) => ({
        ...item,
        hasChildren: false,
        isCollapsed: false,
      }));
  }

  // 3. 각 항목의 하위 제목 존재 여부 계산 및 접기 상태 반영
  const result: VisibleTocItem[] = [];
  let hiddenUnderLevel: number | null = null;

  for (let i = 0; i < depthFiltered.length; i++) {
    const item = depthFiltered[i];

    if (hiddenUnderLevel !== null) {
      if (item.level > hiddenUnderLevel) {
        continue;
      }
      hiddenUnderLevel = null;
    }

    const nextItem = depthFiltered[i + 1];
    const hasChildren = Boolean(nextItem && nextItem.level > item.level);
    const isCollapsed = hasChildren && collapsedSet.has(item.id);

    result.push({
      ...item,
      hasChildren,
      isCollapsed,
    });

    if (isCollapsed) {
      hiddenUnderLevel = item.level;
    }
  }

  return result;
}
