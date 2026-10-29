import React from 'react';
import type { EdgeStyle, FlowEdge, FlowNode, NodeBorder, NodeColor, NodeShape } from '../../../features/mermaid';
import { computeFloatingBarPosition } from '../../../features/mermaid/floatingPosition';
import type { NodeLayout } from './types';
import { Trash2 } from 'lucide-react';

interface CanvasFloatingBarProps {
  selectedNode?: FlowNode;
  selectedEdge?: FlowEdge;
  nodeLayout?: NodeLayout;
  otherNodes?: NodeLayout[];
  canvasBounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onUpdateEdge: (edgeId: string, patch: Partial<FlowEdge>) => void;
  onDeleteEdge: (edgeId: string) => void;
}

const SHAPES: { value: NodeShape; label: string }[] = [
  { value: 'rect', label: '직사각형' },
  { value: 'round', label: '둥근모서리' },
  { value: 'rhombus', label: '마름모' },
  { value: 'circle', label: '원' },
  { value: 'cylinder', label: '원통' },
  { value: 'hexagon', label: '육각형' },
];

const COLORS: { value: NodeColor | 'none'; label: string; fill: string; stroke: string }[] = [
  { value: 'none', label: '기본 (없음)', fill: '#ffffff', stroke: '#94a3b8' },
  { value: 'indigo', label: '남색', fill: '#e0e7ff', stroke: '#6366f1' },
  { value: 'emerald', label: '초록', fill: '#d1fae5', stroke: '#10b981' },
  { value: 'amber', label: '노랑', fill: '#fef3c7', stroke: '#f59e0b' },
  { value: 'rose', label: '빨강', fill: '#ffe4e6', stroke: '#f43f5e' },
  { value: 'purple', label: '보라', fill: '#f3e8ff', stroke: '#a855f7' },
  { value: 'slate', label: '회색', fill: '#e2e8f0', stroke: '#64748b' },
];

const BORDERS: { value: NodeBorder; label: string }[] = [
  { value: 'solid', label: '실선' },
  { value: 'dashed', label: '점선' },
  { value: 'thick', label: '굵게' },
];

const EDGE_STYLES: { value: EdgeStyle; label: string }[] = [
  { value: 'arrow', label: '화살표 (-->)' },
  { value: 'line', label: '실선 (---)' },
  { value: 'dotted', label: '점선 (-.->)' },
  { value: 'thick', label: '굵은선 (==>)' },
];

export const CanvasFloatingBar: React.FC<CanvasFloatingBarProps> = ({
  selectedNode,
  selectedEdge,
  nodeLayout,
  otherNodes = [],
  canvasBounds,
  onUpdateNode,
  onDeleteNode,
  onUpdateEdge,
  onDeleteEdge,
}) => {
  if (selectedNode && nodeLayout) {
    const pos = computeFloatingBarPosition({
      selectedNode: nodeLayout,
      otherNodes,
      canvasBounds,
      barWidth: 320,
      barHeight: 44,
    });
    const left = pos.x;
    const top = pos.y - 22; // -translate-x-1/2에 맞춰 y도 박스 상단 기준으로 배치

    return (
      <div
        data-floating-bar="node"
        className="absolute z-40 -translate-x-1/2 flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-lg text-xs pointer-events-auto"
        style={{ left: `${left}px`, top: `${top}px` }}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 모양 선택 */}
        <select
          value={selectedNode.shape}
          onChange={(e) => onUpdateNode(selectedNode.id, { shape: e.target.value as NodeShape })}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-xs text-[var(--text)] outline-none"
          title="도형 모양 변경"
          aria-label="도형 모양 변경"
        >
          {SHAPES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {/* 색상 선택 (팔레트 버튼들) */}
        <div className="flex items-center gap-1.5 px-1">
          {COLORS.map((c) => {
            const isCurrent = (selectedNode.color || 'none') === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => onUpdateNode(selectedNode.id, { color: c.value === 'none' ? undefined : c.value })}
                title={c.label}
                aria-label={`색상: ${c.label}`}
                className={`size-5 rounded-full border transition-transform cursor-pointer ${
                  isCurrent ? 'scale-125 ring-2 ring-[var(--accent)]' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c.fill, borderColor: c.stroke }}
              />
            );
          })}
        </div>

        {/* 테두리 스타일 선택 */}
        <select
          value={selectedNode.border || 'solid'}
          onChange={(e) => onUpdateNode(selectedNode.id, { border: e.target.value as NodeBorder })}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-xs text-[var(--text)] outline-none"
          title="테두리 스타일 변경"
          aria-label="테두리 스타일 변경"
        >
          {BORDERS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>

        {/* 노드 삭제 버튼 */}
        <button
          type="button"
          onClick={() => onDeleteNode(selectedNode.id)}
          title="단계 삭제 (Delete)"
          aria-label="단계 삭제"
          className="rounded p-1 text-error hover:bg-error/10"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    );
  }

  if (selectedEdge) {
    return (
      <div
        className="absolute bottom-10 left-1/2 z-40 -translate-x-1/2 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 shadow-lg text-xs"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span className="font-medium text-[var(--muted)]">연결선:</span>
        <select
          value={selectedEdge.style}
          onChange={(e) => onUpdateEdge(selectedEdge.id, { style: e.target.value as EdgeStyle })}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-xs text-[var(--text)] outline-none"
          title="화살표 종류"
          aria-label="화살표 종류"
        >
          {EDGE_STYLES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => onDeleteEdge(selectedEdge.id)}
          title="연결선 삭제 (Delete)"
          aria-label="연결선 삭제"
          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-error hover:bg-error/10"
        >
          <Trash2 className="size-3.5" />
          <span>삭제</span>
        </button>
      </div>
    );
  }

  return null;
};
