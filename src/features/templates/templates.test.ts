// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { TEMPLATES, TEMPLATE_CATEGORIES } from '../../constants/templates';
import { applyTemplate, formatDate } from './applyTemplate';
import { renderMarkdown } from '../../render/markdown';
import { sanitizeHtml } from '../../render/sanitize';
import { parseFlowchart } from '../mermaid/parse';

describe('Document Templates (확장된 템플릿 검증)', () => {
  it('템플릿이 35개 이상이며 id가 모두 고유하다', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(35);
    const ids = TEMPLATES.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('모든 카테고리(7개)에 템플릿이 각각 최소 4개 이상 존재한다', () => {
    const counts: Record<string, number> = {};
    for (const cat of TEMPLATE_CATEGORIES) {
      counts[cat] = 0;
    }
    for (const t of TEMPLATES) {
      counts[t.category] = (counts[t.category] || 0) + 1;
    }

    for (const cat of TEMPLATE_CATEGORIES) {
      expect(counts[cat]).toBeGreaterThanOrEqual(4);
    }
  });

  it('모든 템플릿의 필수 메타데이터(id, name, category, description, content)가 비어 있지 않다', () => {
    for (const t of TEMPLATES) {
      expect(t.id.trim()).not.toBe('');
      expect(t.name.trim()).not.toBe('');
      expect(t.category.trim()).not.toBe('');
      expect(t.description.trim()).not.toBe('');
      expect(t.content.trim()).not.toBe('');
    }
  });

  it('모든 템플릿의 content가 renderMarkdown에서 예외 없이 렌더되고 최소 하나의 h1 제목이 있다', () => {
    for (const t of TEMPLATES) {
      const rendered = renderMarkdown(applyTemplate(t.content));
      expect(rendered.html).toBeDefined();
      expect(rendered.html).toMatch(/<h1[^>]*>.*?<\/h1>/);
    }
  });

  it('mermaid 블록이 있는 템플릿 개수가 E2E 테스트에 명시된 5개와 정확히 일치한다', () => {
    // 새 mermaid 템플릿이 추가되면 E2E(markview.spec.ts)의 검증 목록도 함께 갱신해야 함
    const expectedMermaidTemplateNames = [
      '프로세스 문서',
      '프로젝트 일정표(gantt/표)',
      '순서도 예시',
      '시퀀스 다이어그램 예시',
      '조직도(mermaid)',
    ];

    const actualMermaidTemplates = TEMPLATES.filter((t) => {
      const html = renderMarkdown(applyTemplate(t.content)).html;
      return html.includes('class="mermaid-block"') || /```mermaid/i.test(t.content);
    });

    expect(actualMermaidTemplates.length).toBe(5);
    expect(actualMermaidTemplates.map((t) => t.name)).toEqual(expectedMermaidTemplateNames);
  });

  it('순서도(flowchart/graph) 템플릿의 mermaid 코드는 parseFlowchart에서 정상 파싱되고 노드 글자에 괄호/쌍점이 있으면 따옴표로 감싸져 있다', () => {
    const flowchartTemplateIds = ['process-document', 'flowchart-sample', 'org-chart-mermaid'];

    for (const id of flowchartTemplateIds) {
      const t = TEMPLATES.find((item) => item.id === id);
      expect(t).toBeDefined();
      const match = t!.content.match(/```mermaid\n([\s\S]*?)```/);
      expect(match).not.toBeNull();
      const code = match![1];

      // 캔버스 파서 검증
      const parsed = parseFlowchart(code);
      expect(parsed.ok).toBe(true);

      // 따옴표 없는 대괄호/중괄호 노드 안에 괄호()나 쌍점(:), 슬래시(/)가 없는지 검증
      for (const rawLine of code.split('\n')) {
        const line = rawLine.trim();
        if (!line || /^(?:flowchart|graph)\b/i.test(line)) continue;
        // 따옴표로 감싸진 문자열을 제거한 나머지 부분에서 노드 정의 확인
        const withoutQuoted = line.replace(/"[^"]*"/g, '""');
        // [ ... ] 또는 { ... } 안에 따옴표 없이 (, ), :, / 가 남아있으면 안 됨
        const unquotedBrackets = withoutQuoted.match(/\[[^"\]]+\]|\{[^"\}]+\}/g) ?? [];
        for (const token of unquotedBrackets) {
          const inner = token.slice(1, -1);
          expect(inner, `${t!.name}의 노드 토큰 ${token}에 따옴표 없는 특수문자가 있음`).not.toMatch(/[():/]/);
        }
      }
    }
  });

  it('수식 포함 템플릿들은 KaTeX 수식(.katex)을 생성하고 본문에 미변환 $$나 \\frac이 남지 않는다', () => {
    const mathTemplateIds = ['study-notes', 'cornell-notes', 'exam-prep-summary', 'paper-reading-notes', 'math-formula-reference'];

    for (const id of mathTemplateIds) {
      const t = TEMPLATES.find((item) => item.id === id);
      expect(t).toBeDefined();
      const html = renderMarkdown(applyTemplate(t!.content)).html;
      expect(html).toContain('class="katex"');

      const div = document.createElement('div');
      div.innerHTML = html;
      // code 태그와 katex-mathml(접근성용 원문)을 제거한 텍스트에 미변환 LaTeX 명령어나 $$가 없어야 함
      div.querySelectorAll('code, pre, .katex-mathml').forEach((el) => el.remove());
      expect(div.textContent).not.toContain('$$');
      expect(div.textContent).not.toContain('\\frac');
      expect(div.textContent).not.toContain('\\cdots');
    }
  });

  it('모든 템플릿의 마크다운 표 열 개수가 일치하고 콜아웃 문법 오류가 없다', () => {
    for (const t of TEMPLATES) {
      const applied = applyTemplate(t.content);

      // 원문 표의 파이프(|) 열 개수 일관성 검증 (코드 블록 제외)
      const withoutFences = applied.replace(/```[\s\S]*?```/g, '');
      const lines = withoutFences.split('\n');
      let expectedCols: number | null = null;
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.startsWith('|') && line.endsWith('|')) {
          const cols = line.slice(1, -1).split('|').length;
          if (expectedCols === null) {
            expectedCols = cols;
          } else {
            expect(cols, `${t.name} 템플릿의 표 열 개수가 일치하지 않음: ${line}`).toBe(expectedCols);
          }
        } else {
          expectedCols = null;
        }
      }

      const rendered = renderMarkdown(applied);
      const clean = sanitizeHtml(rendered.html);
      expect(clean.trim().length).toBeGreaterThan(0);
      expect(clean).toContain('<h1');

      // 콜아웃 마커가 변환되지 않고 본문에 노출된 곳이 없는지 확인
      const div = document.createElement('div');
      div.innerHTML = clean;
      div.querySelectorAll('code, pre').forEach((el) => el.remove());
      expect(div.textContent, `${t.name}에 미변환 콜아웃이 있음`).not.toMatch(/\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/);
    }
  });

  describe('applyTemplate (날짜 치환)', () => {
    it('formatDate가 한 자리 월과 일을 0으로 채워 YYYY-MM-DD 형식으로 반환한다', () => {
      const date = new Date(2025, 0, 5); // 2025년 1월 5일
      expect(formatDate(date)).toBe('2025-01-05');
    });

    it('모든 템플릿에 날짜를 적용했을 때 {{ 문자열이 남지 않는다', () => {
      const testDate = new Date(2026, 9, 28);
      for (const t of TEMPLATES) {
        const result = applyTemplate(t.content, testDate);
        expect(result).not.toContain('{{날짜}}');
        expect(result).not.toContain('{{');
      }
    });
  });
});
