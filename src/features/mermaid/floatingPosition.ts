import type { NodeLayout } from './layout';

export type FloatingBarPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface FloatingBarPositionOptions {
  selectedNode: NodeLayout;
  otherNodes?: NodeLayout[];
  barWidth?: number;
  barHeight?: number;
  canvasBounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

export interface FloatingBarPositionResult {
  x: number;
  y: number;
  placement: FloatingBarPlacement;
  box: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

/**
 * 두 사각형 간의 겹치는 면적을 계산한다.
 */
function computeOverlapArea(
  boxA: { minX: number; minY: number; maxX: number; maxY: number },
  boxB: { minX: number; minY: number; maxX: number; maxY: number },
): number {
  const overlapW = Math.max(0, Math.min(boxA.maxX, boxB.maxX) - Math.max(boxA.minX, boxB.minX));
  const overlapH = Math.max(0, Math.min(boxA.maxY, boxB.maxY) - Math.max(boxA.minY, boxB.minY));
  return overlapW * overlapH;
}

/**
 * 선택된 노드 주위에서 다른 노드와 경계를 가장 덜 가리는 조작 막대(Floating Bar) 위치를 계산한다.
 *
 * 규칙:
 * 1. 위/아래/오른쪽/왼쪽 4개 후보 위치를 생성한다.
 * 2. 각 후보 위치가 다른 노드들과 겹치는 면적을 계산한다.
 * 3. 캔버스 경계(canvasBounds)가 제공되면 경계를 벗어나는 부분에 큰 페널티를 부여한다.
 * 4. 겹침이 없는 후보 중에서는 기본 선호도(top > bottom > right > left) 순으로 선택한다.
 */
export function computeFloatingBarPosition(options: FloatingBarPositionOptions): FloatingBarPositionResult {
  const {
    selectedNode,
    otherNodes = [],
    barWidth = 320,
    barHeight = 44,
    canvasBounds,
  } = options;

  const gap = 16;
  const halfW = barWidth / 2;
  const halfH = barHeight / 2;
  const nodeHalfW = selectedNode.width / 2;
  const nodeHalfH = selectedNode.height / 2;

  const candidates: { placement: FloatingBarPlacement; cx: number; cy: number; preferencePenalty: number }[] = [
    {
      placement: 'top',
      cx: selectedNode.x,
      cy: selectedNode.y - nodeHalfH - gap - halfH,
      preferencePenalty: 0,
    },
    {
      placement: 'bottom',
      cx: selectedNode.x,
      cy: selectedNode.y + nodeHalfH + gap + halfH,
      preferencePenalty: 50,
    },
    {
      placement: 'right',
      cx: selectedNode.x + nodeHalfW + gap + halfW,
      cy: selectedNode.y,
      preferencePenalty: 200,
    },
    {
      placement: 'left',
      cx: selectedNode.x - nodeHalfW - gap - halfW,
      cy: selectedNode.y,
      preferencePenalty: 300,
    },
  ];

  let bestPlacement = candidates[0];
  let minPenalty = Infinity;

  for (const cand of candidates) {
    const box = {
      minX: cand.cx - halfW,
      minY: cand.cy - halfH,
      maxX: cand.cx + halfW,
      maxY: cand.cy + halfH,
    };

    // 1) 다른 노드들과의 겹치는 면적 합산
    let overlapPenalty = 0;
    for (const other of otherNodes) {
      const otherBox = {
        minX: other.x - other.width / 2,
        minY: other.y - other.height / 2,
        maxX: other.x + other.width / 2,
        maxY: other.y + other.height / 2,
      };
      const area = computeOverlapArea(box, otherBox);
      overlapPenalty += area;
    }

    // 2) 캔버스 경계를 벗어나는 영역 페널티
    let boundaryPenalty = 0;
    if (canvasBounds) {
      const outLeft = Math.max(0, canvasBounds.minX - box.minX);
      const outRight = Math.max(0, box.maxX - canvasBounds.maxX);
      const outTop = Math.max(0, canvasBounds.minY - box.minY);
      const outBottom = Math.max(0, box.maxY - canvasBounds.maxY);
      boundaryPenalty = (outLeft + outRight + outTop + outBottom) * 1000;
    }

    const totalPenalty = overlapPenalty + boundaryPenalty + cand.preferencePenalty;

    if (totalPenalty < minPenalty) {
      minPenalty = totalPenalty;
      bestPlacement = cand;
    }
  }

  return {
    x: bestPlacement.cx,
    y: bestPlacement.cy,
    placement: bestPlacement.placement,
    box: {
      minX: bestPlacement.cx - halfW,
      minY: bestPlacement.cy - halfH,
      maxX: bestPlacement.cx + halfW,
      maxY: bestPlacement.cy + halfH,
    },
  };
}
