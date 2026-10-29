import React from 'react';
import type { EdgeStyle, FlowchartModel, FlowDirection, NodeShape } from '../../features/mermaid';
import {
  addNode,
  removeNode,
  updateNode,
  addEdge,
  removeEdge,
  updateEdge,
  setDirection,
  moveNode,
} from '../../features/mermaid';

interface MermaidVisualTabProps {
  model: FlowchartModel;
  onChange: (next: FlowchartModel) => void;
  onUndo?: () => void;
  canUndo?: boolean;
}

const DIRECTIONS: { value: FlowDirection; label: string }[] = [
  { value: 'TD', label: '위 → 아래 (TD)' },
  { value: 'LR', label: '왼쪽 → 오른쪽 (LR)' },
  { value: 'BT', label: '아래 → 위 (BT)' },
  { value: 'RL', label: '오른쪽 → 왼쪽 (RL)' },
];

const SHAPES: { value: NodeShape; label: string }[] = [
  { value: 'rect', label: '직사각형 [ ]' },
  { value: 'round', label: '둥근 모서리 ( )' },
  { value: 'rhombus', label: '마름모 { }' },
  { value: 'circle', label: '원 (( ))' },
  { value: 'stadium', label: '경기장 ([ ])' },
  { value: 'cylinder', label: '원통 [( )]' },
  { value: 'hexagon', label: '육각형 {{ }}' },
];

const EDGE_STYLES: { value: EdgeStyle; label: string }[] = [
  { value: 'arrow', label: '화살표 (-->)' },
  { value: 'line', label: '실선 (---)' },
  { value: 'dotted', label: '점선 (-.->)' },
  { value: 'thick', label: '굵은선 (==>)' },
];

export const MermaidVisualTab: React.FC<MermaidVisualTabProps> = ({ model, onChange, onUndo, canUndo }) => {
  return (
    <div className="space-y-6">
      {/* 상단 툴바: 방향 및 되돌리기 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-2">
          <label htmlFor="mermaid-dir" className="text-xs font-semibold text-[var(--muted)]">
            진행 방향
          </label>
          <select
            id="mermaid-dir"
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            value={model.direction}
            onChange={(e) => onChange(setDirection(model, e.target.value as FlowDirection))}
          >
            {DIRECTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        {onUndo && (
          <button
            type="button"
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--text)] hover:bg-[var(--hover)] disabled:opacity-40"
            disabled={!canUndo}
            onClick={onUndo}
            title="이전 단계로 되돌리기"
          >
            ↶ 되돌리기
          </button>
        )}
      </div>

      {/* 단계(노드) 목록 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
            단계 목록 ({model.nodes.length})
          </h4>
          <button
            type="button"
            className="rounded bg-[var(--accent)]/10 px-2 py-1 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent)]/20"
            onClick={() => onChange(addNode(model))}
          >
            + 단계 추가
          </button>
        </div>

        <div className="space-y-2">
          {model.nodes.map((node, idx) => (
            <div
              key={node.id}
              className="flex flex-wrap items-center gap-2 rounded border border-[var(--border)] bg-[var(--surface-2)] p-2 text-xs"
            >
              <span className="w-10 font-mono text-[11px] text-[var(--muted)] truncate" title={node.id}>
                {node.id}
              </span>
              <input
                type="text"
                className="min-w-[120px] flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                placeholder="단계 이름 입력"
                value={node.label}
                onChange={(e) => onChange(updateNode(model, node.id, { label: e.target.value }))}
              />
              <select
                className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                value={node.shape}
                onChange={(e) => onChange(updateNode(model, node.id, { shape: e.target.value as NodeShape }))}
              >
                {SHAPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded p-1 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-30"
                  disabled={idx === 0}
                  onClick={() => onChange(moveNode(model, idx, idx - 1))}
                  title="위로 이동"
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="rounded p-1 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-30"
                  disabled={idx === model.nodes.length - 1}
                  onClick={() => onChange(moveNode(model, idx, idx + 1))}
                  title="아래로 이동"
                >
                  ▼
                </button>
                <button
                  type="button"
                  className="rounded px-1.5 py-1 text-xs text-error hover:bg-error/10"
                  onClick={() => onChange(removeNode(model, node.id))}
                  title="단계 삭제"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
          {model.nodes.length === 0 && (
            <p className="py-4 text-center text-xs text-[var(--muted)]">등록된 단계가 없습니다. 단계를 추가해 보세요.</p>
          )}
        </div>
      </div>

      {/* 연결(엣지) 목록 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
            연결선 목록 ({model.edges.length})
          </h4>
          <button
            type="button"
            className="rounded bg-[var(--accent)]/10 px-2 py-1 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent)]/20 disabled:opacity-40"
            disabled={model.nodes.length < 2}
            onClick={() => {
              if (model.nodes.length < 2) return;
              onChange(
                addEdge(model, {
                  from: model.nodes[0].id,
                  to: model.nodes[1].id,
                  style: 'arrow',
                }),
              );
            }}
          >
            + 연결 추가
          </button>
        </div>

        <div className="space-y-2">
          {model.edges.map((edge) => (
            <div
              key={edge.id}
              className="flex flex-wrap items-center gap-2 rounded border border-[var(--border)] bg-[var(--surface-2)] p-2 text-xs"
            >
              <select
                className="max-w-[120px] rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                value={edge.from}
                onChange={(e) => onChange(updateEdge(model, edge.id, { from: e.target.value }))}
              >
                {model.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label ? `${n.id}: ${n.label}` : n.id}
                  </option>
                ))}
              </select>
              <select
                className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                value={edge.style}
                onChange={(e) => onChange(updateEdge(model, edge.id, { style: e.target.value as EdgeStyle }))}
              >
                {EDGE_STYLES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                className="max-w-[120px] rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                value={edge.to}
                onChange={(e) => onChange(updateEdge(model, edge.id, { to: e.target.value }))}
              >
                {model.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label ? `${n.id}: ${n.label}` : n.id}
                  </option>
                ))}
              </select>
              <input
                type="text"
                className="min-w-[80px] flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                placeholder="라벨 (선택)"
                value={edge.label ?? ''}
                onChange={(e) => onChange(updateEdge(model, edge.id, { label: e.target.value }))}
              />
              <button
                type="button"
                className="rounded px-1.5 py-1 text-xs text-error hover:bg-error/10"
                onClick={() => onChange(removeEdge(model, edge.id))}
                title="연결 삭제"
              >
                삭제
              </button>
            </div>
          ))}
          {model.edges.length === 0 && (
            <p className="py-4 text-center text-xs text-[var(--muted)]">연결된 선이 없습니다. 연결을 추가해 보세요.</p>
          )}
        </div>
      </div>
    </div>
  );
};
