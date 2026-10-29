import React, { useState, useRef, useEffect } from 'react';
import type { FlowNode } from '../../../features/mermaid';
import { NODE_COLOR_DEFS } from '../../../features/mermaid';
import type { NodeLayout, QuickAddDirection, PortDirection } from './types';
import { Plus } from 'lucide-react';

interface CanvasNodeProps {
  node: FlowNode;
  layout: NodeLayout;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: (nodeId: string) => void;
  onStartEdit: (nodeId: string) => void;
  onFinishEdit: (nodeId: string, newLabel: string) => void;
  onCancelEdit: () => void;
  onStartDrag: (nodeId: string, e: React.PointerEvent) => void;
  onStartConnect: (nodeId: string, port: PortDirection, e: React.PointerEvent | React.MouseEvent) => void;
  onQuickAdd: (nodeId: string, dir: QuickAddDirection) => void;
}

// 노드 본체 외곽으로 + 버튼과 포트가 위치하는 안전 여백 (hit-box 연속성 보장)
const HIT_PADDING = 28;

export const CanvasNode: React.FC<CanvasNodeProps> = ({
  node,
  layout,
  isSelected,
  isEditing,
  onSelect,
  onStartEdit,
  onFinishEdit,
  onCancelEdit,
  onStartDrag,
  onStartConnect,
  onQuickAdd,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [editValue, setEditValue] = useState(node.label);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditValue(node.label);
  }, [node.label]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const { width, height, x, y } = layout;
  const left = x - width / 2;
  const top = y - height / 2;

  // 색상 및 테두리 계산
  const colorDef = node.color ? NODE_COLOR_DEFS[node.color] : null;
  const fillColor = colorDef ? colorDef.fill : 'var(--surface)';
  const strokeColor = colorDef ? colorDef.stroke : isSelected ? 'var(--accent)' : 'var(--border)';
  const textColor = colorDef ? colorDef.color : 'var(--text)';

  const strokeWidth = node.border === 'thick' ? 3 : isSelected ? 2.5 : 1.5;
  const strokeDasharray = node.border === 'dashed' ? '5,5' : undefined;

  // 모양별 SVG 렌더링
  const renderShapeSvg = () => {
    const pad = strokeWidth;
    const w = width - pad * 2;
    const h = height - pad * 2;
    const shape = node.shape;

    switch (shape) {
      case 'rhombus':
        return (
          <polygon
            points={`${width / 2},${pad} ${width - pad},${height / 2} ${width / 2},${height - pad} ${pad},${height / 2}`}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        );
      case 'circle':
        return (
          <ellipse
            cx={width / 2}
            cy={height / 2}
            rx={w / 2}
            ry={h / 2}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        );
      case 'stadium':
        return (
          <rect
            x={pad}
            y={pad}
            width={w}
            height={h}
            rx={h / 2}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        );
      case 'cylinder':
        return (
          <path
            d={`M${pad},${pad + 8} A${w / 2},8 0 0,1 ${pad + w},${pad + 8} L${pad + w},${pad + h - 8} A${w / 2},8 0 0,1 ${pad},${pad + h - 8} Z M${pad},${pad + 8} A${w / 2},8 0 0,0 ${pad + w},${pad + 8}`}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        );
      case 'hexagon': {
        const cut = Math.min(18, w * 0.2);
        return (
          <polygon
            points={`${pad + cut},${pad} ${pad + w - cut},${pad} ${pad + w},${height / 2} ${pad + w - cut},${pad + h} ${pad + cut},${pad + h} ${pad},${height / 2}`}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        );
      }
      case 'round':
        return (
          <rect
            x={pad}
            y={pad}
            width={w}
            height={h}
            rx={10}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        );
      case 'rect':
      default:
        return (
          <rect
            x={pad}
            y={pad}
            width={w}
            height={h}
            rx={4}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onFinishEdit(node.id, editValue);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelEdit();
    }
  };

  const showHandles = !isEditing && (isHovered || isSelected);

  return (
    <div
      data-node-id={node.id}
      aria-label={node.label || node.id}
      className="group absolute select-none pointer-events-auto"
      style={{
        left: `${left - HIT_PADDING}px`,
        top: `${top - HIT_PADDING}px`,
        width: `${width + HIT_PADDING * 2}px`,
        height: `${height + HIT_PADDING * 2}px`,
        zIndex: isSelected ? 30 : 20,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        onSelect(node.id);
        onStartDrag(node.id, e);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
        onStartEdit(node.id);
      }}
    >
      {/* 노드 본체 (실제 도형과 텍스트가 표시되는 영역) */}
      <div
        className="absolute cursor-move"
        style={{
          left: `${HIT_PADDING}px`,
          top: `${HIT_PADDING}px`,
          width: `${width}px`,
          height: `${height}px`,
        }}
      >
        {/* 노드 도형 SVG */}
        <svg
          className="absolute inset-0 size-full overflow-visible pointer-events-auto"
          width={width}
          height={height}
        >
          {renderShapeSvg()}
        </svg>

        {/* 내부 라벨 또는 인라인 편집 텍스트에어리어 */}
        <div className="absolute inset-0 flex items-center justify-center p-2 text-center pointer-events-auto">
          {isEditing ? (
            <textarea
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => onFinishEdit(node.id, editValue)}
              className="size-full resize-none rounded bg-[var(--surface)] p-1 text-center font-sans text-xs text-[var(--text)] outline-none ring-2 ring-[var(--accent)] shadow-md"
              style={{ minHeight: `${height - 12}px` }}
            />
          ) : (
            <span
              className="font-medium text-xs break-words leading-tight pointer-events-none select-none"
              style={{ color: textColor }}
            >
              {node.label || node.id}
            </span>
          )}
        </div>
      </div>

      {/* 4개 연결 포트 (HIT_PADDING 기준 정확한 테두리 위치에 배치) */}
      {!isEditing && (
        <div
          className={`transition-opacity duration-150 pointer-events-auto ${
            showHandles ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          {/* 위쪽 포트 */}
          <div
            data-port="top"
            aria-label="위쪽 연결 포트"
            className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-500 shadow-sm cursor-crosshair hover:scale-125 transition-transform"
            style={{
              left: `${HIT_PADDING + width / 2}px`,
              top: `${HIT_PADDING}px`,
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartConnect(node.id, 'top', e);
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartConnect(node.id, 'top', e);
            }}
          />
          {/* 아래쪽 포트 */}
          <div
            data-port="bottom"
            aria-label="아래쪽 연결 포트"
            className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-500 shadow-sm cursor-crosshair hover:scale-125 transition-transform"
            style={{
              left: `${HIT_PADDING + width / 2}px`,
              top: `${HIT_PADDING + height}px`,
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartConnect(node.id, 'bottom', e);
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartConnect(node.id, 'bottom', e);
            }}
          />
          {/* 왼쪽 포트 */}
          <div
            data-port="left"
            aria-label="왼쪽 연결 포트"
            className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-500 shadow-sm cursor-crosshair hover:scale-125 transition-transform"
            style={{
              left: `${HIT_PADDING}px`,
              top: `${HIT_PADDING + height / 2}px`,
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartConnect(node.id, 'left', e);
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartConnect(node.id, 'left', e);
            }}
          />
          {/* 오른쪽 포트 */}
          <div
            data-port="right"
            aria-label="오른쪽 연결 포트"
            className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-500 shadow-sm cursor-crosshair hover:scale-125 transition-transform"
            style={{
              left: `${HIT_PADDING + width}px`,
              top: `${HIT_PADDING + height / 2}px`,
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartConnect(node.id, 'right', e);
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartConnect(node.id, 'right', e);
            }}
          />
        </div>
      )}

      {/* 4개 Quick Add (+) 버튼 (HIT_PADDING 내부 바깥쪽으로 배치되어 마우스 이동 시 hover가 절대 끊기지 않음) */}
      {!isEditing && (
        <div
          className={`transition-opacity duration-150 pointer-events-auto ${
            showHandles ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          {/* 위쪽 (+) 버튼 */}
          <button
            type="button"
            data-quick-add="top"
            title="위쪽에 단계 추가"
            aria-label="위쪽에 단계 추가"
            className="absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700 hover:scale-110 transition-transform cursor-pointer"
            style={{
              left: `${HIT_PADDING + width / 2}px`,
              top: `${HIT_PADDING - 14}px`,
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onQuickAdd(node.id, 'top');
            }}
          >
            <Plus className="size-3.5" />
          </button>
          {/* 아래쪽 (+) 버튼 */}
          <button
            type="button"
            data-quick-add="bottom"
            title="아래쪽에 단계 추가"
            aria-label="아래쪽에 단계 추가"
            className="absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700 hover:scale-110 transition-transform cursor-pointer"
            style={{
              left: `${HIT_PADDING + width / 2}px`,
              top: `${HIT_PADDING + height + 14}px`,
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onQuickAdd(node.id, 'bottom');
            }}
          >
            <Plus className="size-3.5" />
          </button>
          {/* 왼쪽 (+) 버튼 */}
          <button
            type="button"
            data-quick-add="left"
            title="왼쪽에 단계 추가"
            aria-label="왼쪽에 단계 추가"
            className="absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700 hover:scale-110 transition-transform cursor-pointer"
            style={{
              left: `${HIT_PADDING - 14}px`,
              top: `${HIT_PADDING + height / 2}px`,
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onQuickAdd(node.id, 'left');
            }}
          >
            <Plus className="size-3.5" />
          </button>
          {/* 오른쪽 (+) 버튼 */}
          <button
            type="button"
            data-quick-add="right"
            title="오른쪽에 단계 추가"
            aria-label="오른쪽에 단계 추가"
            className="absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700 hover:scale-110 transition-transform cursor-pointer"
            style={{
              left: `${HIT_PADDING + width + 14}px`,
              top: `${HIT_PADDING + height / 2}px`,
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onQuickAdd(node.id, 'right');
            }}
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
