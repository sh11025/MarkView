import { describe, it, expect } from 'vitest';
import { computeFloatingBarPosition } from './floatingPosition';
import type { NodeLayout } from './layout';

describe('computeFloatingBarPosition (조작 막대 스마트 배치)', () => {
  const selectedNode: NodeLayout = {
    x: 200,
    y: 200,
    width: 100,
    height: 50,
  };

  it('방해 요소가 없으면 기본 선호 방향인 위쪽(top)을 선택한다', () => {
    const res = computeFloatingBarPosition({
      selectedNode,
      otherNodes: [],
    });
    expect(res.placement).toBe('top');
    expect(res.x).toBe(200);
    expect(res.y).toBeLessThan(selectedNode.y - selectedNode.height / 2);
  });

  it('위쪽에 다른 노드가 인접해 있으면 아래쪽(bottom)을 선택한다', () => {
    const nodeAbove: NodeLayout = {
      x: 200,
      y: 130, // A의 바로 위
      width: 100,
      height: 50,
    };
    const res = computeFloatingBarPosition({
      selectedNode,
      otherNodes: [nodeAbove],
    });
    expect(res.placement).toBe('bottom');
    expect(res.y).toBeGreaterThan(selectedNode.y + selectedNode.height / 2);
  });

  it('아래쪽에 다른 노드가 인접해 있으면 위쪽(top)을 선택하여 아래 노드를 가리지 않는다', () => {
    const nodeBelow: NodeLayout = {
      x: 200,
      y: 270, // A의 바로 아래
      width: 100,
      height: 50,
    };
    const res = computeFloatingBarPosition({
      selectedNode,
      otherNodes: [nodeBelow],
    });
    expect(res.placement).toBe('top');
  });

  it('위와 아래 모두 다른 노드가 인접해 있으면 오른쪽(right)을 선택한다', () => {
    const nodeAbove: NodeLayout = {
      x: 200,
      y: 130,
      width: 100,
      height: 50,
    };
    const nodeBelow: NodeLayout = {
      x: 200,
      y: 270,
      width: 100,
      height: 50,
    };
    const res = computeFloatingBarPosition({
      selectedNode,
      otherNodes: [nodeAbove, nodeBelow],
    });
    expect(res.placement).toBe('right');
    expect(res.x).toBeGreaterThan(selectedNode.x + selectedNode.width / 2);
  });

  it('캔버스 위쪽 경계(minY)에 걸릴 경우 경계를 벗어나지 않는 아래쪽(bottom)을 선택한다', () => {
    const nearTopNode: NodeLayout = {
      x: 200,
      y: 30, // 캔버스 최상단에 붙어 있음
      width: 100,
      height: 40,
    };
    const res = computeFloatingBarPosition({
      selectedNode: nearTopNode,
      otherNodes: [],
      canvasBounds: {
        minX: 0,
        minY: 0,
        maxX: 800,
        maxY: 600,
      },
    });
    expect(res.placement).toBe('bottom');
    expect(res.box.minY).toBeGreaterThanOrEqual(0);
  });
});
