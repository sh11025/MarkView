import React from 'react';
import type { FlowDirection } from '../../../features/mermaid';

interface CanvasStatusBarProps {
  nodeCount: number;
  edgeCount: number;
  direction: FlowDirection;
}

export const CanvasStatusBar: React.FC<CanvasStatusBarProps> = ({ nodeCount, edgeCount, direction }) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[11px] text-[var(--muted)]">
      <div className="flex items-center gap-2">
        <span className="font-medium text-[var(--text)]">도형 {nodeCount}개</span>
        <span>·</span>
        <span className="font-medium text-[var(--text)]">연결선 {edgeCount}개</span>
        <span>·</span>
        <span>방향: <strong className="text-[var(--text)]">{direction}</strong></span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span>도형에 마우스를 올리면 + 버튼이 나타납니다 · 더블클릭: 글자 수정 · 끌기: 이동</span>
        <span className="opacity-75">(도형 위치는 저장되지 않고, 문서에서는 자동 배치됩니다)</span>
      </div>
    </div>
  );
};
