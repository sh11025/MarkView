import { describe, expect, it } from 'vitest';
import { DIAGRAM_EXAMPLES } from '../../constants/diagramExamples';
import { parseFlowchart, serializeFlowchart } from './index';

describe('diagram examples (예시 4종 왕복 안정성 검증)', () => {
  it('예시 4종 모두 정상 파싱되고 노드/엣지/색상이 파싱된다', () => {
    expect(DIAGRAM_EXAMPLES).toHaveLength(4);

    for (const ex of DIAGRAM_EXAMPLES) {
      const res = parseFlowchart(ex.code);
      expect(res.ok, `[${ex.name}] 파싱 실패: ${res.ok ? '' : res.message}`).toBe(true);
      if (!res.ok) continue;

      expect(res.model.nodes.length, `[${ex.name}] 노드가 3개 이상이어야 함`).toBeGreaterThanOrEqual(3);
      expect(res.model.edges.length, `[${ex.name}] 엣지가 2개 이상이어야 함`).toBeGreaterThanOrEqual(2);

      // 색상이 1개 이상 지정되어 있어야 함
      const hasColor = res.model.nodes.some((n) => !!n.color);
      expect(hasColor, `[${ex.name}] 색상 지정이 있어야 함`).toBe(true);

      // 직렬화 후 재파싱 왕복 검증
      const serialized = serializeFlowchart(res.model);
      const res2 = parseFlowchart(serialized);
      expect(res2.ok).toBe(true);
      if (!res2.ok) continue;

      expect(res2.model.nodes).toHaveLength(res.model.nodes.length);
      expect(res2.model.edges).toHaveLength(res.model.edges.length);
      expect(res2.model.direction).toBe(res.model.direction);

      const serialized2 = serializeFlowchart(res2.model);
      expect(serialized2).toBe(serialized);
    }
  });
});
