import { describe, expect, it } from 'vitest';
import {
  parseFlowchart,
  serializeFlowchart,
  addNode,
  removeNode,
  updateNode,
  addEdge,
  removeEdge,
  setDirection,
  moveNode,
  generateUniqueNodeId,
  canApplyChanges,
  type FlowchartModel,
  type NodeColor,
} from './index';

describe('mermaid parser & serializer — 기본 기능', () => {
  it('기본 flowchart LR을 정상 파싱한다', () => {
    const code = `
flowchart LR
  A["시작"] --> B["완료"]
`;
    const res = parseFlowchart(code);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.model.direction).toBe('LR');
    expect(res.model.nodes).toHaveLength(2);
    expect(res.model.nodes[0]).toEqual({ id: 'A', label: '시작', shape: 'rect' });
    expect(res.model.nodes[1]).toEqual({ id: 'B', label: '완료', shape: 'rect' });
    expect(res.model.edges).toHaveLength(1);
    expect(res.model.edges[0]).toMatchObject({ from: 'A', to: 'B', style: 'arrow' });
  });

  it('다양한 노드 모양과 특수문자/줄바꿈을 파싱하고 직렬화한다', () => {
    const code = `
flowchart TD
  A["직사각형"]
  B("둥근모서리")
  C{"마름모"}
  D(("원"))
  E(["경기장"])
  F[("원통")]
  G{{"육각형"}}
  A -->|라벨| B
  B --- C
  C -.->|점선| D
  D ==>|굵은선| E
`;
    const res = parseFlowchart(code);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const shapes = res.model.nodes.map((n) => n.shape);
    expect(shapes).toEqual(['rect', 'round', 'rhombus', 'circle', 'stadium', 'cylinder', 'hexagon']);

    const edgeStyles = res.model.edges.map((e) => e.style);
    expect(edgeStyles).toEqual(['arrow', 'line', 'dotted', 'thick']);

    const serialized = serializeFlowchart(res.model);
    expect(serialized).toContain('flowchart TD');
    expect(serialized).toContain('A["직사각형"]');
    expect(serialized).toContain('B("둥근모서리")');
    expect(serialized).toContain('C{"마름모"}');
    expect(serialized).toContain('D(("원"))');
    expect(serialized).toContain('E(["경기장"])');
    expect(serialized).toContain('F[("원통")]');
    expect(serialized).toContain('G{{"육각형"}}');
  });

  it('체인 연결과 다중 노드 연결(&)을 분해하여 파싱한다', () => {
    const code = `
flowchart TD
  A --> B --> C
  D & E --> F
`;
    const res = parseFlowchart(code);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.model.edges.some((e) => e.from === 'A' && e.to === 'B')).toBe(true);
    expect(res.model.edges.some((e) => e.from === 'B' && e.to === 'C')).toBe(true);
    expect(res.model.edges.some((e) => e.from === 'D' && e.to === 'F')).toBe(true);
    expect(res.model.edges.some((e) => e.from === 'E' && e.to === 'F')).toBe(true);
  });

  it('subgraph가 포함된 코드는 사유를 담아 거부한다', () => {
    const code = `
flowchart TD
  subgraph 그룹1
    A --> B
  end
`;
    const res = parseFlowchart(code);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe('subgraph');
    expect(res.message).toContain('하위 그래프');
  });

  it('순서도가 아닌 다이어그램(시퀀스 등)은 사유를 담아 거부한다', () => {
    const code = `
sequenceDiagram
  Alice->>Bob: Hello
`;
    const res = parseFlowchart(code);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe('unsupported');
    expect(res.message).toContain('순서도');
  });
});

describe('mermaid parser & serializer — 12개 정밀 요구사항 검증', () => {
  // 1. 엣지 라벨 두 문법
  it('1. 엣지 라벨 두 문법(A -->|글자| B, A -- 글자 --> B) 둘 다 파싱되고 직렬화 후 왕복해도 라벨이 보존된다', () => {
    const code1 = 'flowchart TD\n  A -->|진행 라벨| B';
    const code2 = 'flowchart TD\n  A -- 진행 라벨 --> B';

    const res1 = parseFlowchart(code1);
    const res2 = parseFlowchart(code2);
    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);
    if (!res1.ok || !res2.ok) return;

    expect(res1.model.edges[0].label).toBe('진행 라벨');
    expect(res2.model.edges[0].label).toBe('진행 라벨');

    // 직렬화 후 다시 파싱해도 동일한 라벨
    const s1 = serializeFlowchart(res1.model);
    const s2 = serializeFlowchart(res2.model);
    const round1 = parseFlowchart(s1);
    const round2 = parseFlowchart(s2);
    expect(round1.ok && round1.model.edges[0].label).toBe('진행 라벨');
    expect(round2.ok && round2.model.edges[0].label).toBe('진행 라벨');
  });

  // 2. 화살표 종류 4가지 왕복
  it('2. 화살표 종류 4가지(-->, ---, -.->/.-., ==>) 각각 왕복(parse -> serialize -> parse) 후 스타일이 동일하다', () => {
    const code = [
      'flowchart TD',
      '  A --> B',
      '  B --- C',
      '  C -.-> D',
      '  D ==> E',
    ].join('\n');

    const res = parseFlowchart(code);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.model.edges.map((e) => e.style)).toEqual(['arrow', 'line', 'dotted', 'thick']);

    const s = serializeFlowchart(res.model);
    const round = parseFlowchart(s);
    expect(round.ok).toBe(true);
    if (!round.ok) return;
    expect(round.model.edges.map((e) => e.style)).toEqual(['arrow', 'line', 'dotted', 'thick']);
  });

  // 3. 방향 5종 및 방향 없는 flowchart/graph
  it('3. 방향 5종(TD, TB, LR, RL, BT)과 방향 없는 flowchart/graph 모두 올바른 direction으로 파싱된다', () => {
    expect(parseFlowchart('flowchart TD\n  A').ok ? (parseFlowchart('flowchart TD\n  A') as any).model.direction : '').toBe('TD');
    expect(parseFlowchart('flowchart TB\n  A').ok ? (parseFlowchart('flowchart TB\n  A') as any).model.direction : '').toBe('TD');
    expect(parseFlowchart('graph LR\n  A').ok ? (parseFlowchart('graph LR\n  A') as any).model.direction : '').toBe('LR');
    expect(parseFlowchart('flowchart RL\n  A').ok ? (parseFlowchart('flowchart RL\n  A') as any).model.direction : '').toBe('RL');
    expect(parseFlowchart('graph BT\n  A').ok ? (parseFlowchart('graph BT\n  A') as any).model.direction : '').toBe('BT');
    // 방향 없는 경우 -> 기본 TD
    expect(parseFlowchart('flowchart\n  A').ok ? (parseFlowchart('flowchart\n  A') as any).model.direction : '').toBe('TD');
    expect(parseFlowchart('graph\n  A').ok ? (parseFlowchart('graph\n  A') as any).model.direction : '').toBe('TD');
  });

  // 4. 한 줄에 노드 정의가 붙은 엣지
  it('4. 한 줄에 노드 정의가 붙은 엣지 A[시작] --> B{선택}의 노드 모양과 라벨이 올바르게 파싱된다', () => {
    const code = 'flowchart TD\n  A[시작 단계] --> B{선택 조건}';
    const res = parseFlowchart(code);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const nodeA = res.model.nodes.find((n) => n.id === 'A');
    const nodeB = res.model.nodes.find((n) => n.id === 'B');
    expect(nodeA).toEqual({ id: 'A', label: '시작 단계', shape: 'rect' });
    expect(nodeB).toEqual({ id: 'B', label: '선택 조건', shape: 'rhombus' });
  });

  // 5. 한글 라벨 및 특수문자 왕복
  it('5. 한글 라벨 및 특수문자 ( ) [ ] { } | " & < > 가 들어 있어도 직렬화 후 왕복 파싱 결과가 일치한다', () => {
    const complexLabel = '한글(소괄호)[대괄호]{중괄호}|파이프"따옴표"&앰퍼샌드<태그>';
    const model: FlowchartModel = {
      direction: 'TD',
      nodes: [
        { id: 'node1', label: complexLabel, shape: 'rect' },
        { id: 'node2', label: '단순노드', shape: 'round' },
      ],
      edges: [{ id: 'e1', from: 'node1', to: 'node2', label: '엣지|라벨"특수"&테스트', style: 'arrow' }],
      preservedLines: [],
    };

    const s = serializeFlowchart(model);
    const parsed = parseFlowchart(s);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.model.nodes[0].label).toBe(complexLabel);
    expect(parsed.model.edges[0].label).toBe('엣지|라벨"특수"&테스트');
  });

  // 6. 라벨이 비어 있을 때 직렬화 및 줄바꿈 왕복
  it('6. 라벨이 비어 있을 때 노드 id를 라벨로 직렬화하고 줄바꿈(<br/>) 라벨이 왕복 보존된다', () => {
    const model: FlowchartModel = {
      direction: 'TD',
      nodes: [
        { id: 'emptyNode', label: '', shape: 'rect' },
        { id: 'multilineNode', label: '첫째줄\n둘째줄\n셋째줄', shape: 'round' },
      ],
      edges: [],
      preservedLines: [],
    };

    const s = serializeFlowchart(model);
    // 빈 라벨은 id를 써서 출력
    expect(s).toContain('emptyNode["emptyNode"]');
    expect(s).toContain('multilineNode("첫째줄<br/>둘째줄<br/>셋째줄")');

    const parsed = parseFlowchart(s);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.model.nodes[0].label).toBe('emptyNode');
    expect(parsed.model.nodes[1].label).toBe('첫째줄\n둘째줄\n셋째줄');
  });

  // 7. 보존 줄 순서 유지 및 불필요한 style/classDef 미생성
  it('7. 보존 줄(%%, style, classDef, class, linkStyle, click)의 내용과 상대 순서가 유지되고 임의의 style/classDef를 생성하지 않는다', () => {
    const code = [
      'flowchart TD',
      '  A --> B',
      '  %% 주석 1',
      '  style A fill:#fff',
      '  classDef redCls color:#f00',
      '  class A redCls',
      '  linkStyle 0 stroke:#00f',
      '  click A "https://example.com"',
      '  %% 주석 2',
    ].join('\n');

    const res = parseFlowchart(code);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const s = serializeFlowchart(res.model);
    expect(s).toContain('%% 주석 1');
    expect(s).toContain('style A fill:#fff');
    expect(s).toContain('classDef redCls color:#f00');
    expect(s).toContain('class A redCls');
    expect(s).toContain('linkStyle 0 stroke:#00f');
    expect(s).toContain('click A "https://example.com"');
    expect(s).toContain('%% 주석 2');

    // 보존 줄이 없는 모델을 직렬화하면 style, classDef라는 단어가 없어야 함
    const cleanModel: FlowchartModel = {
      direction: 'LR',
      nodes: [{ id: 'X', label: '라벨', shape: 'rect' }],
      edges: [],
      preservedLines: [],
    };
    const cleanSerialized = serializeFlowchart(cleanModel);
    expect(cleanSerialized).not.toContain('style');
    expect(cleanSerialized).not.toContain('classDef');
  });

  // 8. 빈 문자열/공백만 있는 코드 안전 처리
  it('8. 빈 문자열 또는 공백만 있는 코드 입력 시 ok: false로 안전하게 반환한다', () => {
    expect(parseFlowchart('').ok).toBe(false);
    expect(parseFlowchart('   \n\t  \n  ').ok).toBe(false);
  });

  // 9. 자동 ID 생성 충돌 방지
  it('9. 자동 id 생성은 기존 id(A, B, C -> D 또는 한글/임의 id 혼합)와 충돌하지 않는다', () => {
    // 1) A, B, C가 있으면 다음은 D
    const nodesABC = [
      { id: 'A', label: '1', shape: 'rect' as const },
      { id: 'B', label: '2', shape: 'rect' as const },
      { id: 'C', label: '3', shape: 'rect' as const },
    ];
    expect(generateUniqueNodeId(nodesABC)).toBe('D');

    // 2) A, C만 있는 경우에도 충돌 없는 대문자 선택 (B)
    const nodesAC = [
      { id: 'A', label: '1', shape: 'rect' as const },
      { id: 'C', label: '2', shape: 'rect' as const },
    ];
    expect(generateUniqueNodeId(nodesAC)).toBe('B');

    // 3) 한글 ID 또는 임의 ID가 섞여 있어도 기존 ID와 절대 충돌하지 않음
    const mixedNodes = [
      { id: '시작노드', label: '시작', shape: 'rect' as const },
      { id: 'node1', label: '1', shape: 'rect' as const },
      { id: 'node2', label: '2', shape: 'rect' as const },
    ];
    const generated = generateUniqueNodeId(mixedNodes);
    expect(mixedNodes.some((n) => n.id === generated)).toBe(false);
    expect(generated).toBe('node3');
  });

  // 10. 직렬화 결과 끝에 줄바꿈 없고 \n 사용
  it('10. 직렬화 결과 끝에 불필요한 줄바꿈이 없고 줄바꿈 코드는 \\n이다', () => {
    const model: FlowchartModel = {
      direction: 'TD',
      nodes: [
        { id: 'A', label: 'A', shape: 'rect' },
        { id: 'B', label: 'B', shape: 'rect' },
      ],
      edges: [{ id: 'e1', from: 'A', to: 'B', style: 'arrow' }],
      preservedLines: [],
    };
    const s = serializeFlowchart(model);
    expect(s.endsWith('\n')).toBe(false);
    expect(s.endsWith('\r')).toBe(false);
    expect(s).not.toContain('\r\n');
    expect(s).toContain('\n');
  });

  // 11. serialize -> parse -> serialize 불변성 (안정성)
  it('11. 같은 모델에 대해 serialize -> parse -> serialize 결과 문자열이 완전히 동일하다', () => {
    const initialModel: FlowchartModel = {
      direction: 'TD',
      nodes: [
        { id: 'start', label: '시작 "따옴표"', shape: 'stadium' },
        { id: 'proc', label: '처리\n줄바꿈', shape: 'cylinder' },
        { id: 'end', label: '완료', shape: 'circle' },
      ],
      edges: [
        { id: 'e1', from: 'start', to: 'proc', label: '진행', style: 'arrow' },
        { id: 'e2', from: 'proc', to: 'end', style: 'thick' },
      ],
      preservedLines: ['  %% 주석', '  style start fill:#fff'],
    };

    const s1 = serializeFlowchart(initialModel);
    const parsed = parseFlowchart(s1);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const s2 = serializeFlowchart(parsed.model);
    expect(s2).toBe(s1);
  });

  // 12. Windows 줄바꿈 (\r\n) 파싱
  it('12. Windows 줄바꿈(\\r\\n)이 포함된 코드도 문제없이 파싱된다', () => {
    const winCode = 'flowchart LR\r\n  A["시작"] --> B["끝"]\r\n  %% 주석\r\n';
    const res = parseFlowchart(winCode);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.model.direction).toBe('LR');
    expect(res.model.nodes).toHaveLength(2);
    expect(res.model.nodes[0].label).toBe('시작');
    expect(res.model.nodes[1].label).toBe('끝');
    expect(res.model.preservedLines).toContain('  %% 주석');
  });
});

describe('mermaid operations', () => {
  const sampleModel: FlowchartModel = {
    direction: 'TD',
    nodes: [
      { id: 'A', label: 'A단계', shape: 'rect' },
      { id: 'B', label: 'B단계', shape: 'round' },
    ],
    edges: [{ id: 'e1', from: 'A', to: 'B', style: 'arrow' }],
    preservedLines: [],
  };

  it('노드를 삭제하면 연결된 엣지도 함께 삭제된다', () => {
    const next = removeNode(sampleModel, 'A');
    expect(next.nodes).toHaveLength(1);
    expect(next.nodes[0].id).toBe('B');
    expect(next.edges).toHaveLength(0);
  });

  it('노드를 추가/수정/순서이동할 수 있다', () => {
    let m = addNode(sampleModel, { label: 'C단계', shape: 'circle' });
    expect(m.nodes).toHaveLength(3);
    const newId = m.nodes[2].id;

    m = updateNode(m, newId, { label: 'C_수정' });
    expect(m.nodes[2].label).toBe('C_수정');

    m = moveNode(m, 2, 0);
    expect(m.nodes[0].id).toBe(newId);
  });

  it('엣지를 추가/삭제할 수 있다', () => {
    let m = addEdge(sampleModel, { from: 'B', to: 'A', style: 'dotted', label: '되돌아가기' });
    expect(m.edges).toHaveLength(2);
    expect(m.edges[1].style).toBe('dotted');

    m = removeEdge(m, 'e1');
    expect(m.edges).toHaveLength(1);
    expect(m.edges[0].from).toBe('B');
  });

  it('방향을 변경할 수 있다', () => {
    const m = setDirection(sampleModel, 'LR');
    expect(m.direction).toBe('LR');
  });

  it('canApplyChanges는 원문이 변경되었을 때 false를 반환한다', () => {
    const original = ['flowchart TD', '  A --> B'];
    const currentDoc = ['# 제목', '', '```mermaid', 'flowchart TD', '  A --> B', '```', '', '본문'];

    // 정확히 일치 (3번째 줄부터 5번째 줄까지)
    expect(canApplyChanges(original, currentDoc, 3, 5)).toBe(true);

    // 원문이 수정된 경우
    const modifiedDoc = ['# 제목', '', '```mermaid', 'flowchart TD', '  A --> C', '```', '', '본문'];
    expect(canApplyChanges(original, modifiedDoc, 3, 5)).toBe(false);

    // 범위가 잘못된 경우
    expect(canApplyChanges(original, currentDoc, 10, 15)).toBe(false);
  });
});

describe('mermaid node colors & borders (mv-* classes)', () => {
  const allColors: NodeColor[] = ['indigo', 'emerald', 'amber', 'rose', 'purple', 'slate'];

  it('색 6종 각각과 dashed/thick 속성이 serialize -> parse -> serialize 왕복 시 완벽히 보존된다', () => {
    for (const color of allColors) {
      const model: FlowchartModel = {
        direction: 'TD',
        nodes: [
          { id: 'A', label: '노드1', shape: 'rect', color, border: 'dashed' },
          { id: 'B', label: '노드2', shape: 'round', color, border: 'thick' },
        ],
        edges: [{ id: 'e1', from: 'A', to: 'B', style: 'arrow' }],
        preservedLines: [],
      };

      const serialized1 = serializeFlowchart(model);
      expect(serialized1).toContain(`classDef mv-${color}`);
      expect(serialized1).toContain('classDef mv-dashed');
      expect(serialized1).toContain('classDef mv-thick');
      expect(serialized1).toContain(`class A,B mv-${color}`);
      expect(serialized1).toContain('class A mv-dashed');
      expect(serialized1).toContain('class B mv-thick');

      const parseRes = parseFlowchart(serialized1);
      expect(parseRes.ok).toBe(true);
      if (!parseRes.ok) return;

      expect(parseRes.model.nodes[0].color).toBe(color);
      expect(parseRes.model.nodes[0].border).toBe('dashed');
      expect(parseRes.model.nodes[1].color).toBe(color);
      expect(parseRes.model.nodes[1].border).toBe('thick');

      // 재직렬화 결과 일치
      const serialized2 = serializeFlowchart(parseRes.model);
      expect(serialized2).toBe(serialized1);
    }
  });

  it('색과 테두리가 없는 기본 노드는 classDef나 class 구문을 생성하지 않는다', () => {
    const model: FlowchartModel = {
      direction: 'LR',
      nodes: [
        { id: 'A', label: 'A', shape: 'rect' },
        { id: 'B', label: 'B', shape: 'round', border: 'solid' },
      ],
      edges: [{ id: 'e1', from: 'A', to: 'B', style: 'arrow' }],
      preservedLines: [],
    };
    const s = serializeFlowchart(model);
    expect(s).not.toContain('classDef');
    expect(s).not.toContain('class ');
  });

  it('같은 색을 가진 여러 노드는 한 줄의 class 구문으로 묶여 직렬화된다', () => {
    const model: FlowchartModel = {
      direction: 'LR',
      nodes: [
        { id: 'A', label: 'A', shape: 'rect', color: 'indigo' },
        { id: 'B', label: 'B', shape: 'rect', color: 'indigo' },
        { id: 'C', label: 'C', shape: 'rect', color: 'emerald' },
      ],
      edges: [],
      preservedLines: [],
    };
    const s = serializeFlowchart(model);
    expect(s).toContain('class A,B mv-indigo');
    expect(s).toContain('class C mv-emerald');
  });

  it('색상과 테두리가 조합된 노드를 파싱하고 직렬화할 수 있다', () => {
    const code = `flowchart TD
  A["시작"]
  classDef mv-amber fill:#fef3c7,stroke:#f59e0b,color:#78350f
  classDef mv-dashed stroke-dasharray:5 5
  class A mv-amber
  class A mv-dashed`;
    const res = parseFlowchart(code);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.model.nodes[0].color).toBe('amber');
    expect(res.model.nodes[0].border).toBe('dashed');
    expect(res.model.preservedLines).toHaveLength(0); // mv-* 관련 정의는 보존줄에서 빠짐
  });

  it('쉼표로 여러 노드와 클래스가 적힌 class A,B mv-indigo,mv-dashed 형태를 정확히 읽는다', () => {
    const code = `flowchart TD
  A["A"] --> B["B"]
  class A,B mv-indigo,mv-dashed`;
    const res = parseFlowchart(code);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.model.nodes[0].color).toBe('indigo');
    expect(res.model.nodes[0].border).toBe('dashed');
    expect(res.model.nodes[1].color).toBe('indigo');
    expect(res.model.nodes[1].border).toBe('dashed');
  });

  it('우리 것이 아닌 일반 classDef 및 class 보존 줄은 그대로 유지된다', () => {
    const code = `flowchart TD
  A["A"] --> B["B"]
  classDef customCls fill:#123456
  class A customCls
  class B mv-rose`;
    const res = parseFlowchart(code);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.model.nodes[1].color).toBe('rose');
    expect(res.model.preservedLines).toContain('  classDef customCls fill:#123456');
    expect(res.model.preservedLines).toContain('  class A customCls');
  });

  it('사용하지 않는 색상의 classDef는 직렬화 결과에 생성되지 않는다', () => {
    const model: FlowchartModel = {
      direction: 'TD',
      nodes: [{ id: 'A', label: 'A', shape: 'rect', color: 'indigo' }],
      edges: [],
      preservedLines: [],
    };
    const s = serializeFlowchart(model);
    expect(s).toContain('classDef mv-indigo');
    expect(s).not.toContain('classDef mv-emerald');
    expect(s).not.toContain('classDef mv-amber');
    expect(s).not.toContain('classDef mv-rose');
    expect(s).not.toContain('classDef mv-purple');
    expect(s).not.toContain('classDef mv-slate');
    expect(s).not.toContain('classDef mv-dashed');
    expect(s).not.toContain('classDef mv-thick');
  });

  it('노드를 삭제하면 직렬화 시 그 노드의 class 지정도 함께 사라진다', () => {
    const model: FlowchartModel = {
      direction: 'TD',
      nodes: [
        { id: 'A', label: 'A', shape: 'rect', color: 'indigo' },
        { id: 'B', label: 'B', shape: 'rect', color: 'emerald' },
      ],
      edges: [],
      preservedLines: [],
    };
    const next = removeNode(model, 'A');
    const s = serializeFlowchart(next);
    expect(s).not.toContain('classDef mv-indigo');
    expect(s).not.toContain('mv-indigo');
    expect(s).toContain('classDef mv-emerald');
    expect(s).toContain('class B mv-emerald');
  });
});
