import { useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, Search, X } from 'lucide-react';
import { formatMatchCount } from '../features/search/previewSearch';

export interface PreviewSearchBarProps {
  query: string;
  activeIndex: number;
  totalCount: number;
  focusTick: number;
  onChangeQuery: (query: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export function PreviewSearchBar({
  query,
  activeIndex,
  totalCount,
  focusTick,
  onChangeQuery,
  onNext,
  onPrev,
  onClose,
}: PreviewSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusTick]);

  return (
    <div
      role="search"
      aria-label="미리보기 문서 내 검색"
      className="no-print sticky top-2 z-30 ml-auto mr-4 flex w-fit max-w-[calc(100%-2rem)] items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text)] shadow-lg"
    >
      <Search className="size-3.5 shrink-0 text-[var(--muted)]" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onChangeQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onClose();
            return;
          }
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (e.shiftKey) onPrev();
            else onNext();
          }
        }}
        placeholder="문서 내 검색…"
        aria-label="미리보기 검색어 입력"
        className="w-36 sm:w-48 bg-transparent px-1 py-0.5 text-xs text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none"
      />
      <span
        role="status"
        aria-label="검색 결과 개수"
        aria-live="polite"
        className="min-w-12 px-1 text-center font-mono text-[11px] tabular-nums text-[var(--muted)]"
      >
        {query.length > 0 ? formatMatchCount(activeIndex, totalCount) : '0 / 0'}
      </span>
      <button
        type="button"
        aria-label="이전 검색 결과"
        title="이전 검색 결과 (Shift+Enter)"
        disabled={totalCount === 0}
        onClick={onPrev}
        className="flex size-6 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-40"
      >
        <ChevronUp className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label="다음 검색 결과"
        title="다음 검색 결과 (Enter)"
        disabled={totalCount === 0}
        onClick={onNext}
        className="flex size-6 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-40"
      >
        <ChevronDown className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label="검색 닫기"
        title="검색 닫기 (Esc)"
        onClick={onClose}
        className="flex size-6 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
