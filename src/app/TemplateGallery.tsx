import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Check, LayoutTemplate } from 'lucide-react';
import { TEMPLATES, TEMPLATE_CATEGORIES, type DocumentTemplate } from '../constants/templates';
import { applyTemplate } from '../features/templates/applyTemplate';
import { recordCurrentPosition } from './positionTracker';
import { useDocuments } from '../stores/documents';
import { useUi } from '../stores/ui';
import { useResolvedTheme } from './theme';
import { renderMarkdown } from '../render/markdown';
import { sanitizeHtml } from '../render/sanitize';
import { renderMermaidBlocks } from '../render/mermaid';

export function TemplateGallery() {
  const open = useUi((s) => s.templateGalleryOpen);
  const close = useUi((s) => s.closeTemplateGallery);
  const theme = useResolvedTheme();

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [selectedId, setSelectedId] = useState<string | null>(TEMPLATES[0]?.id ?? null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // 분류 목록 및 각 분류별 템플릿 개수 집계
  const { categories, categoryCounts } = useMemo(() => {
    const counts: Record<string, number> = {
      전체: TEMPLATES.length,
    };
    for (const cat of TEMPLATE_CATEGORIES) {
      counts[cat] = 0;
    }
    for (const t of TEMPLATES) {
      counts[t.category] = (counts[t.category] || 0) + 1;
    }
    return {
      categories: ['전체', ...TEMPLATE_CATEGORIES],
      categoryCounts: counts,
    };
  }, []);

  // 검색어 및 카테고리 필터링
  const filteredTemplates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TEMPLATES.filter((t) => {
      const matchCategory = selectedCategory === '전체' || t.category === selectedCategory;
      if (!matchCategory) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [query, selectedCategory]);

  // 필터링 결과에 따라 선택 항목 자동 보정
  useEffect(() => {
    if (filteredTemplates.length > 0) {
      if (!filteredTemplates.some((t) => t.id === selectedId)) {
        setSelectedId(filteredTemplates[0].id);
      }
    } else {
      setSelectedId(null);
    }
  }, [filteredTemplates, selectedId]);

  const selectedTemplate = useMemo(
    () => TEMPLATES.find((t) => t.id === selectedId) ?? null,
    [selectedId],
  );

  // 미리보기 마크다운 HTML 렌더링
  const previewHtml = useMemo(() => {
    if (!selectedTemplate) return '';
    const content = applyTemplate(selectedTemplate.content);
    return sanitizeHtml(renderMarkdown(content).html);
  }, [selectedTemplate]);

  // 미리보기 내 Mermaid 다이어그램 렌더링
  useEffect(() => {
    if (previewRef.current && selectedTemplate) {
      void renderMermaidBlocks(previewRef.current, theme);
    }
  }, [previewHtml, theme, selectedTemplate]);

  // 모달 열림/닫힘 시 포커스 제어 및 스크롤 고정
  useEffect(() => {
    if (open) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    } else {
      document.body.style.overflow = '';
      previousActiveElementRef.current?.focus();
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, close]);

  if (!open) return null;

  const handleApply = (template: DocumentTemplate) => {
    recordCurrentPosition();
    const content = applyTemplate(template.content);
    useDocuments.getState().createDoc({
      name: `${template.name}.md`,
      content,
    });
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
      aria-label="문서 템플릿 갤러리"
      data-testid="template-gallery-modal"
    >
      <div className="flex h-[94dvh] w-full max-w-5xl flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        {/* 상단 헤더 */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="size-5 text-[var(--accent)]" />
            <h2 className="text-base font-bold text-[var(--text)]">문서 템플릿</h2>
            <span className="hidden text-xs text-[var(--muted)] sm:inline">
              총 {TEMPLATES.length}개의 표준 템플릿
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

        {/* 검색 입력창 */}
        <div className="border-b border-[var(--border)] px-4 py-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              ref={searchInputRef}
              autoFocus
              type="text"
              placeholder="템플릿 검색 (이름, 설명, 카테고리)..."
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
              data-testid="template-search-input"
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
        </div>

        {/* 메인 콘텐츠 영역: 분류 / 목록 / 미리보기 */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* 1. 분류 목록 */}
          <div
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--border)] p-2 md:w-44 md:flex-col md:border-b-0 md:border-r md:p-3"
            data-testid="template-categories"
          >
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              const count = categoryCounts[cat] ?? 0;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  data-category={cat}
                  className={`flex items-center justify-between gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]'
                  }`}
                >
                  <span>{cat}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-[var(--surface-2)] text-[var(--muted)]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 2. 템플릿 카드 목록 */}
          <div
            className="flex max-h-[220px] min-h-[140px] flex-1 flex-col overflow-y-auto border-b border-[var(--border)] p-2 md:max-h-none md:max-w-xs md:border-b-0 md:border-r md:p-3"
            data-testid="template-list"
          >
            {filteredTemplates.length === 0 ? (
              <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-[var(--muted)]">
                검색 결과가 없습니다.
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredTemplates.map((t) => {
                  const isSelected = t.id === selectedId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      data-template-id={t.id}
                      onClick={() => setSelectedId(t.id)}
                      onDoubleClick={() => handleApply(t)}
                      className={`block w-full rounded-lg border p-2.5 text-left transition-all ${
                        isSelected
                          ? 'border-[var(--accent)] bg-[var(--hover)] shadow-xs ring-1 ring-[var(--accent)]'
                          : 'border-transparent hover:border-[var(--border)] hover:bg-[var(--hover)]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-sm font-semibold text-[var(--text)]">
                          {t.name}
                        </span>
                        <span className="shrink-0 rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
                          {t.category}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">
                        {t.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. 템플릿 미리보기 영역 */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--doc-bg)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-xs font-semibold text-[var(--muted)]">
              <span>미리보기</span>
              {selectedTemplate && (
                <span className="font-normal text-[var(--muted)]">
                  {selectedTemplate.category} &gt; {selectedTemplate.name}
                </span>
              )}
            </div>
            <div
              ref={previewRef}
              data-testid="template-preview-content"
              className="markdown-body flex-1 overflow-y-auto p-4 text-sm"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>

        {/* 하단 버튼 바 */}
        <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div className="text-xs text-[var(--muted)]">
            {selectedTemplate ? (
              <span className="hidden sm:inline">
                선택됨: <strong className="text-[var(--text)]">{selectedTemplate.name}</strong>
              </span>
            ) : (
              <span>템플릿을 선택하세요.</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--hover)]"
            >
              취소
            </button>
            <button
              type="button"
              data-testid="template-apply-button"
              disabled={!selectedTemplate}
              onClick={() => {
                if (selectedTemplate) handleApply(selectedTemplate);
              }}
              className="flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3.5 py-1.5 text-xs font-medium text-white shadow-xs hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check className="size-3.5" />
              이 템플릿으로 새 문서
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TemplateGallery;
