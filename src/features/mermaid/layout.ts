import dagre from '@dagrejs/dagre';
import type { FlowchartModel, FlowDirection, FlowNode } from './types';

export interface NodeLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type LayoutResult = Record<string, NodeLayout>;

/**
 * 글자 라벨과 모양을 기반으로 노드의 시각적 폭과 높이를 추정한다 (순수 함수)
 */
export function estimateNodeSize(node: FlowNode): { width: number; height: number } {
  const lines = (node.label || node.id).split('\n');
  let maxLineWidth = 0;

  for (const line of lines) {
    let lineWidth = 0;
    for (const char of line) {
      // 한글, 한자, 전각 문자 등은 약 14px, 영문/기호는 약 8px
      if (/[\uac00-\ud7a3\u4e00-\u9fa5\uff01-\uffee]/.test(char)) {
        lineWidth += 14;
      } else {
        lineWidth += 8.5;
      }
    }
    if (lineWidth > maxLineWidth) {
      maxLineWidth = lineWidth;
    }
  }

  // 기본 여백 추가
  let width = Math.max(100, maxLineWidth + 36);
  let height = Math.max(48, lines.length * 20 + 24);

  // 모양별 보정
  switch (node.shape) {
    case 'rhombus':
      width = Math.max(width * 1.35, 110);
      height = Math.max(height * 1.35, 80);
      break;
    case 'circle': {
      const size = Math.max(width, height, 72);
      width = size;
      height = size;
      break;
    }
    case 'stadium':
      width += 20;
      break;
    case 'cylinder':
      height += 16;
      break;
    case 'hexagon':
      width += 24;
      break;
    default:
      break;
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * FlowDirection을 dagre의 rankdir로 변환한다
 */
function toDagreRankDir(dir: FlowDirection): 'TB' | 'LR' | 'BT' | 'RL' {
  switch (dir) {
    case 'TD':
      return 'TB';
    case 'LR':
      return 'LR';
    case 'BT':
      return 'BT';
    case 'RL':
      return 'RL';
    default:
      return 'TB';
  }
}

/**
 * 모델(노드, 엣지, 방향)을 기반으로 계층형 배치(dagre)를 계산한다 (순수 함수)
 */
export function computeLayout(model: FlowchartModel): LayoutResult {
  if (model.nodes.length === 0) {
    return {};
  }

  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({
    rankdir: toDagreRankDir(model.direction),
    nodesep: 50,
    ranksep: 60,
    marginx: 100,
    marginy: 120,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // 노드 크기 측정 및 추가
  const sizeMap: Record<string, { width: number; height: number }> = {};
  for (const node of model.nodes) {
    const size = estimateNodeSize(node);
    sizeMap[node.id] = size;
    g.setNode(node.id, {
      width: size.width,
      height: size.height,
    });
  }

  // 엣지 추가
  for (const edge of model.edges) {
    if (sizeMap[edge.from] && sizeMap[edge.to]) {
      g.setEdge(edge.from, edge.to, {}, edge.id);
    }
  }

  // 레이아웃 실행
  dagre.layout(g);

  // 결과 수집
  const result: LayoutResult = {};
  for (const node of model.nodes) {
    const n = g.node(node.id);
    const size = sizeMap[node.id];
    if (n && Number.isFinite(n.x) && Number.isFinite(n.y)) {
      result[node.id] = {
        x: Math.round(n.x),
        y: Math.round(n.y),
        width: size.width,
        height: size.height,
      };
    } else {
      // dagre 실패 시 fallback
      result[node.id] = {
        x: 100,
        y: 100,
        width: size.width,
        height: size.height,
      };
    }
  }

  return result;
}

/**
 * 특정 노드의 상/하/좌/우에 새 노드가 겹치지 않게 생성될 위치를 계산한다 (순수 함수)
 */
export function findQuickAddPosition(
  parentLayout: NodeLayout,
  direction: 'right' | 'left' | 'top' | 'bottom',
  existingLayouts: Record<string, NodeLayout>,
  newNodeSize: { width: number; height: number } = { width: 110, height: 48 },
): { x: number; y: number } {
  const margin = 50;
  let targetX = parentLayout.x;
  let targetY = parentLayout.y;

  switch (direction) {
    case 'right':
      targetX = parentLayout.x + parentLayout.width / 2 + margin + newNodeSize.width / 2;
      break;
    case 'left':
      targetX = parentLayout.x - parentLayout.width / 2 - margin - newNodeSize.width / 2;
      break;
    case 'top':
      targetY = parentLayout.y - parentLayout.height / 2 - margin - newNodeSize.height / 2;
      break;
    case 'bottom':
      targetY = parentLayout.y + parentLayout.height / 2 + margin + newNodeSize.height / 2;
      break;
  }

  // 기존 노드들과의 충돌 회피 (반복 이동)
  const isColliding = (x: number, y: number) => {
    for (const id of Object.keys(existingLayouts)) {
      const other = existingLayouts[id];
      const hOverlap = Math.abs(x - other.x) < (newNodeSize.width + other.width) / 2 + 10;
      const vOverlap = Math.abs(y - other.y) < (newNodeSize.height + other.height) / 2 + 10;
      if (hOverlap && vOverlap) return true;
    }
    return false;
  };

  let attempts = 0;
  while (isColliding(targetX, targetY) && attempts < 10) {
    attempts++;
    if (direction === 'right' || direction === 'left') {
      targetY += newNodeSize.height + 20;
    } else {
      targetX += newNodeSize.width + 20;
    }
  }

  return { x: Math.round(targetX), y: Math.round(targetY) };
}
