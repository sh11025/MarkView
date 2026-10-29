import React, { useState, useRef, useEffect } from 'react';
import type { FlowEdge } from '../../../features/mermaid';
import type { NodeLayout } from './types';

interface CanvasEdgeProps {
  edge: FlowEdge;
  fromLayout?: NodeLayout;
  toLayout?: NodeLayout;
  isSelected: boolean;
  isEditing: boolean;
  isOppositePair?: boolean;
  onSelect: (edgeId: string) => void;
  onStartEdit: (edgeId: string) => void;
  onFinishEdit: (edgeId: string, newLabel: string) => void;
  onCancelEdit: () => void;
}

export const CanvasEdge: React.FC<CanvasEdgeProps> = ({
  edge,
  fromLayout,
  toLayout,
  isSelected,
  isEditing,
  isOppositePair,
  onSelect,
  onStartEdit,
  onFinishEdit,
  onCancelEdit,
}) => {
  const [editValue, setEditValue] = useState(edge.label || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(edge.label || '');
  }, [edge.label]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  if (!fromLayout || !toLayout) return null;

  const isSelf = edge.from === edge.to;
  let pathD = '';
  let midX = 0;
  let midY = 0;

  if (isSelf) {
    // 자기 자신으로의 루프
    const x = fromLayout.x;
    const y = fromLayout.y - fromLayout.height / 2;
    pathD = `M ${x - 20} ${y} C ${x - 45} ${y - 45}, ${x + 45} ${y - 45}, ${x + 20} ${y}`;
    midX = x;
    midY = y - 35;
  } else {
    // 일반 노드 간 연결선
    const dx = toLayout.x - fromLayout.x;
    const dy = toLayout.y - fromLayout.y;
    const dist = Math.hypot(dx, dy) || 1;

    // 시작 노드 테두리 접점 추정
    const fromEdgeX = fromLayout.x + (dx / dist) * (fromLayout.width / 2);
    const fromEdgeY = fromLayout.y + (dy / dist) * (fromLayout.height / 2);

    // 끝 노드 테두리 접점 추정
    const toEdgeX = toLayout.x - (dx / dist) * (toLayout.width / 2);
    const toEdgeY = toLayout.y - (dy / dist) * (toLayout.height / 2);

    // 반대 방향 엣지가 있을 경우 곡률(curve) 부여
    if (isOppositePair) {
      const normalX = -dy / dist;
      const normalY = dx / dist;
      const curveOffset = 30;
      const cx = (fromEdgeX + toEdgeX) / 2 + normalX * curveOffset;
      const cy = (fromEdgeY + toEdgeY) / 2 + normalY * curveOffset;

      pathD = `M ${fromEdgeX} ${fromEdgeY} Q ${cx} ${cy} ${toEdgeX} ${toEdgeY}`;
      midX = cx;
      midY = cy;
    } else {
      pathD = `M ${fromEdgeX} ${fromEdgeY} L ${toEdgeX} ${toEdgeY}`;
      midX = (fromEdgeX + toEdgeX) / 2;
      midY = (fromEdgeY + toEdgeY) / 2;
    }
  }

  const strokeColor = isSelected ? 'var(--accent)' : 'var(--muted)';
  const strokeWidth = edge.style === 'thick' ? 3.5 : isSelected ? 2.5 : 1.5;
  const strokeDasharray = edge.style === 'dotted' ? '4,4' : undefined;

  // 화살표 머리 마커 ID
  const markerEnd = edge.style !== 'line' ? `url(#arrowhead-${isSelected ? 'selected' : 'normal'})` : undefined;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onFinishEdit(edge.id, editValue);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelEdit();
    }
  };

  return (
    <g
      data-edge-id={edge.id}
      aria-label={edge.label ? `${edge.from}에서 ${edge.to}로 (${edge.label})` : `${edge.from}에서 ${edge.to}로`}
      className="cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(edge.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onStartEdit(edge.id);
      }}
    >
      {/* 클릭 판정 범위를 넓히기 위한 투명 패스 */}
      <path
        d={pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={14}
        className="cursor-pointer"
      />

      {/* 실제 렌더링 패스 */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        markerEnd={markerEnd}
        className="transition-colors"
      />

      {/* 인라인 라벨 편집 알약 (편집 모드 시) */}
      {isEditing && (
        <foreignObject
          x={midX - 70}
          y={midY - 14}
          width={140}
          height={28}
          className="overflow-visible z-50"
        >
          <div className="flex items-center justify-center size-full">
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => onFinishEdit(edge.id, editValue)}
              placeholder="라벨 입력"
              className="w-28 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-center text-[11px] text-[var(--text)] outline-none ring-1 ring-[var(--accent)] shadow-md"
            />
          </div>
        </foreignObject>
      )}
    </g>
  );
};
