import type { EdgeStyle, FlowDirection, FlowEdge, FlowNode, NodeBorder, NodeColor, ParseResult } from './types';

/** 라벨 내의 특수 문자 언이스케이프 */
function unescapeLabel(raw: string): string {
  let s = raw.trim();
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    s = s.slice(1, -1);
  }
  return s
    .replace(/#quot;/g, '"')
    .replace(/<br\s*\/?>/gi, '\n');
}

/** 텍스트 조각에서 노드 ID, 라벨, 모양 추출 */
function parseNodeSnippet(snippet: string): FlowNode | null {
  let s = snippet.trim();
  if (!s) return null;

  let color: NodeColor | undefined;
  let border: NodeBorder | undefined;
  const inlineClassMatch = s.match(/^(.*?):::([a-zA-Z0-9_,-]+)$/);
  if (inlineClassMatch) {
    s = inlineClassMatch[1].trim();
    const classNames = inlineClassMatch[2].split(',').map((c) => c.trim());
    for (const cls of classNames) {
      if (cls === 'mv-dashed') border = 'dashed';
      else if (cls === 'mv-thick') border = 'thick';
      else if (cls.startsWith('mv-')) {
        const col = cls.slice(3) as NodeColor;
        if (['indigo', 'emerald', 'amber', 'rose', 'purple', 'slate'].includes(col)) {
          color = col;
        }
      }
    }
  }

  // cylinder: id[(label)]
  let m = s.match(/^([a-zA-Z0-9_-]+)\s*\[\(([\s\S]*)\)\]$/);
  if (m) return { id: m[1], label: unescapeLabel(m[2]), shape: 'cylinder', color, border };

  // stadium: id([label])
  m = s.match(/^([a-zA-Z0-9_-]+)\s*\(\[([\s\S]*)\]\)$/);
  if (m) return { id: m[1], label: unescapeLabel(m[2]), shape: 'stadium', color, border };

  // circle: id((label))
  m = s.match(/^([a-zA-Z0-9_-]+)\s*\(\(([\s\S]*)\)\)$/);
  if (m) return { id: m[1], label: unescapeLabel(m[2]), shape: 'circle', color, border };

  // hexagon: id{{label}}
  m = s.match(/^([a-zA-Z0-9_-]+)\s*\{\{([\s\S]*)\}\}$/);
  if (m) return { id: m[1], label: unescapeLabel(m[2]), shape: 'hexagon', color, border };

  // rhombus: id{label}
  m = s.match(/^([a-zA-Z0-9_-]+)\s*\{([\s\S]*)\}$/);
  if (m) return { id: m[1], label: unescapeLabel(m[2]), shape: 'rhombus', color, border };

  // round: id(label)
  m = s.match(/^([a-zA-Z0-9_-]+)\s*\(([\s\S]*)\)$/);
  if (m) return { id: m[1], label: unescapeLabel(m[2]), shape: 'round', color, border };

  // rect: id[label]
  m = s.match(/^([a-zA-Z0-9_-]+)\s*\[([\s\S]*)\]$/);
  if (m) return { id: m[1], label: unescapeLabel(m[2]), shape: 'rect', color, border };

  // 순수 ID만 있는 경우
  m = s.match(/^([a-zA-Z0-9_-]+)$/);
  if (m) return { id: m[1], label: m[1], shape: 'rect', color, border };

  return null;
}

interface ParsedEdgeInfo {
  style: EdgeStyle;
  label?: string;
}

function extractEdgeLabel(s: string): string | undefined {
  const quotedPipeMatch = s.match(/\|"([\s\S]*?)"\|/);
  if (quotedPipeMatch) return unescapeLabel(quotedPipeMatch[1]);
  const pipeMatch = s.match(/\|([\s\S]*?)\|/);
  if (pipeMatch) return unescapeLabel(pipeMatch[1]);
  const dashMatch = s.match(/^--\s*([\s\S]*?)\s*(?:-->|---)$/);
  if (dashMatch) return unescapeLabel(dashMatch[1]);
  const equalMatch = s.match(/^==\s*([\s\S]*?)\s*==>$/);
  if (equalMatch) return unescapeLabel(equalMatch[1]);
  const dotMatch = s.match(/^-\.\s*([\s\S]*?)\s*\.->$/);
  if (dotMatch) return unescapeLabel(dotMatch[1]);
  return undefined;
}

/** 화살표 텍스트 파싱 */
function parseEdgeInfo(raw: string): ParsedEdgeInfo {
  const s = raw.trim();
  const label = extractEdgeLabel(s);

  // 점선
  if (s.startsWith('-.') || s.endsWith('.->')) {
    return { style: 'dotted', label };
  }
  // 굵은선
  if (s.startsWith('==') || s.endsWith('==>')) {
    return { style: 'thick', label };
  }
  // 실선
  if (s.startsWith('---') || s.endsWith('---')) {
    return { style: 'line', label };
  }
  // 기본 화살표 (-->)
  return { style: 'arrow', label };
}

// 엣지 구분자 매칭 정규식 (따옴표 안의 파이프 | 문자를 보존하도록 \|(?:"[\s\S]*?"|[^|]*)\| 패턴 적용)
const EDGE_SPLIT_REGEX = /(\s*(?:-->|---|==>|===|-\.->|-\.-)(?:\|(?:"[\s\S]*?"|[^|]*)\|)?\s*|\s*--[\s\S]*?-->\s*|\s*--[\s\S]*?---\s*|\s*==[\s\S]*?==>\s*|\s*-\.[\s\S]*?\.->\s*)/;

/** 따옴표 밖에서만 엣지 구분자로 분할 */
function splitEdgesOutsideQuotes(line: string): string[] {
  return line.split(EDGE_SPLIT_REGEX).filter(Boolean);
}

/** 따옴표 밖에서만 &로 분할 */
function splitAmpersandsOutsideQuotes(str: string): string[] {
  const parts: string[] = [];
  let inQuotes = false;
  let current = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (ch === '&' && !inQuotes) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}

/**
 * 순서도 마크다운 코드를 파싱하여 FlowchartModel로 변환한다.
 */
export function parseFlowchart(code: string): ParseResult {
  const trimmed = code.trim();
  if (!trimmed) {
    return { ok: false, reason: 'unsupported', message: '내용이 없는 다이어그램입니다.' };
  }

  // subgraph 포함 여부 검사
  if (/\bsubgraph\b/i.test(trimmed)) {
    return {
      ok: false,
      reason: 'subgraph',
      message: '하위 그래프(subgraph)가 포함된 다이어그램은 그림 편집을 지원하지 않습니다. 코드 탭에서 편집해주세요.',
    };
  }

  // Windows 줄바꿈(\r\n) 안전 처리
  const lines = trimmed.split(/\r?\n/);
  const preservedLines: string[] = [];

  // 첫 비주석 줄 찾기
  let firstCodeLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('%%')) {
      preservedLines.push(lines[i]);
      continue;
    }
    firstCodeLineIndex = i;
    break;
  }

  if (firstCodeLineIndex === -1) {
    return { ok: false, reason: 'unsupported', message: '다이어그램 헤더를 찾을 수 없습니다.' };
  }

  const headerLine = lines[firstCodeLineIndex].trim();
  // 방향이 명시되어 있거나 방향 없는 flowchart / graph 지원
  const headerMatch = headerLine.match(/^(?:flowchart|graph)(?:\s+([A-Za-z]+))?$/i);
  if (!headerMatch) {
    return {
      ok: false,
      reason: 'unsupported',
      message: '순서도(flowchart/graph)만 그림 편집을 지원합니다. 코드 탭에서 편집해주세요.',
    };
  }

  let rawDir = headerMatch[1]?.toUpperCase() ?? 'TD';
  if (rawDir === 'TB') rawDir = 'TD';
  const validDirs: FlowDirection[] = ['TD', 'LR', 'BT', 'RL'];
  const direction: FlowDirection = validDirs.includes(rawDir as FlowDirection) ? (rawDir as FlowDirection) : 'TD';

  const nodeMap = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];
  let edgeSeq = 0;

  function registerNode(raw: string): string[] {
    const ids: string[] = [];
    const parts = splitAmpersandsOutsideQuotes(raw);
    for (const part of parts) {
      const parsed = parseNodeSnippet(part);
      if (!parsed) continue;
      ids.push(parsed.id);
      const existing = nodeMap.get(parsed.id);
      if (!existing || (parsed.label !== parsed.id && existing.label === existing.id)) {
        nodeMap.set(parsed.id, parsed);
      } else {
        if (parsed.color) existing.color = parsed.color;
        if (parsed.border) existing.border = parsed.border;
      }
    }
    return ids;
  }

  // 나머지 줄 순회
  for (let i = firstCodeLineIndex + 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    // 1) 우리 전용 classDef mv-* 줄 검사 (보존 줄에서 제외)
    const classDefMatch = line.match(/^classDef\s+(mv-[\w-]+)\b/);
    if (classDefMatch) {
      const clsName = classDefMatch[1];
      if (
        ['mv-indigo', 'mv-emerald', 'mv-amber', 'mv-rose', 'mv-purple', 'mv-slate', 'mv-dashed', 'mv-thick'].includes(
          clsName,
        )
      ) {
        continue;
      }
    }

    // 2) class 노드목록 클래스목록 검사
    const classMatch = line.match(/^class\s+([a-zA-Z0-9_,-]+)\s+([a-zA-Z0-9_,-]+)$/);
    if (classMatch) {
      const nodeIds = classMatch[1].split(',').map((id) => id.trim()).filter(Boolean);
      const classNames = classMatch[2].split(',').map((cls) => cls.trim()).filter(Boolean);

      const otherClasses: string[] = [];
      let hadManagedClass = false;

      for (const cls of classNames) {
        if (cls === 'mv-dashed') {
          hadManagedClass = true;
          for (const id of nodeIds) {
            const existing = nodeMap.get(id);
            if (existing) existing.border = 'dashed';
            else nodeMap.set(id, { id, label: id, shape: 'rect', border: 'dashed' });
          }
        } else if (cls === 'mv-thick') {
          hadManagedClass = true;
          for (const id of nodeIds) {
            const existing = nodeMap.get(id);
            if (existing) existing.border = 'thick';
            else nodeMap.set(id, { id, label: id, shape: 'rect', border: 'thick' });
          }
        } else if (cls.startsWith('mv-')) {
          const colorName = cls.slice(3) as NodeColor;
          if (['indigo', 'emerald', 'amber', 'rose', 'purple', 'slate'].includes(colorName)) {
            hadManagedClass = true;
            for (const id of nodeIds) {
              const existing = nodeMap.get(id);
              if (existing) existing.color = colorName;
              else nodeMap.set(id, { id, label: id, shape: 'rect', color: colorName });
            }
          } else {
            otherClasses.push(cls);
          }
        } else {
          otherClasses.push(cls);
        }
      }

      if (hadManagedClass) {
        if (otherClasses.length > 0) {
          preservedLines.push(`class ${classMatch[1]} ${otherClasses.join(',')}`);
        }
        continue;
      } else {
        preservedLines.push(rawLine);
        continue;
      }
    }

    // 보존 대상 줄 체크
    if (
      line.startsWith('%%') ||
      line.startsWith('style ') ||
      line.startsWith('classDef ') ||
      line.startsWith('class ') ||
      line.startsWith('linkStyle ') ||
      line.startsWith('click ') ||
      line.startsWith('accTitle:') ||
      line.startsWith('accDescr:')
    ) {
      preservedLines.push(rawLine);
      continue;
    }

    // 엣지 체인 분할
    const parts = splitEdgesOutsideQuotes(line);
    if (parts.length >= 3) {
      // 체인: Node [Edge Node]*
      let currentTargets = registerNode(parts[0]);
      for (let j = 1; j < parts.length; j += 2) {
        const edgeText = parts[j];
        const nextNodeText = parts[j + 1];
        if (!nextNodeText) break;

        const nextTargets = registerNode(nextNodeText);
        const edgeInfo = parseEdgeInfo(edgeText);

        for (const fromId of currentTargets) {
          for (const toId of nextTargets) {
            edges.push({
              id: `edge-${++edgeSeq}`,
              from: fromId,
              to: toId,
              label: edgeInfo.label,
              style: edgeInfo.style,
            });
          }
        }
        currentTargets = nextTargets;
      }
    } else {
      // 단독 노드
      const parsed = parseNodeSnippet(line);
      if (parsed) {
        nodeMap.set(parsed.id, parsed);
      } else {
        // 알 수 없는 줄은 보존
        preservedLines.push(rawLine);
      }
    }
  }

  return {
    ok: true,
    model: {
      direction,
      nodes: Array.from(nodeMap.values()),
      edges,
      preservedLines,
    },
  };
}
