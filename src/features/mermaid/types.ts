/**
 * 순서도(Flowchart) 모델 및 타입 정의
 * 핵심 원칙: React import 금지, 순수 데이터 구조
 */

export type FlowDirection = 'TD' | 'LR' | 'BT' | 'RL';

export type NodeShape = 'rect' | 'round' | 'rhombus' | 'circle' | 'stadium' | 'cylinder' | 'hexagon';

export type EdgeStyle = 'arrow' | 'line' | 'dotted' | 'thick';

export type NodeColor = 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple' | 'slate';
export type NodeBorder = 'solid' | 'dashed' | 'thick';

export interface FlowNode {
  id: string;
  label: string;
  shape: NodeShape;
  color?: NodeColor;
  border?: NodeBorder;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  style: EdgeStyle;
}

export const NODE_COLOR_DEFS: Record<NodeColor, { fill: string; stroke: string; color: string; classDef: string; label: string }> = {
  indigo: { fill: '#e0e7ff', stroke: '#6366f1', color: '#1e1b4b', classDef: 'fill:#e0e7ff,stroke:#6366f1,color:#1e1b4b', label: '남색' },
  emerald: { fill: '#d1fae5', stroke: '#10b981', color: '#064e3b', classDef: 'fill:#d1fae5,stroke:#10b981,color:#064e3b', label: '초록' },
  amber: { fill: '#fef3c7', stroke: '#f59e0b', color: '#78350f', classDef: 'fill:#fef3c7,stroke:#f59e0b,color:#78350f', label: '노랑' },
  rose: { fill: '#ffe4e6', stroke: '#f43f5e', color: '#881337', classDef: 'fill:#ffe4e6,stroke:#f43f5e,color:#881337', label: '빨강' },
  purple: { fill: '#f3e8ff', stroke: '#a855f7', color: '#581c87', classDef: 'fill:#f3e8ff,stroke:#a855f7,color:#581c87', label: '보라' },
  slate: { fill: '#e2e8f0', stroke: '#64748b', color: '#0f172a', classDef: 'fill:#e2e8f0,stroke:#64748b,color:#0f172a', label: '회색' },
};

export const NODE_BORDER_DEFS: Record<Exclude<NodeBorder, 'solid'>, { classDef: string; label: string }> = {
  dashed: { classDef: 'stroke-dasharray:5 5', label: '점선' },
  thick: { classDef: 'stroke-width:3px', label: '굵게' },
};

export interface FlowchartModel {
  direction: FlowDirection;
  nodes: FlowNode[];
  edges: FlowEdge[];
  preservedLines: string[];
}

export type ParseResult =
  | { ok: true; model: FlowchartModel }
  | { ok: false; reason: 'subgraph' | 'unsupported'; message: string };
