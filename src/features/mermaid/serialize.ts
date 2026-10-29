import type { EdgeStyle, FlowchartModel, FlowNode, NodeColor } from './types';
import { NODE_COLOR_DEFS, NODE_BORDER_DEFS } from './types';

/** 라벨 내의 특수 문자 이스케이프 */
function escapeLabel(label: string): string {
  return label
    .replace(/"/g, '#quot;')
    .replace(/\r?\n/g, '<br/>')
    .trim();
}

/** 노드 모양에 따른 문자열 포맷 */
function formatNode(node: FlowNode): string {
  const rawLabel = node.label.trim() ? node.label : node.id;
  const escaped = escapeLabel(rawLabel);
  switch (node.shape) {
    case 'round':
      return `${node.id}("${escaped}")`;
    case 'rhombus':
      return `${node.id}{"${escaped}"}`;
    case 'circle':
      return `${node.id}(("${escaped}"))`;
    case 'stadium':
      return `${node.id}(["${escaped}"])`;
    case 'cylinder':
      return `${node.id}[("${escaped}")]`;
    case 'hexagon':
      return `${node.id}{{"${escaped}"}}`;
    case 'rect':
    default:
      return `${node.id}["${escaped}"]`;
  }
}

/** 엣지 스타일에 따른 기호 반환 */
function getArrowSymbol(style: EdgeStyle): string {
  switch (style) {
    case 'line':
      return '---';
    case 'dotted':
      return '-.->';
    case 'thick':
      return '==>';
    case 'arrow':
    default:
      return '-->';
  }
}

/**
 * FlowchartModel을 Mermaid 마크다운 문자열로 직렬화한다.
 */
export function serializeFlowchart(model: FlowchartModel): string {
  const lines: string[] = [];

  // 1. 헤더 (flowchart TD 등)
  lines.push(`flowchart ${model.direction}`);

  // 2. 노드 목록
  for (const node of model.nodes) {
    lines.push(`  ${formatNode(node)}`);
  }

  // 3. 엣지 목록
  for (const edge of model.edges) {
    const arrow = getArrowSymbol(edge.style);
    if (edge.label && edge.label.trim()) {
      const escapedEdgeLabel = escapeLabel(edge.label);
      lines.push(`  ${edge.from} ${arrow}|"${escapedEdgeLabel}"| ${edge.to}`);
    } else {
      lines.push(`  ${edge.from} ${arrow} ${edge.to}`);
    }
  }

  // 4. 색상 및 테두리 스타일 정의 (실제 사용된 것만 classDef 및 class 출력)
  const colors: NodeColor[] = ['indigo', 'emerald', 'amber', 'rose', 'purple', 'slate'];
  const usedColors = colors.filter((c) => model.nodes.some((n) => n.color === c));
  const hasDashed = model.nodes.some((n) => n.border === 'dashed');
  const hasThick = model.nodes.some((n) => n.border === 'thick');

  for (const color of usedColors) {
    lines.push(`  classDef mv-${color} ${NODE_COLOR_DEFS[color].classDef}`);
  }
  if (hasDashed) {
    lines.push(`  classDef mv-dashed ${NODE_BORDER_DEFS.dashed.classDef}`);
  }
  if (hasThick) {
    lines.push(`  classDef mv-thick ${NODE_BORDER_DEFS.thick.classDef}`);
  }

  for (const color of usedColors) {
    const ids = model.nodes.filter((n) => n.color === color).map((n) => n.id).join(',');
    lines.push(`  class ${ids} mv-${color}`);
  }
  if (hasDashed) {
    const ids = model.nodes.filter((n) => n.border === 'dashed').map((n) => n.id).join(',');
    lines.push(`  class ${ids} mv-dashed`);
  }
  if (hasThick) {
    const ids = model.nodes.filter((n) => n.border === 'thick').map((n) => n.id).join(',');
    lines.push(`  class ${ids} mv-thick`);
  }

  // 5. 보존된 줄 (주석, 외부 style 등 원본 순서대로)
  for (const pline of model.preservedLines) {
    lines.push(pline);
  }

  return lines.join('\n');
}
