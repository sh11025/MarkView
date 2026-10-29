/**
 * 미리보기 문서 내 검색 순수 로직 및 CSS Custom Highlight API 연동.
 * 렌더된 .markdown-body의 HTML 구조를 전혀 변형하지 않고 Range와 CSS.highlights만 사용한다.
 */

export interface TextMatchOffset {
  start: number;
  end: number;
}

const EXCLUDED_SELECTOR =
  '.katex, .math-block, .mermaid-wrap, .mermaid-block, .code-copy, .mermaid-edit, .checklist-progress, .img-missing';

/**
 * 주어진 문자열에서 검색어(대소문자 무시, 한글 부분 일치)가 나타나는 모든 [start, end) 오프셋을 반환한다.
 */
export function findTextMatches(text: string, query: string): TextMatchOffset[] {
  if (!query || !text) return [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const qLen = lowerQuery.length;
  if (qLen === 0) return [];

  const matches: TextMatchOffset[] = [];
  let pos = 0;
  while (pos <= lowerText.length - qLen) {
    const idx = lowerText.indexOf(lowerQuery, pos);
    if (idx === -1) break;
    matches.push({ start: idx, end: idx + qLen });
    pos = idx + qLen;
  }
  return matches;
}

/**
 * 다음/이전 이동 시 순환 인덱스를 계산한다 (0-based).
 */
export function stepMatchIndex(current: number, total: number, delta: 1 | -1): number {
  if (total <= 0) return 0;
  return ((current + delta) % total + total) % total;
}

/**
 * 검색 결과 개수 표시 문자열("3 / 12" 또는 "0 / 0")을 생성한다.
 */
export function formatMatchCount(activeIndex: number, total: number): string {
  if (total <= 0) return '0 / 0';
  const clamped = Math.min(Math.max(0, activeIndex), total - 1);
  return `${clamped + 1} / ${total}`;
}

/**
 * 미리보기 본문(.markdown-body) 내부에서 검색어와 일치하는 모든 DOM Range를 수집한다.
 * 코드블록(pre/code)과 표(table) 내부 텍스트는 포함하고, 수식(KaTeX)·다이어그램(Mermaid)·조작 버튼은 제외한다.
 */
export function collectPreviewSearchRanges(root: HTMLElement, query: string): Range[] {
  if (!query) return [];

  const ranges: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest(EXCLUDED_SELECTOR)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let currentNode = walker.nextNode();
  while (currentNode) {
    const text = currentNode.nodeValue ?? '';
    if (text.length > 0) {
      const offsets = findTextMatches(text, query);
      for (const { start, end } of offsets) {
        try {
          const range = document.createRange();
          range.setStart(currentNode, start);
          range.setEnd(currentNode, end);
          ranges.push(range);
        } catch {
          // 텍스트 노드가 변경된 경우 무시
        }
      }
    }
    currentNode = walker.nextNode();
  }

  return ranges;
}

type HighlightRegistryLike = {
  set(name: string, highlight: unknown): void;
  delete(name: string): void;
};

type HighlightConstructorLike = new (...ranges: Range[]) => unknown;

function getCssHighlights(): { registry: HighlightRegistryLike; HighlightCtor: HighlightConstructorLike } | null {
  const g = globalThis as unknown as {
    CSS?: { highlights?: HighlightRegistryLike };
    Highlight?: HighlightConstructorLike;
  };
  if (g.CSS?.highlights && typeof g.Highlight === 'function') {
    return { registry: g.CSS.highlights, HighlightCtor: g.Highlight };
  }
  return null;
}

/**
 * CSS Custom Highlight API를 사용해 검색 결과 Range들을 강조 표시한다.
 * DOM을 전혀 수정하지 않으므로 원문이나 HTML 내보내기에 영향을 주지 않는다.
 */
export function applySearchHighlights(ranges: Range[], activeIndex: number): void {
  const api = getCssHighlights();
  if (!api) return;

  const { registry, HighlightCtor } = api;
  if (ranges.length === 0) {
    registry.delete('markview-search');
    registry.delete('markview-search-current');
    return;
  }

  try {
    const allHighlight = new HighlightCtor(...ranges);
    registry.set('markview-search', allHighlight);

    const target = ranges[Math.min(Math.max(0, activeIndex), ranges.length - 1)];
    if (target) {
      const currentHighlight = new HighlightCtor(target);
      registry.set('markview-search-current', currentHighlight);
    } else {
      registry.delete('markview-search-current');
    }
  } catch {
    // 지원하지 않는 환경에서는 조용히 무시
  }
}

/**
 * CSS Custom Highlight API에 등록된 검색 강조를 모두 지운다.
 */
export function clearSearchHighlights(): void {
  const api = getCssHighlights();
  if (!api) return;
  api.registry.delete('markview-search');
  api.registry.delete('markview-search-current');
}

/**
 * 지정된 Range가 스크롤 컨테이너(.preview-scroll)의 화면 중앙에 오도록 스크롤한다.
 */
export function scrollRangeToCenter(scroller: HTMLElement, range: Range): void {
  let rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    const parentEl = range.startContainer.parentElement;
    if (parentEl) rect = parentEl.getBoundingClientRect();
  }
  if (rect.width === 0 && rect.height === 0) return;

  const scrollerRect = scroller.getBoundingClientRect();
  const relativeTop = rect.top - scrollerRect.top + scroller.scrollTop;
  const targetTop = relativeTop - scroller.clientHeight / 2 + rect.height / 2;
  scroller.scrollTo({ top: Math.max(0, targetTop) });
}
