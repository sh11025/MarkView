import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { FlowDirection, FlowNode, FlowEdge } from '../../../features/mermaid';
import {
  addNode,
  removeNode,
  updateNode,
  addEdge,
  removeEdge,
  updateEdge,
  setDirection,
  generateUniqueNodeId,
  parseFlowchart,
} from '../../../features/mermaid';
import { computeLayout, estimateNodeSize, findQuickAddPosition, type NodeLayout } from '../../../features/mermaid/layout';
import type { CanvasProps, ConnectingState, NodePositionMap, PortDirection, QuickAddDirection } from './types';
import { CanvasToolbar } from './CanvasToolbar';
import { CanvasStatusBar } from './CanvasStatusBar';
import { CanvasNode } from './CanvasNode';
import { CanvasEdge } from './CanvasEdge';
import { CanvasFloatingBar } from './CanvasFloatingBar';

export const MermaidCanvas: React.FC<CanvasProps> = ({
  model,
  onChange,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  showPreview,
  onTogglePreview,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 최신 모델 참조 유지 (연속 변경 시 레이스 컨디션 방지)
  const modelRef = useRef(model);
  modelRef.current = model;

  const handleUpdateNode = useCallback(
    (id: string, patch: Partial<FlowNode>) => {
      const updated = updateNode(modelRef.current, id, patch);
      modelRef.current = updated;
      onChange(updated);
    },
    [onChange],
  );

  const handleUpdateEdge = useCallback(
    (id: string, patch: Partial<FlowEdge>) => {
      const updated = updateEdge(modelRef.current, id, patch);
      modelRef.current = updated;
      onChange(updated);
    },
    [onChange],
  );

  // 뷰포트 상태 (줌 및 팬)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef(pan);
  panRef.current = pan;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // 선택 및 인라인 편집 상태
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);

  // 포트 연결 드래그 상태
  const [connecting, setConnecting] = useState<ConnectingState | null>(null);

  // 노드 드래그 상태
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0, nodeX: 0, nodeY: 0 });

  // 캔버스 내 노드 위치 맵 (인메모리 전용)
  const [nodePositions, setNodePositions] = useState<NodePositionMap>({});

  // 자동 레이아웃 재계산 함수
  const runAutoLayout = useCallback(() => {
    const layout = computeLayout(model);
    const newPositions: NodePositionMap = {};
    const layoutEntries = Object.entries(layout);
    if (layoutEntries.length === 0) {
      setNodePositions({});
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [id, l] of layoutEntries) {
      newPositions[id] = { x: l.x, y: l.y };
      minX = Math.min(minX, l.x - l.width / 2);
      maxX = Math.max(maxX, l.x + l.width / 2);
      minY = Math.min(minY, l.y - l.height / 2);
      maxY = Math.max(maxY, l.y + l.height / 2);
    }
    setNodePositions(newPositions);

    // 노드들을 캔버스 컨테이너의 중앙으로 배치하도록 pan 계산
    const container = containerRef.current;
    const clientW = container?.clientWidth || 700;
    const clientH = container?.clientHeight || 450;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    setPan({
      x: Math.round(clientW / 2 - midX * zoom),
      y: Math.round(clientH / 2 - midY * zoom),
    });
  }, [model, zoom]);

  // 모델 노드가 변경되었을 때 빠진 노드 위치 채우기
  useEffect(() => {
    const missing = model.nodes.some((n) => !nodePositions[n.id]);
    if (missing || Object.keys(nodePositions).length === 0) {
      runAutoLayout();
    }
  }, [model.nodes, runAutoLayout]);

  // 마운트 후 컨테이너 크기 측정 시점 중앙 정렬
  useEffect(() => {
    const timer = setTimeout(() => {
      if (containerRef.current && Object.keys(nodePositions).length > 0) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const id of Object.keys(nodePositions)) {
            const p = nodePositions[id];
            minX = Math.min(minX, p.x - 50);
            maxX = Math.max(maxX, p.x + 50);
            minY = Math.min(minY, p.y - 25);
            maxY = Math.max(maxY, p.y + 25);
          }
          const midX = (minX + maxX) / 2;
          const midY = (minY + maxY) / 2;
          setPan({
            x: Math.round(clientWidth / 2 - midX),
            y: Math.round(clientHeight / 2 - midY),
          });
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []); // 마운트 시 1회

  // 화면 맞춤
  const handleZoomFit = useCallback(() => {
    const nodeIds = Object.keys(nodePositions);
    if (nodeIds.length === 0 || !containerRef.current) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of nodeIds) {
      const p = nodePositions[id];
      const node = model.nodes.find((n) => n.id === id);
      const size = node ? estimateNodeSize(node) : { width: 100, height: 50 };
      minX = Math.min(minX, p.x - size.width / 2);
      maxX = Math.max(maxX, p.x + size.width / 2);
      minY = Math.min(minY, p.y - size.height / 2);
      maxY = Math.max(maxY, p.y + size.height / 2);
    }

    const { clientWidth, clientHeight } = containerRef.current;
    const graphWidth = maxX - minX + 100;
    const graphHeight = maxY - minY + 100;

    const scaleX = clientWidth / graphWidth;
    const scaleY = clientHeight / graphHeight;
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.3), 1.5);

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    setZoom(newZoom);
    setPan({
      x: clientWidth / 2 - midX * newZoom,
      y: clientHeight / 2 - midY * newZoom,
    });
  }, [nodePositions, model.nodes]);

  // 완성된 노드 레이아웃 맵 계산
  const layoutMap = useMemo<Record<string, NodeLayout>>(() => {
    const result: Record<string, NodeLayout> = {};
    for (const node of model.nodes) {
      const size = estimateNodeSize(node);
      const pos = nodePositions[node.id] || { x: 200, y: 200 };
      result[node.id] = {
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
      };
    }
    return result;
  }, [model.nodes, nodePositions]);

  // 방향 전환
  const handleDirectionChange = (newDir: FlowDirection) => {
    const updated = setDirection(model, newDir);
    onChange(updated);
    setTimeout(runAutoLayout, 0);
  };

  // 노드 또는 조작 막대가 캔버스 가시 영역 안에 들어오도록 화면(pan) 자동 보정
  const ensureVisible = useCallback((box: { minX: number; minY: number; maxX: number; maxY: number }) => {
    const container = containerRef.current;
    if (!container) return;
    const clientW = container.clientWidth;
    const clientH = container.clientHeight;
    if (clientW === 0 || clientH === 0) return;

    const currentPan = panRef.current;
    const currentZoom = zoomRef.current;
    const margin = 30;
    const screenLeft = currentPan.x + box.minX * currentZoom;
    const screenRight = currentPan.x + box.maxX * currentZoom;
    const screenTop = currentPan.y + box.minY * currentZoom;
    const screenBottom = currentPan.y + box.maxY * currentZoom;

    let deltaX = 0;
    let deltaY = 0;

    if (screenLeft < margin) {
      deltaX = margin - screenLeft;
    } else if (screenRight > clientW - margin) {
      deltaX = (clientW - margin) - screenRight;
    }

    if (screenTop < margin) {
      deltaY = margin - screenTop;
    } else if (screenBottom > clientH - margin) {
      deltaY = (clientH - margin) - screenBottom;
    }

    if (deltaX !== 0 || deltaY !== 0) {
      const nextPan = {
        x: Math.round(currentPan.x + deltaX),
        y: Math.round(currentPan.y + deltaY),
      };
      panRef.current = nextPan;
      setPan(nextPan);
    }
  }, []);

  // 노드 선택 핸들러 (화면 밖 요소인 경우 패닝 자동 이동)
  const handleSelectNode = useCallback((id: string) => {
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
    const layout = layoutMap[id];
    if (layout) {
      ensureVisible({
        minX: layout.x - layout.width / 2 - 20,
        minY: layout.y - layout.height / 2 - 60,
        maxX: layout.x + layout.width / 2 + 20,
        maxY: layout.y + layout.height / 2 + 60,
      });
    }
  }, [layoutMap, ensureVisible]);

  // Quick Add (+) 단계 추가
  const handleQuickAdd = (fromNodeId: string, dir: QuickAddDirection) => {
    const parentLayout = layoutMap[fromNodeId];
    if (!parentLayout) return;

    const currentM = modelRef.current;
    const newId = generateUniqueNodeId(currentM.nodes);
    const newSize = { width: 110, height: 48 };
    const newPos = findQuickAddPosition(parentLayout, dir, layoutMap, newSize);

    // 새 노드 생성
    let nextModel = addNode(currentM, { id: newId, label: '새 단계', shape: 'rect' });

    // 엣지 연결 (방향 흐름 고려)
    if (dir === 'right' || dir === 'bottom') {
      nextModel = addEdge(nextModel, { from: fromNodeId, to: newId, style: 'arrow' });
    } else {
      nextModel = addEdge(nextModel, { from: newId, to: fromNodeId, style: 'arrow' });
    }

    modelRef.current = nextModel;
    setNodePositions((prev) => ({ ...prev, [newId]: newPos }));
    onChange(nextModel);

    setSelectedNodeId(newId);
    setSelectedEdgeId(null);
    setEditingNodeId(newId);

    // 새 노드 위치 및 조작 막대 영역이 캔버스 안에 온전히 보이도록 패닝 자동 보정
    ensureVisible({
      minX: newPos.x - newSize.width / 2 - 20,
      minY: newPos.y - newSize.height / 2 - 60,
      maxX: newPos.x + newSize.width / 2 + 20,
      maxY: newPos.y + newSize.height / 2 + 60,
    });
  };

  // 포트 드래그 시작
  const handleStartConnect = (
    fromNodeId: string,
    fromPort: PortDirection,
    e: React.PointerEvent | React.MouseEvent,
  ) => {
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = (e.clientX - rect.left - pan.x) / zoom;
    const clientY = (e.clientY - rect.top - pan.y) / zoom;
    setConnecting({ fromNodeId, fromPort, currentX: clientX, currentY: clientY });
  };

  // 캔버스 배경 마우스 다운 (팬 또는 선택 해제)
  const handleCanvasPointerDown = (e: React.PointerEvent | React.MouseEvent) => {
    if (e.button !== 0) return;
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setEditingNodeId(null);
    setEditingEdgeId(null);

    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  // 포인터 이동 핸들러 (팬, 노드 이동, 연결선 드래그)
  const handlePointerMove = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (connecting) {
      const cx = (e.clientX - rect.left - pan.x) / zoom;
      const cy = (e.clientY - rect.top - pan.y) / zoom;
      setConnecting((prev) => (prev ? { ...prev, currentX: cx, currentY: cy } : null));
    } else if (draggingNodeId) {
      const dx = (e.clientX - dragStartRef.current.x) / zoom;
      const dy = (e.clientY - dragStartRef.current.y) / zoom;
      setNodePositions((prev) => ({
        ...prev,
        [draggingNodeId]: {
          x: Math.round(dragStartRef.current.nodeX + dx),
          y: Math.round(dragStartRef.current.nodeY + dy),
        },
      }));
    } else if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({
        x: Math.round(panStartRef.current.panX + dx),
        y: Math.round(panStartRef.current.panY + dy),
      });
    }
  };

  // 포인터 업 (드래그 종료 또는 포트 연결 완료)
  const handlePointerUp = (e: React.PointerEvent | React.MouseEvent) => {
    if (connecting) {
      // 드롭된 위치 아래에 다른 노드가 있는지 검사
      const elem = document.elementFromPoint(e.clientX, e.clientY);
      const targetNodeElem = elem?.closest('[data-node-id]');
      const targetNodeId = targetNodeElem?.getAttribute('data-node-id');

      if (targetNodeId && targetNodeId !== connecting.fromNodeId) {
        // 이미 같은 연결이 있는지 중복 체크
        const exists = modelRef.current.edges.some(
          (edge) => edge.from === connecting.fromNodeId && edge.to === targetNodeId,
        );
        if (!exists) {
          const nextModel = addEdge(modelRef.current, {
            from: connecting.fromNodeId,
            to: targetNodeId,
            style: 'arrow',
          });
          modelRef.current = nextModel;
          onChange(nextModel);
        }
      }
      setConnecting(null);
    }

    setIsPanning(false);
    setDraggingNodeId(null);
  };

  // 휠 확대/축소
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.min(Math.max(prev * factor, 0.25), 2.0));
  };

  // 키보드 Delete / Backspace 및 Esc 핸들러
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 입력칸에 포커스가 있으면 캔버스 삭제 단축키 무시
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          e.preventDefault();
          onChange(removeNode(model, selectedNodeId));
          setSelectedNodeId(null);
        } else if (selectedEdgeId) {
          e.preventDefault();
          onChange(removeEdge(model, selectedEdgeId));
          setSelectedEdgeId(null);
        }
      } else if (e.key === 'Escape') {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setEditingNodeId(null);
        setEditingEdgeId(null);
        setConnecting(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, selectedEdgeId, model, onChange]);

  const selectedNode = model.nodes.find((n) => n.id === selectedNodeId);
  const selectedEdge = model.edges.find((e) => e.id === selectedEdgeId);

  return (
    <div className="flex flex-1 min-h-0 size-full flex-col select-none overflow-hidden bg-[var(--surface)]">
      {/* 캔버스 상단 툴바 */}
      <CanvasToolbar
        direction={model.direction}
        onDirectionChange={handleDirectionChange}
        onUndo={onUndo}
        canUndo={canUndo}
        onRedo={onRedo}
        canRedo={canRedo}
        onAutoLayout={runAutoLayout}
        zoom={zoom}
        onZoomIn={() => setZoom((z) => Math.min(z + 0.15, 2))}
        onZoomOut={() => setZoom((z) => Math.max(z - 0.15, 0.25))}
        onZoomReset={() => setZoom(1)}
        onZoomFit={handleZoomFit}
        onSelectExample={(ex) => {
          if (model.nodes.length > 0 && !window.confirm('지금 편집 내용이 바뀝니다. 계속할까요?')) {
            return;
          }
          const res = parseFlowchart(ex.code);
          if (res.ok) {
            setNodePositions({});
            onChange(res.model);
          }
        }}
        showPreview={showPreview}
        onTogglePreview={onTogglePreview}
      />

      {/* 캔버스 작업 공간 */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 cursor-grab active:cursor-grabbing overflow-clip"
        onScroll={(e) => {
          e.currentTarget.scrollTop = 0;
          e.currentTarget.scrollLeft = 0;
        }}
        style={{
          backgroundColor: 'var(--surface)',
          backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onMouseDown={handleCanvasPointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onWheel={handleWheel}
      >
        {/* 줌/팬이 적용되는 변형 레이어 */}
        <div
          className="absolute inset-0 origin-top-left pointer-events-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* SVG 레이어 (연결선) */}
          <svg className="absolute inset-0 size-full overflow-visible pointer-events-none">
            <defs>
              <marker
                id="arrowhead-normal"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--muted)" />
              </marker>
              <marker
                id="arrowhead-selected"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--accent)" />
              </marker>
            </defs>

            {/* 엣지 목록 */}
            {model.edges.map((edge) => (
              <CanvasEdge
                key={edge.id}
                edge={edge}
                fromLayout={layoutMap[edge.from]}
                toLayout={layoutMap[edge.to]}
                isSelected={edge.id === selectedEdgeId}
                isEditing={edge.id === editingEdgeId}
                isOppositePair={model.edges.some((e) => e.from === edge.to && e.to === edge.from)}
                onSelect={(id) => {
                  setSelectedEdgeId(id);
                  setSelectedNodeId(null);
                }}
                onStartEdit={(id) => setEditingEdgeId(id)}
                onFinishEdit={(id, newLabel) => {
                  onChange(updateEdge(model, id, { label: newLabel }));
                  setEditingEdgeId(null);
                }}
                onCancelEdit={() => setEditingEdgeId(null)}
              />
            ))}

            {/* 포트에서 드래그 중인 임시 연결선 */}
            {connecting && layoutMap[connecting.fromNodeId] && (
              <line
                x1={layoutMap[connecting.fromNodeId].x}
                y1={layoutMap[connecting.fromNodeId].y}
                x2={connecting.currentX}
                y2={connecting.currentY}
                stroke="var(--accent)"
                strokeWidth={2}
                strokeDasharray="4,4"
              />
            )}
          </svg>

          {/* 노드 목록 (HTML 레이어) */}
          <div className="absolute inset-0 size-full pointer-events-none">
            {model.nodes.map((node) => (
              <CanvasNode
                key={node.id}
                node={node}
                layout={layoutMap[node.id] || { x: 100, y: 100, width: 100, height: 48 }}
                isSelected={node.id === selectedNodeId}
                isEditing={node.id === editingNodeId}
                onSelect={handleSelectNode}
                onStartEdit={(id) => setEditingNodeId(id)}
                onFinishEdit={(id, newLabel) => {
                  handleUpdateNode(id, { label: newLabel });
                  setEditingNodeId(null);
                }}
                onCancelEdit={() => setEditingNodeId(null)}
                onStartDrag={(id, e) => {
                  setDraggingNodeId(id);
                  const pos = nodePositions[id] || { x: 100, y: 100 };
                  dragStartRef.current = {
                    x: e.clientX,
                    y: e.clientY,
                    nodeX: pos.x,
                    nodeY: pos.y,
                  };
                }}
                onStartConnect={handleStartConnect}
                onQuickAdd={handleQuickAdd}
              />
            ))}
          </div>

          {/* 연결선 라벨 오버레이 레이어 (노드 및 + 버튼 위에 그려져 글자 가림 방지) */}
          <div className="absolute inset-0 size-full pointer-events-none z-30">
            {model.edges.map((edge) => {
              if (!edge.label && edge.id !== editingEdgeId) return null;
              const fromL = layoutMap[edge.from];
              const toL = layoutMap[edge.to];
              if (!fromL || !toL) return null;
              const isSelf = edge.from === edge.to;
              const midX = isSelf ? fromL.x : (fromL.x + toL.x) / 2;
              const midY = isSelf ? fromL.y - fromL.height / 2 - 35 : (fromL.y + toL.y) / 2;
              return (
                <div
                  key={edge.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer"
                  style={{ left: `${midX}px`, top: `${midY}px` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEdgeId(edge.id);
                    setSelectedNodeId(null);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingEdgeId(edge.id);
                  }}
                >
                  <span className="inline-block max-w-[130px] truncate rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-center text-[11px] font-medium text-[var(--text)] shadow-xs">
                    {edge.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* 선택 노드 플로팅 조작 바 */}
          <CanvasFloatingBar
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            nodeLayout={selectedNode ? layoutMap[selectedNode.id] : undefined}
            otherNodes={model.nodes.filter((n) => n.id !== selectedNodeId).map((n) => layoutMap[n.id]).filter(Boolean)}
            canvasBounds={
              containerRef.current
                ? {
                    minX: -pan.x / zoom,
                    minY: -pan.y / zoom,
                    maxX: (containerRef.current.clientWidth - pan.x) / zoom,
                    maxY: (containerRef.current.clientHeight - pan.y) / zoom,
                  }
                : undefined
            }
            onUpdateNode={handleUpdateNode}
            onDeleteNode={(id) => {
              onChange(removeNode(modelRef.current, id));
              setSelectedNodeId(null);
            }}
            onUpdateEdge={handleUpdateEdge}
            onDeleteEdge={(id) => {
              onChange(removeEdge(modelRef.current, id));
              setSelectedEdgeId(null);
            }}
          />
        </div>
      </div>

      {/* 하단 상태 줄 */}
      <CanvasStatusBar
        nodeCount={model.nodes.length}
        edgeCount={model.edges.length}
        direction={model.direction}
      />
    </div>
  );
};
