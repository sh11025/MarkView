import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Sigma, X } from 'lucide-react';
import katex from 'katex';
import {
  MATH_CATEGORIES,
  MATH_TEMPLATES,
  type MathTemplate,
} from '../constants/mathTemplates';
import { sanitizeHtml } from '../render/sanitize';
import { formatMathInsertion, insertSnippetAtCursor } from '../features/gallery/insertSnippet';
import { getEditorView } from '../editor/editorRegistry';
import { useUi } from '../stores/ui';

function renderKatexPreview(latex: string, isBlock: boolean): string {
  try {
    return sanitizeHtml(
      katex.renderToString(latex, {
        displayMode: isBlock,
        throwOnError: false,
      }),
    );
  } catch {
    return '';
  }
}

export function MathGallery() {
  const open = useUi((s) => s.mathGalleryOpen);
  const close = useUi((s) => s.closeMathGallery);

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { categories, categoryCounts } = useMemo(() => {
    const counts: Record<string, number> = {
      전체: MATH_TEMPLATES.length,
    };
    for (const cat of MATH_CATEGORIES) {
      counts[cat] = 0;
    }
    for (const t of MATH_TEMPLATES) {
      counts[t.category] = (counts[t.category] || 0) + 1;
    }
    return {
      categories: ['전체', ...MATH_CATEGORIES],
      categoryCounts: counts,
    };
  }, []);

  const filteredTemplates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MATH_TEMPLATES.filter((t) => {
      const matchCat = selectedCategory === '전체' || t.category === selectedCategory;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.latex.toLowerCase().includes(q)
      );
    });
  }, [query, selectedCategory]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  if (!open) return null;

  const handleInsert = (template: MathTemplate) => {
    const view = getEditorView();
    if (view) {
      const snippet = formatMathInsertion(template.latex, template.isBlock);
      insertSnippetAtCursor(view, snippet, template.isBlock);
    }
    close();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="수식 템플릿 갤러리"
      data-testid="math-gallery-modal"
    >
      <div className="flex h-[90dvh] w-full max-w-5xl flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        {/* 헤더 */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Sigma className="size-5 text-[var(--accent)]" />
            <h2 className="text-base font-bold text-[var(--text)]">수식 삽입 갤러리</h2>
            <span className="hidden text-xs text-[var(--muted)] sm:inline">
              총 {MATH_TEMPLATES.length}개의 수식 템플릿 · 카드를 누르면 현재 커서 위치에 삽입됩니다
            </span>
          </div>
          <button
            type="button"
            title="닫기"
            aria-label="닫기"
            onClick={close}
            className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* 검색 및 카테고리 필터 */}
        <div className="flex shrink-0 flex-col gap-2.5 border-b border-[var(--border)] px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              ref={searchInputRef}
              autoFocus
              type="text"
              placeholder="수식 검색 (이름, 설명, LaTeX 문법, 분류)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  close();
                }
              }}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] py-1.5 pl-9 pr-8 text-sm text-[var(--text)] placeholder-[var(--muted)] outline-hidden focus:border-[var(--accent)]"
              data-testid="math-search-input"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)]"
                title="검색어 지우기"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5" data-testid="math-categories">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              const count = categoryCounts[cat] ?? 0;
              return (
                <button
                  key={cat}
                  type="button"
                  data-category={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--surface-2)] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]'
                  }`}
                >
                  <span>{cat}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-[var(--surface)] text-[var(--muted)]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 수식 카드 그리드 */}
        <div
          className="min-h-0 flex-1 overflow-y-auto bg-[var(--bg)] p-4"
          data-testid="math-card-list"
        >
          {filteredTemplates.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-[var(--muted)]">
              검색 결과가 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filteredTemplates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  data-math-id={t.id}
                  onClick={() => handleInsert(t)}
                  className="group flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 text-left shadow-2xs transition-all hover:border-[var(--accent)] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-[var(--text)] group-hover:text-[var(--accent)]">
                        {t.name}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                          {t.category}
                        </span>
                        <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted)]">
                          {t.isBlock ? '$$' : '$'}
                        </span>
                      </div>
                    </div>

                    <div
                      className="math-card-preview my-2.5 flex min-h-[64px] items-center justify-center overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--doc-bg)] px-3 py-2 text-[var(--doc-text)]"
                      dangerouslySetInnerHTML={{
                        __html: renderKatexPreview(t.latex, t.isBlock),
                      }}
                    />

                    <p className="text-xs text-[var(--muted)]">{t.description}</p>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between border-t border-[var(--border)] pt-2">
                    <code className="max-w-[78%] truncate font-mono text-[11px] text-[var(--muted)]">
                      {t.latex}
                    </code>
                    <span className="text-xs font-semibold text-[var(--accent)]">삽입</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MathGallery;
