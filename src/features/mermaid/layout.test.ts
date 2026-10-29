import { describe, expect, it } from 'vitest';
import { computeLayout, estimateNodeSize, findQuickAddPosition } from './layout';
import type { FlowchartModel } from './types';

describe('mermaid layout (dagre 계층형 자동 배치)', () => {
  it('estimateNodeSize: 라벨 길이와 모양에 따라 적절한 크기를 반환한다', () => {
    const shortNode = estimateNodeSize({ id: 'A', label: '단어', shape: 'rect' });
    const longNode = estimateNodeSize({ id: 'B', label: '매우 긴 한국어 텍스트 라벨입니다', shape: 'rect' });
    const multiLineNode = estimateNodeSize({ id: 'C', label: '1줄\n2줄\n3줄', shape: 'rect' });
    const rhombusNode = estimateNodeSize({ id: 'D', label: '마름모', shape: 'rhombus' });
    const circleNode = estimateNodeSize({ id: 'E', label: '원', shape: 'circle' });

    expect(shortNode.width).toBeGreaterThanOrEqual(100);
    expect(longNode.width).toBeGreaterThan(shortNode.width);
    expect(multiLineNode.height).toBeGreaterThan(shortNode.height);
    expect(rhombusNode.width).toBeGreaterThan(shortNode.width);
    expect(circleNode.width).toBe(circleNode.height); // 원은 정사각형 비율
  });

  it('노드 0개, 1개, 연결 없는 노드, 순환 그래프(A->B->A)에서도 에러 없이 정상 작동한다', () => {
    // 0개
    const emptyModel: FlowchartModel = { direction: 'TD', nodes: [], edges: [], preservedLines: [] };
    expect(computeLayout(emptyModel)).toEqual({});

    // 1개
    const singleModel: FlowchartModel = {
      direction: 'TD',
      nodes: [{ id: 'A', label: 'A', shape: 'rect' }],
      edges: [],
      preservedLines: [],
    };
    const singleRes = computeLayout(singleModel);
    expect(singleRes.A).toBeDefined();
    expect(Number.isFinite(singleRes.A.x)).toBe(true);

    // 연결 없는 여러 노드
    const disjointModel: FlowchartModel = {
      direction: 'LR',
      nodes: [
        { id: 'A', label: 'A', shape: 'rect' },
        { id: 'B', label: 'B', shape: 'rect' },
        { id: 'C', label: 'C', shape: 'rect' },
      ],
      edges: [],
      preservedLines: [],
    };
    const disjointRes = computeLayout(disjointModel);
    expect(Object.keys(disjointRes)).toHaveLength(3);

    // 순환 그래프
    const cycleModel: FlowchartModel = {
      direction: 'TD',
      nodes: [
        { id: 'A', label: 'A', shape: 'rect' },
        { id: 'B', label: 'B', shape: 'rect' },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B', style: 'arrow' },
        { id: 'e2', from: 'B', to: 'A', style: 'arrow' },
      ],
      preservedLines: [],
    };
    const cycleRes = computeLayout(cycleModel);
    expect(cycleRes.A).toBeDefined();
    expect(cycleRes.B).toBeDefined();
  });

  it('방향 4종(TD, LR, BT, RL)에 따라 흐름 방향이 올바르게 계산된다', () => {
    const baseModel = (direction: 'TD' | 'LR' | 'BT' | 'RL'): FlowchartModel => ({
      direction,
      nodes: [
        { id: 'Start', label: '시작', shape: 'rect' },
        { id: 'End', label: '종료', shape: 'rect' },
      ],
      edges: [{ id: 'e1', from: 'Start', to: 'End', style: 'arrow' }],
      preservedLines: [],
    });

    // TD (위 -> 아래): Start의 y < End의 y
    const tdRes = computeLayout(baseModel('TD'));
    expect(tdRes.Start.y).toBeLessThan(tdRes.End.y);

    // LR (왼쪽 -> 오른쪽): Start의 x < End의 x
    const lrRes = computeLayout(baseModel('LR'));
    expect(lrRes.Start.x).toBeLessThan(lrRes.End.x);

    // BT (아래 -> 위): Start의 y > End의 y
    const btRes = computeLayout(baseModel('BT'));
    expect(btRes.Start.y).toBeGreaterThan(btRes.End.y);

    // RL (오른쪽 -> 왼쪽): Start의 x > End의 x
    const rlRes = computeLayout(baseModel('RL'));
    expect(rlRes.Start.x).toBeGreaterThan(rlRes.End.x);
  });

  it('배치된 노드들 사이에 서로 겹침이 없다', () => {
    const model: FlowchartModel = {
      direction: 'TD',
      nodes: [
        { id: 'A', label: 'A단계', shape: 'rect' },
        { id: 'B', label: 'B단계', shape: 'rect' },
        { id: 'C', label: 'C단계', shape: 'rect' },
        { id: 'D', label: 'D단계', shape: 'rect' },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B', style: 'arrow' },
        { id: 'e2', from: 'A', to: 'C', style: 'arrow' },
        { id: 'e3', from: 'B', to: 'D', style: 'arrow' },
        { id: 'e4', from: 'C', to: 'D', style: 'arrow' },
      ],
      preservedLines: [],
    };
    const res = computeLayout(model);
    const nodeIds = Object.keys(res);

    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const n1 = res[nodeIds[i]];
        const n2 = res[nodeIds[j]];
        const hOverlap = Math.abs(n1.x - n2.x) < (n1.width + n2.width) / 2;
        const vOverlap = Math.abs(n1.y - n2.y) < (n1.height + n2.height) / 2;
        expect(hOverlap && vOverlap).toBe(false);
      }
    }
  });

  it('같은 입력 모델에 대해 항상 동일한 결과(결정적)를 반환한다', () => {
    const model: FlowchartModel = {
      direction: 'LR',
      nodes: [
        { id: 'A', label: '노드 A', shape: 'circle' },
        { id: 'B', label: '노드 B', shape: 'rhombus' },
        { id: 'C', label: '노드 C', shape: 'rect' },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B', style: 'arrow' },
        { id: 'e2', from: 'B', to: 'C', style: 'arrow' },
      ],
      preservedLines: [],
    };

    const run1 = computeLayout(model);
    const run2 = computeLayout(model);
    expect(run1).toEqual(run2);
  });

  it('findQuickAddPosition: 지정된 방향에 새 노드가 기존 노드와 겹치지 않는 좌표를 찾는다', () => {
    const existing = {
      A: { x: 200, y: 200, width: 100, height: 50 },
      B: { x: 350, y: 200, width: 100, height: 50 }, // A의 오른쪽에 이미 노드가 있음
    };

    // A의 오른쪽으로 추가를 요청했을 때 B와 충돌을 회피하여 y축으로 오프셋을 준다
    const pos = findQuickAddPosition(existing.A, 'right', existing, { width: 100, height: 50 });
    expect(pos.x).toBeGreaterThan(existing.A.x);

    // B와 겹치지 않는지 검증
    const hOverlap = Math.abs(pos.x - existing.B.x) < 100;
    const vOverlap = Math.abs(pos.y - existing.B.y) < 50;
    expect(hOverlap && vOverlap).toBe(false);
  });

  it('100개 노드 대규모 그래프의 자동 배치 성능을 측정한다 (100ms 이내)', () => {
    const nodes = [];
    const edges = [];
    for (let i = 1; i <= 100; i++) {
      nodes.push({
        id: `node_${i}`,
        label: `단계_${i}`,
        shape: 'rect' as const,
      });
      if (i > 1) {
        // 부모 노드와 연결 (이진 트리 구조)
        const parent = Math.floor(i / 2);
        edges.push({
          id: `edge_${parent}_${i}`,
          from: `node_${parent}`,
          to: `node_${i}`,
          style: 'arrow' as const,
        });
      }
    }

    const largeModel: FlowchartModel = {
      direction: 'TD',
      nodes,
      edges,
      preservedLines: [],
    };

    const start = performance.now();
    const layout = computeLayout(largeModel);
    const duration = performance.now() - start;

    console.log(`[100개 노드 자동 배치 실측] 소요 시간: ${duration.toFixed(2)}ms`);
    expect(Object.keys(layout)).toHaveLength(100);
    expect(duration).toBeLessThan(200); // 100개 노드 배치는 200ms 이내에 완료되어야 함
  });
});
