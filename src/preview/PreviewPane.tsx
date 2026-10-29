import { useEffect, useRef, useState, useCallback, Suspense, lazy } from 'react';
import morphdom from 'morphdom';
import { ChevronUp } from 'lucide-react';
import { ErrorBoundary } from '../app/ErrorBoundary';
import { useDocuments, getActiveDoc } from '../stores/documents';
import { useSettings } from '../stores/settings';
import { toast, useUi } from '../stores/ui';
import { useResolvedTheme } from '../app/theme';
import { renderMarkdown, findAttachmentIds } from '../render/markdown';
import { sanitizeHtml } from '../render/sanitize';
import { renderMermaidBlocks } from '../render/mermaid';
import { getAttachmentUrl, loadAttachments } from '../storage/attachments';
import { getEditorView, getLines, replaceLines } from '../editor/editorRegistry';
import { applyTableOp, readCell, type TableOp } from '../features/table/tableEdit';
import {
  findHoveredRow,
  findHoveredCol,
  findNearRowBoundary,
  findNearColBoundary,
  type TableRowMetric,
  type TableColMetric,
} from '../features/table/tableToolbar';
import { setTaskChecked } from '../features/tasks/toggleTask';
import { invalidateAnchors, registerPreview, scrollPreviewToLine, syncFromPreview } from './scrollSync';
import { usePositions } from '../stores/positions';
import { recordCurrentPosition, scheduleRecordPosition } from '../app/positionTracker';
import { useFolder } from '../stores/folder';
import { resolveRelativePath } from '../features/folder/path';
import { readFileByPath, getFileHandleByPath } from '../storage/folder';
import { isMarkdownFileName, readHandle, type FileHandle } from '../storage/fileSystem';
import { slugify } from '../render/plugins/headings';
import { onExtendedEmojiLoaded } from '../constants/emojiCore';
import { downloadDiagramAsPng, downloadDiagramAsSvg } from '../features/mermaid/exportDiagram';
import { TableToolbar } from './TableToolbar';
import { PreviewSearchBar } from './PreviewSearchBar';
import {
  applySearchHighlights,
  clearSearchHighlights,
  collectPreviewSearchRanges,
  scrollRangeToCenter,
  stepMatchIndex,
} from '../features/search/previewSearch';

const ImageLightbox = lazy(() => import('./ImageLightbox'));

interface CellTarget {
  start: number;
  end: number;
  row: number;
  col: number;
}
interface CellEditState extends CellTarget {
  value: string;
  rect: DOMRect;
}
interface MenuState extends CellTarget {
  x: number;
  y: number;
}

const WIDTH_CLASS = { narrow: 'max-w-[680px]', standard: 'max-w-[860px]', wide: 'max-w-[1200px]' } as const;

function cellTarget(cell: HTMLElement): CellTarget | null {
  const table = cell.closest<HTMLElement>('table.editable-table');
  const tr = cell.closest<HTMLElement>('tr');
  if (!table || !tr) return null;
  const start = Number(table.dataset.line);
  return {
    start,
    end: Number(table.dataset.lineEnd),
    row: Number(tr.dataset.line) - start,
    col: Number(cell.dataset.col),
  };
}

/** 미리보기가 현재 원문으로 그려진 상태인지 (그사이 타이핑했다면 줄 번호가 어긋날 수 있음) */
function useFreshness() {
  const renderedRef = useRef('');
  const isFresh = () => renderedRef.current === getActiveDoc()?.content;
  return { renderedRef, isFresh };
}

const ALLOWED_IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp']);

let isMermaidEditorPrefetched = false;
function prefetchMermaidEditor() {
  if (isMermaidEditorPrefetched) return;
  isMermaidEditorPrefetched = true;
  void import('../app/mermaid/MermaidEditor');
}

export function PreviewPane() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const activeId = useDocuments((s) => s.activeId);
  const activeDoc = useDocuments((s) => (s.activeId ? s.docs[s.activeId] : undefined));
  const content = activeDoc?.content ?? '';
  const { fontSize, width, font, lineHeight, textAlign, wordBreakKeepAll, codeBlockWrap } = useSettings();
  const theme = useResolvedTheme();
  const [attachVersion, setAttachVersion] = useState(0);
  const [relImageVersion, setRelImageVersion] = useState(0);
  const [emojiVersion, setEmojiVersion] = useState(0);
  const [renderVersion, setRenderVersion] = useState(0);
  const [cellEdit, setCellEdit] = useState<CellEditState | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const { renderedRef, isFresh } = useFreshness();
  const lastDocRef = useRef<string | null>(null);
  const cancelEditRef = useRef(false);

  // 미리보기 문서 내 검색 상태
  const previewSearchOpen = useUi((s) => s.previewSearchOpen);
  const previewSearchFocusTick = useUi((s) => s.previewSearchFocusTick);
  const closePreviewSearch = useUi((s) => s.closePreviewSearch);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchActiveIdx, setSearchActiveIdx] = useState(0);
  const [searchTotalCount, setSearchTotalCount] = useState(0);
  const searchRangesRef = useRef<Range[]>([]);
  const lastScrolledQueryRef = useRef('');

  // C) 읽기 진행 막대 & 맨 위로 이동 버튼
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const rafScrollRef = useRef<number | null>(null);

  // D) 이미지 확대 모달 상태
  const [lightbox, setLightbox] = useState<{ src: string; alt?: string; triggerEl: HTMLElement } | null>(null);
  const closeLightbox = useCallback(() => {
    if (lightbox?.triggerEl) {
      lightbox.triggerEl.focus();
    }
    setLightbox(null);
  }, [lightbox]);

  // E) 표 가장자리 +/− 편집 컨트롤 상태
  const [activeTable, setActiveTable] = useState<{
    start: number;
    end: number;
    rect: DOMRect;
    scrollerRect?: DOMRect;
    spaceAbove: number;
    spaceBelow: number;
    rows: TableRowMetric[];
    cols: TableColMetric[];
    tableLines: string[];
  } | null>(null);
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  const [hoveredColIndex, setHoveredColIndex] = useState<number | null>(null);
  const [hoveredRowBoundary, setHoveredRowBoundary] = useState<number | null>(null);
  const [hoveredColBoundary, setHoveredColBoundary] = useState<number | null>(null);

  const activeTableRef = useRef<typeof activeTable>(null);
  activeTableRef.current = activeTable;
  const tableHoverTimeoutRef = useRef<number | null>(null);
  const rowBoundaryTimeoutRef = useRef<number | null>(null);
  const colBoundaryTimeoutRef = useRef<number | null>(null);

  // F) 다이어그램(Mermaid) PNG / SVG 저장 오버레이 상태
  const [hoveredMermaid, setHoveredMermaid] = useState<{
    wrapEl: HTMLElement;
    rect: DOMRect;
  } | null>(null);
  const mermaidHoverTimeoutRef = useRef<number | null>(null);

  useEffect(() => onExtendedEmojiLoaded(() => setEmojiVersion((v) => v + 1)), []);

  const measureTable = useCallback((table: HTMLTableElement) => {
    const start = Number(table.dataset.line);
    const end = Number(table.dataset.lineEnd);
    if (isNaN(start) || isNaN(end)) return null;

    const rect = table.getBoundingClientRect();
    const scrollerRect = scrollRef.current?.getBoundingClientRect();
    const prevEl = table.previousElementSibling as HTMLElement | null;
    const nextEl = table.nextElementSibling as HTMLElement | null;
    const spaceAbove = prevEl ? Math.max(0, rect.top - prevEl.getBoundingClientRect().bottom) : rect.top;
    const spaceBelow = nextEl ? Math.max(0, nextEl.getBoundingClientRect().top - rect.bottom) : 24;

    const trEls = Array.from(table.querySelectorAll<HTMLTableRowElement>('tr'));
    const rows: TableRowMetric[] = trEls.map((tr, idx) => {
      const rRect = tr.getBoundingClientRect();
      const lineAttr = Number(tr.dataset.line);
      const rowIndex = !isNaN(lineAttr) ? lineAttr - start : idx === 0 ? 0 : idx + 1;
      return {
        rowIndex,
        top: rRect.top,
        bottom: rRect.bottom,
        height: rRect.height,
      };
    });

    const firstCells = trEls[0] ? Array.from(trEls[0].querySelectorAll<HTMLElement>('th, td')) : [];
    const cols: TableColMetric[] = firstCells.map((cell, idx) => {
      const cRect = cell.getBoundingClientRect();
      const colAttr = Number(cell.dataset.col);
      return {
        colIndex: !isNaN(colAttr) ? colAttr : idx,
        left: cRect.left,
        right: cRect.right,
        width: cRect.width,
      };
    });

    const tableLines = getLines(start, end);
    return {
      start,
      end,
      rect,
      scrollerRect,
      spaceAbove,
      spaceBelow,
      rows,
      cols,
      tableLines,
    };
  }, []);

  // 상대 경로 이미지 캐시 (key: 해석된 폴더 기준 경로)
  const relImageCache = useRef<Map<string, string | 'missing'>>(new Map());
  const relImageUrls = useRef<string[]>([]);

  const folder = useFolder((s) => s.folder);
  const folderHandle = useFolder((s) => s.handle);
  const needPermission = useFolder((s) => s.needPermission);
  const refreshCount = useFolder((s) => s.refreshCount);

  // 폴더가 바뀌거나 닫히거나 새로고침 시 이미지 캐시 정리
  const folderKey = folder?.handleId ?? '';
  useEffect(() => {
    for (const url of relImageUrls.current) URL.revokeObjectURL(url);
    relImageUrls.current = [];
    relImageCache.current.clear();
    setRelImageVersion((v) => v + 1);
  }, [folderKey, refreshCount]);

  // 상대 경로 이미지 해석 콜백
  const resolveRelativeImage = useCallback(
    (src: string): string | 'missing' | undefined => {
      if (!activeDoc?.folderPath || !folder || !folderHandle || needPermission) {
        return 'missing';
      }
      const resolved = resolveRelativePath(activeDoc.folderPath, src);
      if (!resolved.ok) {
        return 'missing';
      }
      const cached = relImageCache.current.get(resolved.path);
      if (cached) return cached;
      return undefined;
    },
    [activeDoc?.folderPath, folder, folderHandle, needPermission],
  );

  // 렌더링: 타이핑 중엔 잠깐 기다렸다가, 탭 전환 시엔 즉시
  useEffect(() => {
    const switched = lastDocRef.current !== activeId;
    lastDocRef.current = activeId;
    const timer = window.setTimeout(() => {
      const body = bodyRef.current;
      if (!body) return;
      void loadAttachments(findAttachmentIds(content)).then((loaded) => loaded && setAttachVersion((v) => v + 1));

      const { html, toc, pendingRelativeImages } = renderMarkdown(content, {
        resolveAttachment: getAttachmentUrl,
        resolveRelativeImage,
      });

      // 대기 중인 상대 경로 이미지 비동기 로드
      if (pendingRelativeImages.length > 0 && activeDoc?.folderPath && folderHandle && !needPermission) {
        const basePath = activeDoc.folderPath;
        const root = folderHandle;
        void (async () => {
          let hasNew = false;
          for (const rawSrc of pendingRelativeImages) {
            const res = resolveRelativePath(basePath, rawSrc);
            if (!res.ok) {
              relImageCache.current.set(rawSrc, 'missing');
              hasNew = true;
              continue;
            }
            if (relImageCache.current.has(res.path)) continue;

            const ext = res.path.split('.').pop()?.toLowerCase();
            if (!ext || !ALLOWED_IMAGE_EXTS.has(ext)) {
              relImageCache.current.set(res.path, 'missing');
              hasNew = true;
              continue;
            }

            const file = await readFileByPath(root, res.path);
            if (!file || file.size > 25 * 1024 * 1024) {
              relImageCache.current.set(res.path, 'missing');
              hasNew = true;
              continue;
            }

            const url = URL.createObjectURL(file);
            relImageUrls.current.push(url);
            relImageCache.current.set(res.path, url);
            hasNew = true;
          }
          if (hasNew) setRelImageVersion((v) => v + 1);
        })();
      }

      const next = document.createElement('div');
      next.innerHTML = sanitizeHtml(html);
      morphdom(body, next, {
        childrenOnly: true,
        onBeforeElUpdated(from, to) {
          // 내용이 같은 다이어그램은 다시 그리지 않고 줄 번호만 갱신
          if (from.classList.contains('mermaid-wrap') && to.classList.contains('mermaid-wrap')) {
            const fromBlock = from.querySelector<HTMLElement>('.mermaid-block');
            const toBlock = to.querySelector<HTMLElement>('.mermaid-block');
            if (fromBlock && toBlock && fromBlock.dataset.code === toBlock.dataset.code) {
              from.dataset.line = to.dataset.line;
              from.dataset.lineEnd = to.dataset.lineEnd;
              return false;
            }
          }
          if (from.classList.contains('mermaid-block') && from.dataset.code === to.dataset.code) {
            from.dataset.line = to.dataset.line;
            from.dataset.lineEnd = to.dataset.lineEnd;
            return false;
          }
          return !from.isEqualNode(to);
        },
      });
      renderedRef.current = content;
      useUi.getState().setToc(toc);
      invalidateAnchors();
      setRenderVersion((v) => v + 1);

      // 활성화된 표가 있으면 리렌더링된 표의 최신 좌표와 줄 범위로 갱신
      if (activeTableRef.current) {
        const updatedTable = body.querySelector<HTMLTableElement>(
          `table.editable-table[data-line="${activeTableRef.current.start}"]`,
        );
        if (updatedTable) {
          const nextMetrics = measureTable(updatedTable);
          if (nextMetrics) setActiveTable(nextMetrics);
        } else {
          setActiveTable(null);
        }
      }

      // pendingAnchor 스크롤 처리
      const pendingAnchor = useUi.getState().pendingAnchor;
      if (pendingAnchor && pendingAnchor.docId === activeId) {
        useUi.getState().setPendingAnchor(null);
        requestAnimationFrame(() => {
          const el = body.querySelector<HTMLElement>(`[id="${CSS.escape(pendingAnchor.id)}"]`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      } else if (switched && scrollRef.current) {
        const pos = activeId ? usePositions.getState().positions[activeId] : undefined;
        if (pos && typeof pos.previewLine === 'number' && pos.previewLine > 0) {
          scrollPreviewToLine(scrollRef.current, pos.previewLine);
        } else {
          scrollRef.current.scrollTo({ top: 0 });
        }
      }

      void renderMermaidBlocks(body, theme).then(() => {
        invalidateAnchors();
        if (switched && scrollRef.current && activeId) {
          const pos = usePositions.getState().positions[activeId];
          if (pos && typeof pos.previewLine === 'number' && pos.previewLine > 0) {
            scrollPreviewToLine(scrollRef.current, pos.previewLine);
          }
        }
      });
    }, switched ? 0 : 120);
    return () => window.clearTimeout(timer);
  }, [content, activeId, attachVersion, relImageVersion, emojiVersion, theme, renderedRef, resolveRelativeImage, activeDoc?.folderPath, folderHandle, needPermission]);

  useEffect(() => {
    registerPreview(scrollRef.current);
    const observer = new ResizeObserver(invalidateAnchors);
    observer.observe(bodyRef.current!);
    return () => {
      observer.disconnect();
      registerPreview(null);
      clearSearchHighlights();
    };
  }, []);

  // 미리보기 문서 내 검색 결과 계산 및 강조 동기화 (검색어 변경 또는 문서 재렌더링 시)
  useEffect(() => {
    const body = bodyRef.current;
    if (!previewSearchOpen || !body || !searchQuery) {
      searchRangesRef.current = [];
      setSearchTotalCount(0);
      setSearchActiveIdx(0);
      lastScrolledQueryRef.current = '';
      clearSearchHighlights();
      return;
    }

    const ranges = collectPreviewSearchRanges(body, searchQuery);
    searchRangesRef.current = ranges;
    setSearchTotalCount(ranges.length);

    const queryChanged = lastScrolledQueryRef.current !== searchQuery;
    const nextIdx = ranges.length === 0 ? 0 : queryChanged ? 0 : Math.min(searchActiveIdx, ranges.length - 1);
    setSearchActiveIdx(nextIdx);
    applySearchHighlights(ranges, nextIdx);

    if (queryChanged && ranges.length > 0 && scrollRef.current) {
      lastScrolledQueryRef.current = searchQuery;
      scrollRangeToCenter(scrollRef.current, ranges[nextIdx]);
    }
  }, [previewSearchOpen, searchQuery, renderVersion]);

  const handleSearchStep = useCallback(
    (delta: 1 | -1) => {
      const ranges = searchRangesRef.current;
      if (ranges.length === 0) return;
      const nextIdx = stepMatchIndex(searchActiveIdx, ranges.length, delta);
      setSearchActiveIdx(nextIdx);
      applySearchHighlights(ranges, nextIdx);
      if (scrollRef.current && ranges[nextIdx]) {
        scrollRangeToCenter(scrollRef.current, ranges[nextIdx]);
      }
    },
    [searchActiveIdx],
  );

  const handleSearchClose = useCallback(() => {
    clearSearchHighlights();
    closePreviewSearch();
  }, [closePreviewSearch]);

  // 미리보기 안의 클릭·체크·더블클릭·오른쪽 클릭
  useEffect(() => {
    const body = bodyRef.current!;

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const copyBtn = target.closest<HTMLButtonElement>('.code-copy');
      if (copyBtn) {
        const code = copyBtn.closest('.code-block')?.querySelector('code')?.textContent ?? '';
        void navigator.clipboard.writeText(code).then(() => {
          copyBtn.textContent = '복사됨';
          setTimeout(() => (copyBtn.textContent = '복사'), 1200);
        });
        return;
      }
      const mermaidBtn = target.closest<HTMLButtonElement>('.mermaid-edit');
      if (mermaidBtn) {
        const wrap = mermaidBtn.closest<HTMLElement>('.mermaid-wrap');
        const block = wrap?.querySelector<HTMLElement>('.mermaid-block');
        if (wrap && block && activeId && isFresh()) {
          const startLine = Number(wrap.dataset.line);
          const endLine = Number(wrap.dataset.lineEnd);
          if (!isNaN(startLine) && !isNaN(endLine)) {
            // startLine은 ```mermaid 줄, endLine - 1은 닫는 ``` 줄
            const originalLines = getLines(startLine + 1, endLine - 1);
            const initialCode = decodeURIComponent(block.dataset.code ?? '');
            useUi.getState().openMermaidEditor({
              docId: activeId,
              startLine: startLine + 1,
              endLine: endLine - 1,
              originalLines,
              initialCode,
            });
          }
        }
        return;
      }
      const link = target.closest<HTMLAnchorElement>('a[href]');
      if (link) {
        const href = link.getAttribute('href') ?? '';
        if (href.startsWith('#')) {
          e.preventDefault();
          const el = body.querySelector<HTMLElement>(`[id="${CSS.escape(decodeURIComponent(href.slice(1)))}"]`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (!/^(https?:|mailto:)/i.test(href)) {
          e.preventDefault();
          const doc = getActiveDoc();
          const folderState = useFolder.getState();

          if (!doc?.folderPath || !folderState.folder || !folderState.handle) {
            toast('폴더에서 연 문서에서만 상대 경로 링크를 열 수 있습니다. 왼쪽 \'파일\' 탭에서 폴더를 열어 주세요.');
            return;
          }

          if (folderState.needPermission) {
            toast('폴더 접근 권한이 필요합니다. 왼쪽 \'파일\' 탭에서 \'폴더 다시 연결\'을 눌러 주세요.');
            return;
          }

          const resolved = resolveRelativePath(doc.folderPath, href);
          if (!resolved.ok) {
            if (resolved.reason === 'outside') {
              toast('작업 폴더 밖의 파일은 열 수 없습니다.');
            }
            return;
          }

          if (!isMarkdownFileName(resolved.path)) {
            toast(`마크다운 문서만 열 수 있습니다: ${resolved.path}`);
            return;
          }

          void (async () => {
            const fileHandle = await getFileHandleByPath(folderState.handle!, resolved.path);
            if (!fileHandle) {
              toast(`파일을 찾을 수 없습니다: ${resolved.path}`);
              return;
            }

            recordCurrentPosition();
            const opened = await readHandle(fileHandle as FileHandle, resolved.path);
            useDocuments.getState().addOpenedFiles([opened]);

            if (resolved.hash) {
              const slugId = slugify(resolved.hash);
              const targetDoc = Object.values(useDocuments.getState().docs).find((d) => d.folderPath === resolved.path);
              if (targetDoc) {
                useUi.getState().setPendingAnchor({ docId: targetDoc.id, id: slugId });
                // 만약 현재 이미 활성 탭인 경우 바로 스크롤
                if (targetDoc.id === useDocuments.getState().activeId) {
                  requestAnimationFrame(() => {
                    const el = body.querySelector<HTMLElement>(`[id="${CSS.escape(slugId)}"]`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  });
                }
              }
            }
          })();
        }
        return;
      }

      // D) 이미지 클릭 시 모달 확대 보기 (링크 안의 이미지나 missing/pending 제외)
      const img = target.closest<HTMLImageElement>('img');
      if (img && body.contains(img)) {
        if (!img.closest('a') && !img.classList.contains('img-missing') && !img.classList.contains('img-pending')) {
          const src = img.currentSrc || img.getAttribute('src');
          if (src) {
            setLightbox({ src, alt: img.alt || undefined, triggerEl: img });
            return;
          }
        }
      }

      // E) 표 클릭/탭 시 가장자리 컨트롤 표시 (터치·모바일 환경 지원)
      const table = target.closest<HTMLTableElement>('table.editable-table');
      if (table && isFresh()) {
        updateTableFromPointer(table, e.clientX, e.clientY);
      }
    };

    const clearHoverTimers = () => {
      if (tableHoverTimeoutRef.current) {
        clearTimeout(tableHoverTimeoutRef.current);
        tableHoverTimeoutRef.current = null;
      }
      if (rowBoundaryTimeoutRef.current) {
        clearTimeout(rowBoundaryTimeoutRef.current);
        rowBoundaryTimeoutRef.current = null;
      }
      if (colBoundaryTimeoutRef.current) {
        clearTimeout(colBoundaryTimeoutRef.current);
        colBoundaryTimeoutRef.current = null;
      }
      if (mermaidHoverTimeoutRef.current) {
        clearTimeout(mermaidHoverTimeoutRef.current);
        mermaidHoverTimeoutRef.current = null;
      }
    };

    const updateTableFromPointer = (table: HTMLTableElement, clientX: number, clientY: number) => {
      if (tableHoverTimeoutRef.current) {
        clearTimeout(tableHoverTimeoutRef.current);
        tableHoverTimeoutRef.current = null;
      }
      const metrics = measureTable(table);
      if (!metrics) return;
      setActiveTable(metrics);

      const hRow = findHoveredRow(metrics.rows, clientY);
      if (hRow) setHoveredRowIndex(hRow.rowIndex);

      const hCol = findHoveredCol(metrics.cols, clientX);
      if (hCol) setHoveredColIndex(hCol.colIndex);

      const rBound = findNearRowBoundary(metrics.rows, clientY, 10);
      if (rBound) {
        if (rowBoundaryTimeoutRef.current) {
          clearTimeout(rowBoundaryTimeoutRef.current);
          rowBoundaryTimeoutRef.current = null;
        }
        setHoveredRowBoundary(rBound.index);
      } else if (!rowBoundaryTimeoutRef.current) {
        rowBoundaryTimeoutRef.current = window.setTimeout(() => {
          setHoveredRowBoundary(null);
          rowBoundaryTimeoutRef.current = null;
        }, 400);
      }

      const cBound = findNearColBoundary(metrics.cols, clientX, 10);
      if (cBound) {
        if (colBoundaryTimeoutRef.current) {
          clearTimeout(colBoundaryTimeoutRef.current);
          colBoundaryTimeoutRef.current = null;
        }
        setHoveredColBoundary(cBound.index);
      } else if (!colBoundaryTimeoutRef.current) {
        colBoundaryTimeoutRef.current = window.setTimeout(() => {
          setHoveredColBoundary(null);
          colBoundaryTimeoutRef.current = null;
        }, 400);
      }
    };

    const onChange = (e: Event) => {
      const box = e.target as HTMLInputElement;
      if (!box.classList.contains('task-checkbox')) return;
      const line = Number(box.dataset.taskLine);
      const updated = isFresh() ? setTaskChecked(getLines(line, line + 1)[0] ?? '', box.checked) : null;
      if (updated === null) {
        box.checked = !box.checked;
        return;
      }
      replaceLines(line, line + 1, [updated]);
    };

    const onDblClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // 다이어그램 더블클릭 시 편집 창 열기 (편집 가능한 신선한 상태일 때만)
      const mermaidWrap = target.closest<HTMLElement>('.mermaid-wrap');
      if (mermaidWrap && activeId && isFresh()) {
        const block = mermaidWrap.querySelector<HTMLElement>('.mermaid-block');
        if (block) {
          const startLine = Number(mermaidWrap.dataset.line);
          const endLine = Number(mermaidWrap.dataset.lineEnd);
          if (!isNaN(startLine) && !isNaN(endLine)) {
            e.preventDefault();
            const originalLines = getLines(startLine + 1, endLine - 1);
            const initialCode = decodeURIComponent(block.dataset.code ?? '');
            useUi.getState().openMermaidEditor({
              docId: activeId,
              startLine: startLine + 1,
              endLine: endLine - 1,
              originalLines,
              initialCode,
            });
            return;
          }
        }
      }

      const cell = target.closest<HTMLElement>('table.editable-table th, table.editable-table td');
      const t = cell && cellTarget(cell);
      if (!cell || !t || !isFresh()) return;
      e.preventDefault();
      setMenu(null);
      setActiveTable(null);
      cancelEditRef.current = false;
      setCellEdit({ ...t, value: readCell(getLines(t.start, t.end), t.row, t.col), rect: cell.getBoundingClientRect() });
    };

    const onContextMenu = (e: MouseEvent) => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>('table.editable-table th, table.editable-table td');
      const t = cell && cellTarget(cell);
      if (!t || !isFresh()) return;
      e.preventDefault();
      setCellEdit(null);
      setActiveTable(null);
      setMenu({ ...t, x: e.clientX, y: e.clientY });
    };

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const mermaidWrap = target?.closest?.('.mermaid-wrap') as HTMLElement | null;
      if (mermaidWrap) {
        prefetchMermaidEditor();
        if (mermaidHoverTimeoutRef.current) {
          clearTimeout(mermaidHoverTimeoutRef.current);
          mermaidHoverTimeoutRef.current = null;
        }
        setHoveredMermaid({ wrapEl: mermaidWrap, rect: mermaidWrap.getBoundingClientRect() });
      }

      // E) 표 호버 시 가장자리 컨트롤 활성화
      const table = (target as HTMLElement | null)?.closest?.<HTMLTableElement>('table.editable-table');
      if (table && isFresh()) {
        updateTableFromPointer(table, e.clientX, e.clientY);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const mermaidWrap = target?.closest?.('.mermaid-wrap') as HTMLElement | null;
      if (mermaidWrap) {
        if (mermaidHoverTimeoutRef.current) {
          clearTimeout(mermaidHoverTimeoutRef.current);
          mermaidHoverTimeoutRef.current = null;
        }
        setHoveredMermaid({ wrapEl: mermaidWrap, rect: mermaidWrap.getBoundingClientRect() });
      }
      const table = (target as HTMLElement | null)?.closest?.<HTMLTableElement>('table.editable-table');
      if (table && isFresh()) {
        updateTableFromPointer(table, e.clientX, e.clientY);
      } else if (activeTableRef.current && isFresh()) {
        // 마우스가 표 가장자리 근처(±18px)에서 움직일 때도 경계 감지 유지
        const cur = activeTableRef.current;
        const r = cur.rect;
        if (
          e.clientX >= r.left - 24 &&
          e.clientX <= r.right + 24 &&
          e.clientY >= r.top - 24 &&
          e.clientY <= r.bottom + 24
        ) {
          const domTable = body.querySelector<HTMLTableElement>(
            `table.editable-table[data-line="${cur.start}"]`,
          );
          if (domTable) {
            updateTableFromPointer(domTable, e.clientX, e.clientY);
          }
        }
      }
    };

    const onMouseOut = (e: MouseEvent) => {
      const related = e.relatedTarget as Element | null;
      if (!related?.closest?.('.mermaid-wrap, .mermaid-export-overlay')) {
        if (mermaidHoverTimeoutRef.current) clearTimeout(mermaidHoverTimeoutRef.current);
        mermaidHoverTimeoutRef.current = window.setTimeout(() => {
          setHoveredMermaid(null);
          mermaidHoverTimeoutRef.current = null;
        }, 350);
      }
      if (related?.closest?.('table.editable-table, .no-print')) return;
      if (tableHoverTimeoutRef.current) clearTimeout(tableHoverTimeoutRef.current);
      tableHoverTimeoutRef.current = window.setTimeout(() => {
        setActiveTable(null);
        setHoveredRowIndex(null);
        setHoveredColIndex(null);
        setHoveredRowBoundary(null);
        setHoveredColBoundary(null);
      }, 280);
    };

    const onTableScroll = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target instanceof HTMLTableElement && target.classList.contains('editable-table') && isFresh()) {
        const metrics = measureTable(target);
        if (metrics) setActiveTable(metrics);
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.mermaid-edit, .mermaid-wrap')) {
        prefetchMermaidEditor();
      }
    };

    body.addEventListener('click', onClick);
    body.addEventListener('change', onChange);
    body.addEventListener('dblclick', onDblClick);
    body.addEventListener('contextmenu', onContextMenu);
    body.addEventListener('mouseover', onMouseOver);
    body.addEventListener('mousemove', onMouseMove);
    body.addEventListener('mouseout', onMouseOut);
    body.addEventListener('scroll', onTableScroll, true);
    body.addEventListener('focusin', onFocusIn);
    return () => {
      body.removeEventListener('click', onClick);
      body.removeEventListener('change', onChange);
      body.removeEventListener('dblclick', onDblClick);
      body.removeEventListener('contextmenu', onContextMenu);
      body.removeEventListener('mouseover', onMouseOver);
      body.removeEventListener('mousemove', onMouseMove);
      body.removeEventListener('mouseout', onMouseOut);
      body.removeEventListener('scroll', onTableScroll, true);
      body.removeEventListener('focusin', onFocusIn);
      clearHoverTimers();
      if (rafScrollRef.current) cancelAnimationFrame(rafScrollRef.current);
    };
    // isFresh는 ref만 읽으므로 한 번만 등록한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 메뉴는 바깥 클릭·Esc로 닫기
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const applyOp = (t: CellTarget, op: TableOp) => {
    if (!isFresh()) return;
    replaceLines(t.start, t.end, applyTableOp(getLines(t.start, t.end), op));
  };

  /** Enter와 포커스 이탈 모두 여기로. 취소했거나 이미 저장했으면 무시 */
  const commitCellEdit = () => {
    if (cellEdit && !cancelEditRef.current) {
      applyOp(cellEdit, { type: 'set-cell', row: cellEdit.row, col: cellEdit.col, value: cellEdit.value });
    }
    cancelEditRef.current = true;
    setCellEdit(null);
  };

  const onScroll = () => {
    if (cellEdit) commitCellEdit();
    setMenu(null);
    setActiveTable(null);
    setHoveredMermaid(null);
    const view = getEditorView();
    if (view && useUi.getState().viewMode === 'split') syncFromPreview(view);
    scheduleRecordPosition(300);

    // C) 읽기 진행 막대 및 맨 위로 이동 버튼 rAF 쓰로틀링
    const scroller = scrollRef.current;
    if (scroller) {
      if (rafScrollRef.current) cancelAnimationFrame(rafScrollRef.current);
      rafScrollRef.current = requestAnimationFrame(() => {
        const maxScroll = scroller.scrollHeight - scroller.clientHeight;
        const progress = maxScroll > 0 ? Math.min(100, Math.max(0, (scroller.scrollTop / maxScroll) * 100)) : 0;
        setScrollProgress(progress);
        setShowScrollTop(scroller.scrollTop >= 300);
      });
    }

    // 현재 읽고 있는 제목 표시
    if (scroller) {
      const limit = scroller.getBoundingClientRect().top + 80;
      let current: string | null = null;
      for (const item of useUi.getState().toc) {
        const el = bodyRef.current?.querySelector<HTMLElement>(`[id="${CSS.escape(item.id)}"]`);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= limit) current = item.id;
        else break;
      }
      useUi.getState().setActiveHeading(current);
    }
  };

  const onTableToolbarOp = (op: TableOp) => {
    if (!activeTable || !isFresh()) return;
    const newLines = applyTableOp(getLines(activeTable.start, activeTable.end), op);
    replaceLines(activeTable.start, activeTable.end, newLines);
    setHoveredRowBoundary(null);
    setHoveredColBoundary(null);
    if (op.type === 'delete-row' && hoveredRowIndex !== null && hoveredRowIndex >= newLines.length) {
      setHoveredRowIndex(Math.max(2, newLines.length - 1));
    }
    setActiveTable((prev) =>
      prev
        ? {
            ...prev,
            end: prev.start + newLines.length,
            tableLines: newLines,
          }
        : null,
    );
  };

  const menuItems: [string, TableOp | null][] = menu
    ? [
        ['아래에 행 추가', { type: 'insert-row', after: menu.row }],
        ['행 삭제', menu.row >= 2 ? { type: 'delete-row', row: menu.row } : null],
        ['오른쪽에 열 추가', { type: 'insert-col', after: menu.col }],
        ['열 삭제', { type: 'delete-col', col: menu.col }],
      ]
    : [];

  return (
    <div ref={scrollRef} onScroll={onScroll} className="preview-scroll relative h-full overflow-y-auto">
      {/* C) 상단 읽기 진행 막대 (높이 3px, 스크롤 없는 짧은 문서는 숨김) */}
      {scrollProgress > 0 && (
        <div
          className="no-print sticky top-0 left-0 right-0 z-30 h-[3px] bg-transparent pointer-events-none"
          role="progressbar"
          aria-valuenow={Math.round(scrollProgress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="읽기 진행률"
        >
          <div
            className="h-full bg-[var(--accent)] transition-[width] duration-75 ease-out"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      )}

      {/* 미리보기 문서 내 검색 막대 */}
      {previewSearchOpen && (
        <PreviewSearchBar
          query={searchQuery}
          activeIndex={searchActiveIdx}
          totalCount={searchTotalCount}
          focusTick={previewSearchFocusTick}
          onChangeQuery={setSearchQuery}
          onNext={() => handleSearchStep(1)}
          onPrev={() => handleSearchStep(-1)}
          onClose={handleSearchClose}
        />
      )}

      <div
        ref={bodyRef}
        className={`markdown-body mx-auto px-6 py-8 sm:px-10 ${WIDTH_CLASS[width]} ${
          font === 'serif'
            ? 'font-serif-doc'
            : font === 'mono'
              ? 'font-mono-doc'
              : font === 'rounded'
                ? 'font-rounded-doc'
                : 'font-sans-doc'
        } ${textAlign === 'justify' ? 'align-justify' : 'align-left'} ${
          wordBreakKeepAll ? 'break-keep-all' : 'break-normal'
        } ${codeBlockWrap ? 'code-wrap' : ''}`}
        style={{ fontSize: `${fontSize}px`, lineHeight: String(lineHeight) }}
      />

      {/* C) 300px 이상 스크롤 시 '맨 위로' 플로팅 버튼 */}
      {showScrollTop && (
        <button
          type="button"
          aria-label="맨 위로 이동"
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="no-print fixed bottom-6 right-6 z-30 flex size-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-lg hover:bg-[var(--hover)] hover:scale-105 active:scale-95 transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <ChevronUp className="size-5" />
        </button>
      )}

      {/* E) 표 가장자리 +/− 편집 컨트롤 */}
      {activeTable && !menu && !cellEdit && (
        <TableToolbar
          tableLines={activeTable.tableLines}
          rect={activeTable.rect}
          scrollerRect={activeTable.scrollerRect}
          spaceAbove={activeTable.spaceAbove}
          spaceBelow={activeTable.spaceBelow}
          rows={activeTable.rows}
          cols={activeTable.cols}
          hoveredRowIndex={hoveredRowIndex}
          hoveredColIndex={hoveredColIndex}
          hoveredRowBoundary={hoveredRowBoundary}
          hoveredColBoundary={hoveredColBoundary}
          onApplyOp={onTableToolbarOp}
          onMouseEnter={() => {
            if (tableHoverTimeoutRef.current) {
              clearTimeout(tableHoverTimeoutRef.current);
              tableHoverTimeoutRef.current = null;
            }
            if (rowBoundaryTimeoutRef.current) {
              clearTimeout(rowBoundaryTimeoutRef.current);
              rowBoundaryTimeoutRef.current = null;
            }
            if (colBoundaryTimeoutRef.current) {
              clearTimeout(colBoundaryTimeoutRef.current);
              colBoundaryTimeoutRef.current = null;
            }
          }}
          onMouseLeave={() => {
            if (tableHoverTimeoutRef.current) clearTimeout(tableHoverTimeoutRef.current);
            tableHoverTimeoutRef.current = window.setTimeout(() => {
              setActiveTable(null);
              setHoveredRowIndex(null);
              setHoveredColIndex(null);
              setHoveredRowBoundary(null);
              setHoveredColBoundary(null);
            }, 280);
          }}
        />
      )}

      {/* F) 다이어그램(Mermaid) PNG / SVG 저장 오버레이 (원칙 17: 본문 HTML 밖 오버레이) */}
      {hoveredMermaid && !menu && !cellEdit && (
        <div
          className="mermaid-export-overlay no-print fixed z-30 flex items-center gap-1"
          style={{
            top: Math.max(8, hoveredMermaid.rect.top + 4),
            right: Math.max(8, window.innerWidth - hoveredMermaid.rect.right + 52),
          }}
          onMouseEnter={() => {
            if (mermaidHoverTimeoutRef.current) {
              clearTimeout(mermaidHoverTimeoutRef.current);
              mermaidHoverTimeoutRef.current = null;
            }
          }}
          onMouseLeave={() => {
            if (mermaidHoverTimeoutRef.current) clearTimeout(mermaidHoverTimeoutRef.current);
            mermaidHoverTimeoutRef.current = window.setTimeout(() => {
              setHoveredMermaid(null);
              mermaidHoverTimeoutRef.current = null;
            }, 280);
          }}
        >
          <button
            type="button"
            onClick={() => {
              const svgEl = hoveredMermaid.wrapEl.querySelector<SVGSVGElement>('.mermaid-block svg');
              if (!svgEl) return;
              void downloadDiagramAsPng(svgEl, activeDoc?.name).catch(() => {
                toast('PNG 저장 중 오류가 발생했습니다.', 'error');
              });
            }}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs font-medium text-[var(--text)] shadow-sm hover:bg-[var(--hover)]"
          >
            PNG로 저장
          </button>
          <button
            type="button"
            onClick={() => {
              const svgEl = hoveredMermaid.wrapEl.querySelector<SVGSVGElement>('.mermaid-block svg');
              if (!svgEl) return;
              downloadDiagramAsSvg(svgEl, activeDoc?.name);
            }}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs font-medium text-[var(--text)] shadow-sm hover:bg-[var(--hover)]"
          >
            SVG로 저장
          </button>
        </div>
      )}

      {/* D) 이미지 모달 확대 보기 */}
      {lightbox && (
        <Suspense fallback={null}>
          <ErrorBoundary mode="modal" onClose={closeLightbox}>
            <ImageLightbox
              src={lightbox.src}
              alt={lightbox.alt ?? ''}
              onClose={closeLightbox}
              triggerElement={lightbox.triggerEl}
            />
          </ErrorBoundary>
        </Suspense>
      )}

      {cellEdit && (
        <input
          autoFocus
          className="fixed z-40 rounded border-2 border-[var(--accent)] bg-[var(--surface)] px-2 text-sm text-[var(--text)] shadow-lg outline-none"
          style={{
            top: cellEdit.rect.top,
            left: cellEdit.rect.left,
            width: Math.max(160, cellEdit.rect.width),
            height: Math.max(34, cellEdit.rect.height),
          }}
          value={cellEdit.value}
          onChange={(e) => setCellEdit({ ...cellEdit, value: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitCellEdit();
            if (e.key === 'Escape') {
              cancelEditRef.current = true;
              setCellEdit(null);
            }
          }}
          onBlur={commitCellEdit}
        />
      )}

      {menu && (
        <div
          className="fixed z-40 min-w-40 rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 text-sm shadow-xl"
          style={{ top: Math.min(menu.y, window.innerHeight - 160), left: Math.min(menu.x, window.innerWidth - 180) }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {menuItems.map(([label, op]) => (
            <button
              key={label}
              type="button"
              disabled={!op}
              onClick={() => {
                if (op) applyOp(menu, op);
                setMenu(null);
              }}
              className="block w-full px-3 py-1.5 text-left hover:bg-[var(--hover)] disabled:opacity-40 disabled:hover:bg-transparent"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
