import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Search, Workflow, X } from 'lucide-react';
import {
  DIAGRAM_GALLERY_CATEGORIES,
  DIAGRAM_GALLERY_TEMPLATES,
  type DiagramGalleryTemplate,
} from '../constants/diagramGalleryTemplates';
import { renderMermaid } from '../render/mermaid';
import { formatDiagramInsertion, insertSnippetAtCursor } from '../features/gallery/insertSnippet';
import { getEditorView } from '../editor/editorRegistry';
import { useUi } from '../stores/ui';
import { useResolvedTheme } from './theme';

export function DiagramGallery() {
  const open = useUi((s) => s.diagramGalleryOpen);
  const close = useUi((s) => s.closeDiagramGallery);
  const theme = useResolvedTheme();

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [selectedId, setSelectedId] = useState<string | null>(
    DIAGRAM_GALLERY_TEMPLATES[0]?.id ?? null,
  );
  const [previewSvg, setPreviewSvg] = useState<string>('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState<boolean>(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const { categories, categoryCounts } = useMemo(() => {
    const counts: Record<string, number> = {
      전체: DIAGRAM_GALLERY_TEMPLATES.length,
    };
    for (const cat of DIAGRAM_GALLERY_CATEGORIES) {
      counts[cat] = 0;
    }
    for (const t of DIAGRAM_GALLERY_TEMPLATES) {
      counts[t.category] = (counts[t.category] || 0) + 1;
    }
    return {
      categories: ['전체', ...DIAGRAM_GALLERY_CATEGORIES],
      categoryCounts: counts,
    };
  }, []);

  const filteredTemplates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DIAGRAM_GALLERY_TEMPLATES.filter((t) => {
      const matchCat = selectedCategory === '전체' || t.category === selectedCategory;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [query, selectedCategory]);

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
    () => DIAGRAM_GALLERY_TEMPLATES.find((t) => t.id === selectedId) ?? null,
    [selectedId],
  );

  // 선택한 카드만 오른쪽 미리보기에 Mermaid SVG로 렌더링한다 (카드 목록 전체 렌더 비용 절약)
  useEffect(() => {
    if (!open || !selectedTemplate) {
      setPreviewSvg('');
      setPreviewError(null);
      setIsRendering(false);
      return;
    }
    let cancelled = false;
    setIsRendering(true);
    setPreviewError(null);

    void renderMermaid(selectedTemplate.code, theme).then((res) => {
      if (cancelled) return;
      setIsRendering(false);
      if ('svg' in res) {
        setPreviewSvg(res.svg);
        setPreviewError(null);
      } else {
        setPreviewSvg('');
        setPreviewError(res.error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, selectedTemplate, theme]);

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

  const handleInsert = (template: DiagramGalleryTemplate) => {
    const view = getEditorView();
    if (view) {
      const snippet = formatDiagramInsertion(template.code);
      insertSnippetAtCursor(view, snippet, true);
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
      aria-label="다이어그램 템플릿 갤러리"
      data-testid="diagram-gallery-modal"
    >
      <div className="flex h-[92dvh] w-full max-w-5xl flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        {/* 상단 헤더 */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Workflow className="size-5 text-[var(--accent)]" />
            <h2 className="text-base font-bold text-[var(--text)]">다이어그램 삽입 갤러리</h2>
            <span className="hidden text-xs text-[var(--muted)] sm:inline">
              총 {DIAGRAM_GALLERY_TEMPLATES.length}개의 Mermaid 예시
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

        {/* 검색 및 종류 필터 */}
        <div className="flex shrink-0 flex-col gap-2.5 border-b border-[var(--border)] px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              ref={searchInputRef}
              autoFocus
              type="text"
              placeholder="다이어그램 검색 (이름, 설명, 종류)..."
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
              data-testid="diagram-search-input"
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

          <div className="flex flex-wrap items-center gap-1.5" data-testid="diagram-categories">
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

        {/* 본문: 왼쪽 카드 목록 / 오른쪽 선택 항목 미리보기 */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* 왼쪽: 카드 목록 (SVG 렌더 생략, 선택 시 오른쪽에만 그림) */}
          <div
            className="flex max-h-[220px] min-h-[140px] flex-1 flex-col overflow-y-auto border-b border-[var(--border)] p-2 md:max-h-none md:max-w-xs md:border-b-0 md:border-r md:p-3"
            data-testid="diagram-card-list"
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
                      data-diagram-id={t.id}
                      onClick={() => setSelectedId(t.id)}
                      onDoubleClick={() => handleInsert(t)}
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

          {/* 오른쪽: 선택된 다이어그램 미리보기 */}
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--doc-bg)]"
            data-testid="diagram-preview-panel"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-xs font-semibold text-[var(--muted)]">
              <span>미리보기</span>
              {selectedTemplate && (
                <span className="font-normal text-[var(--muted)]">
                  {selectedTemplate.category} &gt; {selectedTemplate.name}
                </span>
              )}
            </div>

            {selectedTemplate?.isFlowchart && (
              <div
                className="border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-xs text-[var(--text)]"
                data-testid="diagram-flowchart-notice"
              >
                순서도 예시는 삽입 후 미리보기에서 더블클릭하거나 &lsquo;편집&rsquo; 버튼을 눌러 기존 다이어그램 편집기(캔버스)로 바로 열 수 있습니다.
              </div>
            )}

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
              {selectedTemplate ? (
                <>
                  <div
                    className="diagram-preview-svg flex min-h-[240px] flex-1 items-center justify-center overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--doc-bg)] p-4"
                    data-testid="diagram-preview-svg"
                  >
                    {isRendering && !previewSvg ? (
                      <span className="text-xs text-[var(--muted)]">다이어그램 그리는 중…</span>
                    ) : previewError ? (
                      <pre className="mermaid-error text-xs text-red-500">
                        다이어그램 문법 오류{'\n'}
                        {previewError}
                      </pre>
                    ) : (
                      <div
                        className="flex w-full items-center justify-center"
                        dangerouslySetInnerHTML={{ __html: previewSvg }}
                      />
                    )}
                  </div>
                  <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="mb-1 text-[11px] font-semibold text-[var(--muted)]">
                      Mermaid 원문 코드
                    </div>
                    <pre className="max-h-32 overflow-y-auto font-mono text-xs text-[var(--text)] whitespace-pre-wrap">
                      {selectedTemplate.code}
                    </pre>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center text-xs text-[var(--muted)]">
                  왼쪽 목록에서 다이어그램을 선택하세요.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 하단 버튼 바 */}
        <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div className="text-xs text-[var(--muted)]">
            {selectedTemplate ? (
              <span>
                선택됨: <strong className="text-[var(--text)]">{selectedTemplate.name}</strong>
              </span>
            ) : (
              <span>다이어그램을 선택하세요.</span>
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
              data-testid="diagram-insert-button"
              disabled={!selectedTemplate}
              onClick={() => {
                if (selectedTemplate) handleInsert(selectedTemplate);
              }}
              className="flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3.5 py-1.5 text-xs font-medium text-white shadow-xs hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check className="size-3.5" />
              다이어그램 삽입
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DiagramGallery;
