// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import katex from 'katex';
import mermaid from 'mermaid';
import { MATH_TEMPLATES, MATH_CATEGORIES } from '../constants/mathTemplates';
import { DIAGRAM_GALLERY_TEMPLATES, DIAGRAM_GALLERY_CATEGORIES } from '../constants/diagramGalleryTemplates';
import {
  CORE_EMOJIS,
  loadExtendedEmojis,
} from '../constants/emojiCore';
import { EXTENDED_EMOJIS } from '../constants/emojiExtended';
import { SUPPORTED_CALLOUT_EMOJIS } from '../render/plugins/emojiCallout';
import { renderMarkdown } from '../render/markdown';
import { sanitizeHtml } from '../render/sanitize';
import { formatDiagramInsertion, formatMathInsertion } from './gallery/insertSnippet';
import { buildDiagramFileName, prepareSvgForExport } from './mermaid/exportDiagram';
import { parseFlowchart } from './mermaid/parse';
import { THEME_PRESETS, getContrastRatio } from '../constants/themes';

describe('2차-B: 수식·다이어그램 갤러리 / PNG·SVG 저장 / 이모지 단축코드 / 이모지 콜아웃', () => {
  describe('1. 수식 템플릿 갤러리 데이터 무결성', () => {
    it('수식 템플릿이 40개 이상이며 id가 모두 고유하고 6개 카테고리에 고르게 분포한다', () => {
      expect(MATH_TEMPLATES.length).toBeGreaterThanOrEqual(40);
      const ids = MATH_TEMPLATES.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);

      for (const cat of MATH_CATEGORIES) {
        const inCat = MATH_TEMPLATES.filter((m) => m.category === cat);
        expect(inCat.length, `${cat} 카테고리 수식 개수`).toBeGreaterThanOrEqual(5);
      }
    });

    it('모든 수식 템플릿이 KaTeX에서 오류 없이(throwOnError: true) 렌더링된다', () => {
      for (const item of MATH_TEMPLATES) {
        expect(item.name.trim()).not.toBe('');
        expect(item.description.trim()).not.toBe('');
        expect(item.latex.trim()).not.toBe('');

        const html = katex.renderToString(item.latex, {
          displayMode: item.isBlock,
          throwOnError: true,
          strict: 'ignore',
        });
        expect(html).toContain('class="katex"');
      }
    });
  });

  describe('2. 다이어그램 템플릿 갤러리 데이터 무결성', () => {
    it('다이어그램 템플릿이 20개이며 id가 모두 고유하고 9개 카테고리를 모두 포함한다', () => {
      expect(DIAGRAM_GALLERY_TEMPLATES.length).toBe(20);
      const ids = DIAGRAM_GALLERY_TEMPLATES.map((d) => d.id);
      expect(new Set(ids).size).toBe(ids.length);

      for (const cat of DIAGRAM_GALLERY_CATEGORIES) {
        const inCat = DIAGRAM_GALLERY_TEMPLATES.filter((d) => d.category === cat);
        expect(inCat.length, `${cat} 카테고리 다이어그램 개수`).toBeGreaterThanOrEqual(1);
      }
    });

    it('순서도 카테고리 예시들은 모두 캔버스 편집기 파서(parseFlowchart)에서 정상 파싱된다', () => {
      const flowcharts = DIAGRAM_GALLERY_TEMPLATES.filter((d) => d.category === '순서도');
      expect(flowcharts.length).toBeGreaterThanOrEqual(4);
      for (const item of flowcharts) {
        const res = parseFlowchart(item.code);
        expect(res.ok, `${item.name} parseFlowchart 결과`).toBe(true);
      }
    });

    it('모든 Mermaid 다이어그램 예시(20개)가 mermaid.parse 문법 검사를 통과한다', async () => {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
      for (const item of DIAGRAM_GALLERY_TEMPLATES) {
        expect(item.name.trim()).not.toBe('');
        expect(item.code.trim()).not.toBe('');
        const valid = await mermaid.parse(item.code);
        expect(valid, `${item.name} (${item.id}) 문법 파싱`).toBeTruthy();
      }
    });
  });

  describe('3. 삽입 문자열 생성 (formatMathInsertion / formatDiagramInsertion)', () => {
    it('블록 수식과 인라인 수식 문자열을 올바르게 생성한다', () => {
      expect(formatMathInsertion('E = mc^2', true)).toBe('$$\nE = mc^2\n$$');
      expect(formatMathInsertion('\\alpha + \\beta', false)).toBe('$\\alpha + \\beta$');
    });

    it('Mermaid 코드 블록 문자열을 올바르게 생성한다', () => {
      const snippet = formatDiagramInsertion('flowchart LR\n  A --> B');
      expect(snippet).toBe('```mermaid\nflowchart LR\n  A --> B\n```');
    });
  });

  describe('4. 다이어그램 PNG / SVG 저장 유틸리티', () => {
    it('문서 제목 기준으로 안전한 PNG / SVG 파일 이름을 생성한다', () => {
      expect(buildDiagramFileName('시작하기.md', 'png')).toBe('시작하기-diagram.png');
      expect(buildDiagramFileName('시스템 아키텍처.markdown', 'svg')).toBe('시스템 아키텍처-diagram.svg');
      expect(buildDiagramFileName('보고서: 2026/10*초안?.md', 'png')).toBe('보고서_ 2026_10_초안_-diagram.png');
      expect(buildDiagramFileName('', 'png')).toBe('문서-diagram.png');
      expect(buildDiagramFileName(undefined, 'svg')).toBe('문서-diagram.svg');
    });

    it('prepareSvgForExport가 viewBox 크기를 추출하고 foreignObject를 순수 SVG text로 교체해 캔버스 오염을 방지한다', () => {
      const div = document.createElement('div');
      div.innerHTML = `
        <svg viewBox="0 0 420 260">
          <g>
            <rect x="10" y="10" width="100" height="40" />
            <foreignObject x="10" y="10" width="100" height="40">
              <div>노드 라벨</div>
            </foreignObject>
          </g>
        </svg>
      `;
      const svgEl = div.querySelector('svg')!;
      const prepared = prepareSvgForExport(svgEl);

      expect(prepared.width).toBe(420);
      expect(prepared.height).toBe(260);
      expect(prepared.svgString).not.toContain('foreignObject');
      expect(prepared.svgString).toContain('노드 라벨');
      expect(prepared.svgString).toContain('<text');
    });
  });

  describe('5. 이모지 단축코드 (markdown-it 플러그인 & 사전)', () => {
    it('필수 + 확장 이모지 단축코드 사전이 총 300개 이상이다', async () => {
      const coreCount = Object.keys(CORE_EMOJIS).length;
      const extCount = Object.keys(EXTENDED_EMOJIS).length;
      expect(coreCount).toBeGreaterThanOrEqual(90);
      expect(coreCount + extCount).toBeGreaterThanOrEqual(300);

      const map = await loadExtendedEmojis();
      expect(Object.keys(map).length).toBeGreaterThanOrEqual(300);
      expect(map['smile']).toBe('😄');
      expect(map['unicorn']).toBe('🦄');
    });

    it('본문 텍스트의 :shortcode:는 이모지로 변환하되, 코드블록·인라인코드·URL·미등록 코드는 변환하지 않는다', () => {
      const md = [
        '인사해요 :smile: 그리고 :rocket: 출발!',
        '',
        '인라인 코드 `:smile:` 안에서는 그대로 유지됩니다.',
        '',
        '```js',
        'const icon = ":smile: :fire:";',
        '```',
        '',
        '주소 https://example.com/:smile:/page 링크도 보호됩니다.',
        '',
        '없는 코드 :not_a_real_emoji_code_123: 는 그대로 남습니다.',
      ].join('\n');

      const { html } = renderMarkdown(md);
      const clean = sanitizeHtml(html);

      expect(clean).toContain('인사해요 😄 그리고 🚀 출발!');
      expect(clean).toContain('<code>:smile:</code>');
      expect(clean).toContain('":smile: :fire:"');
      expect(clean).toContain('href="https://example.com/:smile:/page"');
      expect(clean).toContain(':not_a_real_emoji_code_123:');
    });
  });

  describe('6. 이모지 콜아웃 (markdown-it 플러그인 & sanitizeHtml 보존)', () => {
    it('12종 지원 이모지로 시작하는 인용문을 이모지별 색 상자로 변환하고 data-line을 유지한다', () => {
      for (const cfg of SUPPORTED_CALLOUT_EMOJIS) {
        const src = `> ${cfg.emoji} ${cfg.label} 안내 문구입니다.`;
        const { html } = renderMarkdown(src);
        const clean = sanitizeHtml(html);

        expect(clean).toContain(`emoji-callout-${cfg.kind}`);
        expect(clean).toContain(`data-callout-emoji="${cfg.emoji}"`);
        expect(clean).toContain('data-line="0"');
        expect(clean).toContain(`<span class="emoji-callout-icon" aria-hidden="true">${cfg.emoji}</span>`);
        expect(clean).toContain(`${cfg.label} 안내 문구입니다.`);
      }
    });

    it('기존 GitHub 콜아웃(> [!NOTE])과 일반 인용문(> 평범한 글)은 그대로 유지한다', () => {
      const src = [
        '> [!NOTE]',
        '> 깃허브 노트 콜아웃',
        '',
        '> 일반 인용문입니다.',
      ].join('\n');

      const { html } = renderMarkdown(src);
      const clean = sanitizeHtml(html);

      expect(clean).toContain('callout-note');
      expect(clean).not.toContain('emoji-callout');
      expect(clean).toContain('일반 인용문입니다.');
    });
  });

  describe('7. 8개 테마 링크 색 대비 검증', () => {
    it('8개 테마 모두에서 본문 링크(--doc-link)가 본문 글자(--doc-text)와 3:1 이상, 배경(--doc-bg)과 4.5:1 이상 대비를 갖는다', () => {
      expect(THEME_PRESETS.length).toBe(8);
      for (const theme of THEME_PRESETS) {
        const bgRatio = getContrastRatio(theme.vars['--doc-link'], theme.vars['--doc-bg']);
        const textRatio = getContrastRatio(theme.vars['--doc-link'], theme.vars['--doc-text']);
        expect(bgRatio, `${theme.id} 링크-배경 대비`).toBeGreaterThanOrEqual(4.5);
        expect(textRatio, `${theme.id} 링크-본문글자 대비`).toBeGreaterThanOrEqual(3.0);
      }
    });
  });
});
