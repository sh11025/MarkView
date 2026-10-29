import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useUi, toast } from '../../stores/ui';
import { useDocuments } from '../../stores/documents';
import { getLines, replaceLines } from '../../editor/editorRegistry';
import { parseFlowchart, serializeFlowchart, canApplyChanges, type FlowchartModel } from '../../features/mermaid';
import { downloadDiagramAsPng } from '../../features/mermaid/exportDiagram';
import { renderMermaid } from '../../render/mermaid';
import { MermaidVisualTab } from './MermaidVisualTab';
import { MermaidPreview } from './MermaidPreview';
import { MermaidCanvas } from './canvas/MermaidCanvas';

export type MermaidEditorTab = 'canvas' | 'list' | 'code';

export const MermaidEditor: React.FC = () => {
  const target = useUi((s) => s.mermaidEditorTarget);
  const close = useUi((s) => s.closeMermaidEditor);

  const initialCode = useMemo(() => target?.initialCode.trim() ?? '', [target]);
  const [code, setCode] = useState<string>(initialCode);
  const [activeTab, setActiveTab] = useState<MermaidEditorTab>('canvas');
  const [history, setHistory] = useState<FlowchartModel[]>([]);
  const [future, setFuture] = useState<FlowchartModel[]>([]);
  const [showPreview, setShowPreview] = useState<boolean>(false);

  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);

  // 초기 코드 파싱 결과
  const parseResult = useMemo(() => parseFlowchart(code), [code]);
  const [currentModel, setCurrentModel] = useState<FlowchartModel | null>(() => {
    const res = parseFlowchart(initialCode);
    return res.ok ? res.model : null;
  });

  // 타겟이 열릴 때 상태 초기화 및 포커스·스크롤 제어
  useEffect(() => {
    if (target) {
      // 더블클릭 진입 등으로 인해 브라우저에 남아있는 텍스트 선택 영역 해제
      window.getSelection()?.removeAllRanges();
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = 'hidden';

      const trimmed = target.initialCode.trim();
      setCode(trimmed);
      setHistory([]);
      setFuture([]);
      setShowPreview(false);

      const res = parseFlowchart(trimmed);
      if (res.ok) {
        setCurrentModel(res.model);
        setActiveTab('canvas');
      } else {
        setCurrentModel(null);
        setActiveTab('code');
      }

      // 모달 컨테이너 및 닫기 버튼으로 포커스 이동 (WAI-ARIA 모달 패턴 및 전역 Esc 키 수신 보장)
      modalContainerRef.current?.focus();
      requestAnimationFrame(() => {
        const closeBtn = modalContainerRef.current?.querySelector<HTMLElement>('button[aria-label="닫기"]');
        if (closeBtn) {
          closeBtn.focus();
        } else {
          modalContainerRef.current?.focus();
        }
      });
    } else {
      document.body.style.overflow = '';
      previousActiveElementRef.current?.focus();
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [target]);

  const isVisualSupported = parseResult.ok;
  const hasChanges = code.trim() !== initialCode;

  // 닫기 시도 (변경사항 있으면 confirm)
  const handleRequestClose = () => {
    if (hasChanges && !window.confirm('저장하지 않은 변경사항이 있습니다. 닫으시겠습니까?')) {
      return;
    }
    document.body.style.overflow = '';
    close();
    previousActiveElementRef.current?.focus();
  };

  // 전역 Esc 키 처리
  useEffect(() => {
    if (!target) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleRequestClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [target, hasChanges, handleRequestClose]);

  // 모델 변경 핸들러 (캔버스 및 목록 탭에서 공유)
  const handleModelChange = (nextModel: FlowchartModel) => {
    if (currentModel) {
      setHistory((prev) => [...prev.slice(-30), currentModel]);
      setFuture([]);
    }
    setCurrentModel(nextModel);
    const newCode = serializeFlowchart(nextModel);
    setCode(newCode);
  };

  // 실행 취소 (Undo) 핸들러
  const handleUndo = () => {
    if (history.length === 0 || !currentModel) return;
    const prevModel = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setFuture((prev) => [currentModel, ...prev]);
    setCurrentModel(prevModel);
    setCode(serializeFlowchart(prevModel));
  };

  // 다시 실행 (Redo) 핸들러
  const handleRedo = () => {
    if (future.length === 0 || !currentModel) return;
    const nextModel = future[0];
    setFuture((prev) => prev.slice(1));
    setHistory((prev) => [...prev, currentModel]);
    setCurrentModel(nextModel);
    setCode(serializeFlowchart(nextModel));
  };

  // 코드 직접 수정 핸들러
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    const res = parseFlowchart(newCode);
    if (res.ok) {
      setCurrentModel(res.model);
    }
  };

  // 적용 핸들러
  const handleApply = () => {
    if (!target) return;
    const currentLines = getLines(target.startLine, target.endLine);
    if (!canApplyChanges(target.originalLines, currentLines, 0, currentLines.length)) {
      toast('문서가 외부에서 변경되어 적용할 수 없습니다.', 'error');
      return;
    }

    const newCodeTrimmed = code.trim();
    // 코드가 변경되지 않은 경우(예: 캔버스에서 노드 위치만 옮긴 경우) 문서를 건드리지 않고 닫음
    if (newCodeTrimmed === initialCode.trim()) {
      document.body.style.overflow = '';
      close();
      previousActiveElementRef.current?.focus();
      return;
    }

    const newLines = newCodeTrimmed.split('\n');
    replaceLines(target.startLine, target.endLine, newLines);
    document.body.style.overflow = '';
    close();
    previousActiveElementRef.current?.focus();
  };

  // PNG로 저장 핸들러
  const handleSavePng = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      toast('저장할 다이어그램 코드가 없습니다.', 'error');
      return;
    }
    try {
      const res = await renderMermaid(trimmed, 'light');
      if ('error' in res) {
        toast('다이어그램 문법 오류가 있어 PNG로 저장할 수 없습니다.', 'error');
        return;
      }
      const holder = document.createElement('div');
      holder.innerHTML = res.svg;
      const svgEl = holder.querySelector<SVGSVGElement>('svg');
      if (!svgEl) {
        toast('다이어그램 SVG를 생성하지 못했습니다.', 'error');
        return;
      }
      const docName = target ? useDocuments.getState().docs[target.docId]?.name : undefined;
      await downloadDiagramAsPng(svgEl, docName);
    } catch {
      toast('PNG 저장 중 오류가 발생했습니다.', 'error');
    }
  };

  return (
    <div
      ref={modalContainerRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-5 backdrop-blur-sm outline-none"
      onClick={(e) => e.target === e.currentTarget && handleRequestClose()}
      role="dialog"
      aria-modal="true"
      aria-label="다이어그램 편집"
    >
      <div className="relative flex flex-col w-full max-w-6xl max-h-[94vh] rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-clip">
        {/* 헤더 */}
        <div className="flex flex-wrap items-center justify-between border-b border-[var(--border)] px-4 py-3 bg-[var(--surface-2)] gap-2">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-[var(--text)]">다이어그램 편집</h3>

            {/* 탭 전환 (캔버스 / 목록 / 코드) */}
            <div
              className="flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5 text-xs"
              role="tablist"
              aria-label="편집 모드 탭"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'canvas'}
                className={`rounded px-3 py-1 font-medium transition-colors ${
                  activeTab === 'canvas'
                    ? 'bg-[var(--accent)] text-white'
                    : isVisualSupported
                      ? 'text-[var(--text)] hover:bg-[var(--hover)]'
                      : 'text-[var(--muted)] opacity-40 cursor-not-allowed'
                }`}
                disabled={!isVisualSupported}
                onClick={() => isVisualSupported && setActiveTab('canvas')}
                title={!isVisualSupported ? '순서도만 캔버스 편집을 지원합니다.' : '마우스로 자유롭게 배치하는 캔버스'}
              >
                캔버스
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'list'}
                className={`rounded px-3 py-1 font-medium transition-colors ${
                  activeTab === 'list'
                    ? 'bg-[var(--accent)] text-white'
                    : isVisualSupported
                      ? 'text-[var(--text)] hover:bg-[var(--hover)]'
                      : 'text-[var(--muted)] opacity-40 cursor-not-allowed'
                }`}
                disabled={!isVisualSupported}
                onClick={() => isVisualSupported && setActiveTab('list')}
                title={!isVisualSupported ? '순서도만 목록 편집을 지원합니다.' : '키보드 및 스크린리더를 위한 단계별 목록 편집'}
              >
                목록
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'code'}
                className={`rounded px-3 py-1 font-medium transition-colors ${
                  activeTab === 'code' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text)] hover:bg-[var(--hover)]'
                }`}
                onClick={() => setActiveTab('code')}
                title="직접 Mermaid 마크다운 코드 입력"
              >
                코드
              </button>
            </div>
          </div>

          <button
            type="button"
            className="rounded p-1 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
            onClick={handleRequestClose}
            title="닫기"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 본문 콘텐츠 영역 */}
        <div className="flex-1 min-h-[360px] h-[68vh] flex flex-col overflow-clip">
          {activeTab === 'canvas' ? (
            currentModel ? (
              <div className={`flex flex-1 min-h-0 w-full h-full ${showPreview ? 'flex-col md:flex-row' : 'flex-col'}`}>
                <div className={`flex flex-1 min-h-0 w-full h-full flex-col ${showPreview ? 'md:w-3/5 border-b md:border-b-0 md:border-r border-[var(--border)]' : ''}`}>
                  <MermaidCanvas
                    model={currentModel}
                    onChange={handleModelChange}
                    onUndo={handleUndo}
                    canUndo={history.length > 0}
                    onRedo={handleRedo}
                    canRedo={future.length > 0}
                    showPreview={showPreview}
                    onTogglePreview={() => setShowPreview(!showPreview)}
                  />
                </div>
                {showPreview && (
                  <div className="h-64 md:h-full md:w-2/5 p-3 overflow-auto bg-[var(--surface-2)]">
                    <MermaidPreview code={code} />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-[var(--muted)]">
                순서도 모델을 불러올 수 없습니다. 코드 탭에서 편집해주세요.
              </div>
            )
          ) : activeTab === 'list' ? (
            <div className="grid flex-1 grid-cols-1 md:grid-cols-2 gap-4 p-4 overflow-y-auto min-h-0">
              <div className="flex flex-col min-h-[300px] overflow-y-auto pr-1">
                {currentModel ? (
                  <MermaidVisualTab
                    model={currentModel}
                    onChange={handleModelChange}
                    onUndo={handleUndo}
                    canUndo={history.length > 0}
                  />
                ) : (
                  <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-[var(--muted)]">
                    순서도 모델을 불러올 수 없습니다. 코드 탭에서 편집해주세요.
                  </div>
                )}
              </div>
              <div className="flex flex-col min-h-[300px]">
                <MermaidPreview code={code} />
              </div>
            </div>
          ) : (
            <div className="grid flex-1 grid-cols-1 md:grid-cols-2 gap-4 p-4 overflow-y-auto min-h-0">
              <div className="flex flex-1 flex-col min-h-[300px]">
                {!parseResult.ok && (
                  <div className="mb-2 rounded border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
                    {parseResult.message}
                  </div>
                )}
                <label htmlFor="mermaid-code-input" className="sr-only">
                  Mermaid 코드
                </label>
                <textarea
                  id="mermaid-code-input"
                  className="flex-1 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 font-mono text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="Mermaid 다이어그램 코드를 입력하세요"
                  rows={14}
                />
              </div>
              <div className="flex flex-col min-h-[300px]">
                <MermaidPreview code={code} />
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex flex-wrap items-center justify-between border-t border-[var(--border)] px-4 py-2.5 bg-[var(--surface-2)] gap-2">
          <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
            <span>{hasChanges ? '수정된 내용이 있습니다.' : '내용이 변경되지 않았습니다.'}</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">키보드/스크린리더 이용자는 '목록' 탭을 사용할 수 있습니다.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--hover)]"
              onClick={() => void handleSavePng()}
            >
              PNG로 저장
            </button>
            <button
              type="button"
              className="rounded-lg border border-[var(--border)] px-3.5 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--hover)]"
              onClick={handleRequestClose}
            >
              취소
            </button>
            <button
              type="button"
              className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 shadow-sm"
              onClick={handleApply}
            >
              적용
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MermaidEditor;
