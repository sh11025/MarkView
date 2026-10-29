import React, { useState } from 'react';
import type { FlowDirection } from '../../../features/mermaid';
import { DIAGRAM_EXAMPLES, type DiagramExample } from '../../../constants/diagramExamples';
import {
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  Eye,
  EyeOff,
  LayoutGrid,
  ChevronDown,
} from 'lucide-react';

interface CanvasToolbarProps {
  direction: FlowDirection;
  onDirectionChange: (dir: FlowDirection) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onRedo?: () => void;
  canRedo?: boolean;
  onAutoLayout: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onZoomFit: () => void;
  onSelectExample: (example: DiagramExample) => void;
  showPreview: boolean;
  onTogglePreview: () => void;
}

const DIRECTIONS: { value: FlowDirection; label: string }[] = [
  { value: 'TD', label: '세로 (TD)' },
  { value: 'LR', label: '가로 (LR)' },
  { value: 'BT', label: '아래→위 (BT)' },
  { value: 'RL', label: '오른쪽→왼쪽 (RL)' },
];

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  direction,
  onDirectionChange,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  onAutoLayout,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onZoomFit,
  onSelectExample,
  showPreview,
  onTogglePreview,
}) => {
  const [exampleMenuOpen, setExampleMenuOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs">
      {/* 좌측: 방향, 되돌리기/다시실행, 자동정돈 */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {/* 진행 방향 */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-[var(--muted)]">방향</span>
          <select
            value={direction}
            onChange={(e) => onDirectionChange(e.target.value as FlowDirection)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-semibold text-[var(--text)] outline-none cursor-pointer"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
            aria-label="다이어그램 진행 방향"
          >
            {DIRECTIONS.map((d) => (
              <option key={d.value} value={d.value} className="bg-[var(--surface)] text-[var(--text)]">
                {d.label}
              </option>
            ))}
          </select>
        </div>

        {/* 되돌리기 / 다시 실행 */}
        <div className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="되돌리기 (Undo)"
            aria-label="되돌리기"
            className="rounded p-1 text-[var(--text)] hover:bg-[var(--hover)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Undo2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="다시 실행 (Redo)"
            aria-label="다시 실행"
            className="rounded p-1 text-[var(--text)] hover:bg-[var(--hover)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Redo2 className="size-3.5" />
          </button>
        </div>

        {/* 자동 정돈 */}
        <button
          type="button"
          onClick={onAutoLayout}
          title="노드 위치를 보기 좋게 자동 재배치합니다"
          aria-label="자동 정돈"
          className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text)] hover:bg-[var(--hover)] shadow-xs"
        >
          <LayoutGrid className="size-3.5 text-[var(--accent)]" />
          <span>자동 정돈</span>
        </button>

        {/* 예시로 시작 드롭다운 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setExampleMenuOpen(!exampleMenuOpen)}
            className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text)] hover:bg-[var(--hover)] shadow-xs"
            aria-expanded={exampleMenuOpen}
            aria-haspopup="true"
            aria-label="예시로 시작"
          >
            <Sparkles className="size-3.5 text-amber-500" />
            <span>예시로 시작</span>
            <ChevronDown className="size-3 text-[var(--muted)]" />
          </button>

          {exampleMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setExampleMenuOpen(false)}
              />
              <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 shadow-xl">
                <div className="px-2 py-1 text-[11px] font-semibold text-[var(--muted)]">템플릿 예시 선택</div>
                {DIAGRAM_EXAMPLES.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => {
                      setExampleMenuOpen(false);
                      onSelectExample(ex);
                    }}
                    className="flex w-full flex-col items-start rounded px-2 py-1.5 text-left hover:bg-[var(--hover)]"
                  >
                    <span className="text-xs font-semibold text-[var(--text)]">{ex.name}</span>
                    <span className="text-[10px] text-[var(--muted)] line-clamp-1">{ex.description}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 우측: 줌 컨트롤 & 문서 모양 보기 토글 */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {/* 줌 컨트롤 */}
        <div className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
          <button
            type="button"
            onClick={onZoomOut}
            title="축소"
            aria-label="축소"
            className="rounded p-1 text-[var(--text)] hover:bg-[var(--hover)]"
          >
            <ZoomOut className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onZoomReset}
            title="100% 크기로 리셋"
            aria-label="100% 크기로 리셋"
            className="w-12 px-1 text-center font-mono text-[11px] font-medium text-[var(--text)] hover:bg-[var(--hover)] rounded"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            title="확대"
            aria-label="확대"
            className="rounded p-1 text-[var(--text)] hover:bg-[var(--hover)]"
          >
            <ZoomIn className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onZoomFit}
            title="화면 맞춤"
            aria-label="화면 맞춤"
            className="rounded p-1 text-[var(--text)] hover:bg-[var(--hover)] ml-0.5 border-l border-[var(--border)]"
          >
            <Maximize2 className="size-3.5" />
          </button>
        </div>

        {/* 문서 모양 보기 토글 */}
        <button
          type="button"
          onClick={onTogglePreview}
          title={showPreview ? '문서 미리보기 숨기기' : '문서 미리보기 표시'}
          aria-label={showPreview ? '문서 미리보기 숨기기' : '문서 미리보기 표시'}
          className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
            showPreview
              ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
              : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--hover)]'
          }`}
        >
          {showPreview ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          <span className="hidden sm:inline">문서 모양 보기</span>
        </button>
      </div>
    </div>
  );
};
