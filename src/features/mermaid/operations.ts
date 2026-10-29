import type { FlowchartModel, FlowDirection, FlowEdge, FlowNode } from './types';

/** 새 고유 노드 ID 생성 */
export function generateUniqueNodeId(existingNodes: FlowNode[], prefix = 'node'): string {
  const existingIds = new Set(existingNodes.map((n) => n.id));

  // 모든 노드 ID가 알파벳 단일 대문자라면 다음 알파벳 대문자 우선 시도 (A, B, C -> D)
  const allSingleUpper = existingNodes.length > 0 && existingNodes.every((n) => /^[A-Z]$/.test(n.id));
  if (allSingleUpper) {
    for (let code = 65; code <= 90; code++) {
      const letter = String.fromCharCode(code);
      if (!existingIds.has(letter)) {
        return letter;
      }
    }
  }

  // 중복 없는 prefix+숫자 ID 탐색
  let idx = 1;
  while (existingIds.has(`${prefix}${idx}`)) {
    idx++;
  }
  return `${prefix}${idx}`;
}

/** 새 고유 엣지 ID 생성 */
export function generateUniqueEdgeId(existingEdges: FlowEdge[]): string {
  const existingIds = new Set(existingEdges.map((e) => e.id));
  let idx = existingEdges.length + 1;
  while (existingIds.has(`edge-${idx}`)) {
    idx++;
  }
  return `edge-${idx}`;
}

/** 노드 추가 */
export function addNode(model: FlowchartModel, nodePatch?: Partial<FlowNode>): FlowchartModel {
  const newId = nodePatch?.id || generateUniqueNodeId(model.nodes);
  const newNode: FlowNode = {
    id: newId,
    label: nodePatch?.label ?? '새 단계',
    shape: nodePatch?.shape ?? 'rect',
  };
  return {
    ...model,
    nodes: [...model.nodes, newNode],
  };
}

/** 노드 삭제 (연결된 엣지도 함께 삭제) */
export function removeNode(model: FlowchartModel, nodeId: string): FlowchartModel {
  const filteredNodes = model.nodes.filter((n) => n.id !== nodeId);
  const filteredEdges = model.edges.filter((e) => e.from !== nodeId && e.to !== nodeId);
  return {
    ...model,
    nodes: filteredNodes,
    edges: filteredEdges,
  };
}

/** 노드 수정 */
export function updateNode(model: FlowchartModel, nodeId: string, patch: Partial<FlowNode>): FlowchartModel {
  const target = model.nodes.find((n) => n.id === nodeId);
  if (!target) return model;

  const newId = patch.id && patch.id !== nodeId ? patch.id : nodeId;
  const updatedNodes = model.nodes.map((n) => {
    if (n.id !== nodeId) return n;
    return { ...n, ...patch, id: newId };
  });

  // ID가 바뀌었으면 엣지의 from, to도 업데이트
  const updatedEdges =
    newId !== nodeId
      ? model.edges.map((e) => ({
          ...e,
          from: e.from === nodeId ? newId : e.from,
          to: e.to === nodeId ? newId : e.to,
        }))
      : model.edges;

  return {
    ...model,
    nodes: updatedNodes,
    edges: updatedEdges,
  };
}

/** 엣지 추가 */
export function addEdge(model: FlowchartModel, edge: Omit<FlowEdge, 'id'>): FlowchartModel {
  const newEdge: FlowEdge = {
    ...edge,
    id: generateUniqueEdgeId(model.edges),
  };
  return {
    ...model,
    edges: [...model.edges, newEdge],
  };
}

/** 엣지 삭제 */
export function removeEdge(model: FlowchartModel, edgeId: string): FlowchartModel {
  return {
    ...model,
    edges: model.edges.filter((e) => e.id !== edgeId),
  };
}

/** 엣지 수정 */
export function updateEdge(model: FlowchartModel, edgeId: string, patch: Partial<FlowEdge>): FlowchartModel {
  return {
    ...model,
    edges: model.edges.map((e) => (e.id === edgeId ? { ...e, ...patch } : e)),
  };
}

/** 방향 설정 */
export function setDirection(model: FlowchartModel, direction: FlowDirection): FlowchartModel {
  return {
    ...model,
    direction,
  };
}

/** 노드 순서 이동 */
export function moveNode(model: FlowchartModel, fromIndex: number, toIndex: number): FlowchartModel {
  if (fromIndex < 0 || fromIndex >= model.nodes.length || toIndex < 0 || toIndex >= model.nodes.length) {
    return model;
  }
  const nextNodes = [...model.nodes];
  const [removed] = nextNodes.splice(fromIndex, 1);
  nextNodes.splice(toIndex, 0, removed);
  return {
    ...model,
    nodes: nextNodes,
  };
}

/**
 * 모달 열기 당시의 원문 줄과 현재 문서의 해당 줄이 일치하는지 검사
 * (사용자가 에디터에서 원문을 바꿨으면 덮어쓰기 방지)
 */
export function canApplyChanges(
  originalLines: string[],
  currentDocLines: string[],
  startLine: number,
  endLine: number,
): boolean {
  if (startLine < 0 || endLine > currentDocLines.length || startLine > endLine) {
    return false;
  }
  const currentBlockLines = currentDocLines.slice(startLine, endLine);
  if (currentBlockLines.length !== originalLines.length) {
    return false;
  }
  for (let i = 0; i < originalLines.length; i++) {
    if (originalLines[i] !== currentBlockLines[i]) {
      return false;
    }
  }
  return true;
}
