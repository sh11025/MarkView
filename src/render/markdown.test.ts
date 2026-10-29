// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderMarkdown, findAttachmentIds } from './markdown';
import { sanitizeHtml } from './sanitize';

describe('renderMarkdown', () => {
  it('코드 블록 안의 $, **, | 를 건드리지 않는다', () => {
    const src = ['```bash', 'echo "$HOME/$USER"', 'a **b:** c | d', '```'].join('\n');
    const { html } = renderMarkdown(src);
    const text = html.replace(/<[^>]+>/g, '');
    expect(html).not.toContain('katex');
    expect(text).toContain('$HOME/$USER');
    expect(text).toContain('a **b:** c | d');
  });

  it('인라인 코드 안의 $도 수식으로 바꾸지 않는다', () => {
    const { html } = renderMarkdown('값은 `$x$` 입니다');
    expect(html).not.toContain('katex');
  });

  it('수식을 렌더링하고 통화 표기는 그대로 둔다', () => {
    expect(renderMarkdown('$E=mc^2$').html).toContain('katex');
    expect(renderMarkdown('$$\nx^2\n$$').html).toContain('katex-display');
    expect(renderMarkdown('가격은 $5와 $10 사이').html).not.toContain('katex');
  });

  it('체크박스에 원문 줄 번호를 단다 (코드 블록 속 체크리스트는 무시)', () => {
    const src = ['```', '- [ ] 가짜', '```', '', '1. [x] 번호 목록', '- [ ] 진짜'].join('\n');
    const { html } = renderMarkdown(src);
    const lines = [...html.matchAll(/data-task-line="(\d+)"/g)].map((m) => Number(m[1]));
    expect(lines).toEqual([4, 5]);
    expect(html).toMatch(/data-task-line="4" checked/);
  });

  it('제목의 인라인 서식을 렌더링하고 목차를 만든다', () => {
    const { html, toc } = renderMarkdown('# **굵은** 제목\n\n## 제목\n\n## 제목');
    expect(html).toContain('<strong>굵은</strong>');
    expect(toc.map((t) => t.id)).toEqual(['굵은-제목', '제목', '제목-1']);
    expect(toc[1].line).toBe(2);
  });

  it('표 행과 셀에 줄 번호와 열 번호를 단다', () => {
    const src = ['```', '| a | b |', '|---|---|', '```', '', '| a | b |', '|---|---|', '| 1 | 2 |'].join('\n');
    const { html } = renderMarkdown(src);
    expect(html).toContain('class="editable-table"');
    expect(html).toMatch(/<table[^>]*data-line="5"[^>]*data-line-end="8"/);
    expect(html).toMatch(/<tr data-line="7"[^>]*>\s*<td data-col="0"/);
  });

  it('GitHub 콜아웃을 렌더링한다', () => {
    const { html } = renderMarkdown('> [!TIP]\n> 유용한 내용');
    expect(html).toContain('callout callout-tip');
    expect(html).toContain('💡 팁');
    expect(html).not.toContain('[!TIP]');
    expect(html).toContain('유용한 내용');
  });

  it('mermaid 블록은 코드를 보존한다', () => {
    const { html } = renderMarkdown('```mermaid\nflowchart LR\n  A --> B\n```');
    expect(html).toContain('class="mermaid-block"');
    expect(html).toContain(`data-code="${encodeURIComponent('flowchart LR\n  A --> B\n')}"`);
  });

  it('첨부 이미지 주소를 바꾼다', () => {
    const src = '![그림](attachment:abc-1)';
    expect(findAttachmentIds(src)).toEqual(['abc-1']);
    expect(renderMarkdown(src, { resolveAttachment: () => 'blob:x' }).html).toContain('src="blob:x"');
  });

  describe('findAttachmentIds', () => {
    it('제목이 없는 경우 첨부 id를 추출한다', () => {
      const src = '![이미지 설명](attachment:img-no-title)';
      expect(findAttachmentIds(src)).toEqual(['img-no-title']);
    });

    it('제목이 있는 경우 공백과 따옴표를 건너뛰고 첨부 id를 추출한다', () => {
      const src1 = '![이미지 설명](attachment:img-with-double-quote "사진 제목")';
      const src2 = "![이미지 설명](attachment:img-with-single-quote '사진 제목')";
      expect(findAttachmentIds(src1)).toEqual(['img-with-double-quote']);
      expect(findAttachmentIds(src2)).toEqual(['img-with-single-quote']);
    });

    it('한 줄에 이미지 두 개가 있는 경우 둘 다 추출한다', () => {
      const src = '![첫번째](attachment:img-first) 그리고 ![두번째](attachment:img-second "두번째 제목")';
      expect(findAttachmentIds(src)).toEqual(['img-first', 'img-second']);
    });
  });

  describe('상대 경로 이미지 렌더링', () => {
    it('콜백이 없으면 기존과 동일하게 src 속성을 유지한다', () => {
      const src = '![로고](./img/logo.png)';
      const { html, pendingRelativeImages } = renderMarkdown(src);
      expect(html).toContain('src="./img/logo.png"');
      expect(pendingRelativeImages).toEqual([]);
    });

    it('콜백이 URL을 주면 해당 URL로 img src를 렌더링한다', () => {
      const src = '![로고](./img/logo.png)';
      const { html } = renderMarkdown(src, {
        resolveRelativeImage: (s) => (s === './img/logo.png' ? 'blob:http://localhost/logo-blob' : undefined),
      });
      expect(html).toContain('src="blob:http://localhost/logo-blob"');
      expect(html).not.toContain('img-missing');
      expect(html).not.toContain('img-pending');
    });

    it("콜백이 'missing'을 반환하면 .img-missing 표시를 렌더링한다", () => {
      const src = '![없는그림](../img/none.png)';
      const { html } = renderMarkdown(src, {
        resolveRelativeImage: () => 'missing',
      });
      expect(html).toContain('class="img-missing"');
      expect(html).toContain('🖼 이미지를 찾을 수 없음: 없는그림');
      expect(html).not.toContain('<img');
    });

    it('콜백이 undefined를 반환하면 .img-pending 및 data-rel-src가 설정되고 pending 목록에 중복 없이 들어간다', () => {
      const src = '![로고1](./img/logo.png)\n![로고2](./img/logo.png)\n![기타](../other.png)';
      const { html, pendingRelativeImages } = renderMarkdown(src, {
        resolveRelativeImage: () => undefined,
      });
      expect(html).toContain('class="img-pending"');
      expect(html).toContain('data-rel-src="./img/logo.png"');
      expect(html).toContain('data-rel-src="../other.png"');
      expect(pendingRelativeImages).toEqual(['./img/logo.png', '../other.png']);
    });

    it('http, https, data:, blob:, attachment:, 절대경로 이미지는 콜백을 부르지 않는다', () => {
      let callCount = 0;
      const src = [
        '![웹](https://example.com/a.png)',
        '![웹2](http://example.com/b.png)',
        '![데이터](data:image/png;base64,abc)',
        '![블롭](blob:http://localhost/123)',
        '![첨부](attachment:att-1)',
        '![절대](/abs/path.png)',
      ].join('\n');

      renderMarkdown(src, {
        resolveRelativeImage: () => {
          callCount++;
          return undefined;
        },
      });
      expect(callCount).toBe(0);
    });

    it('sanitizeHtml을 거쳐도 data-rel-src 속성이 남는다', () => {
      const src = '![테스트](./img/test.png)';
      const { html } = renderMarkdown(src, {
        resolveRelativeImage: () => undefined,
      });
      const sanitized = sanitizeHtml(html);
      expect(sanitized).toContain('data-rel-src="./img/test.png"');
      expect(sanitized).toContain('class="img-pending"');
    });
  });

  describe('한글 굵은 글씨 및 취소선 보정 (CJK emphasis)', () => {
    it('5가지 문제 사례가 모두 정확하게 strong 및 s 태그로 렌더링된다', () => {
      // 1) **"인용"**은 중요하다
      const r1 = renderMarkdown('**"인용"**은 중요하다').html;
      expect(r1).toContain('<strong>&quot;인용&quot;</strong>은 중요하다');

      // 2) **(괄호)**를 포함
      const r2 = renderMarkdown('**(괄호)**를 포함').html;
      expect(r2).toContain('<strong>(괄호)</strong>를 포함');

      // 3) **텍스트:**내용
      const r3 = renderMarkdown('**텍스트:**내용').html;
      expect(r3).toContain('<strong>텍스트:</strong>내용');

      // 4) 핵심은 **"A"와 "B"**입니다
      const r4 = renderMarkdown('핵심은 **"A"와 "B"**입니다').html;
      expect(r4).toContain('핵심은 <strong>&quot;A&quot;와 &quot;B&quot;</strong>입니다');

      // 5) ~~취소:~~내용
      const r5 = renderMarkdown('~~취소:~~내용').html;
      expect(r5).toContain('<s>취소:</s>내용');
    });

    it('대조군(영어, 곱셈식, snake_case, 인라인 코드, 코드 블록)이 보존된다', () => {
      expect(renderMarkdown('**bold**').html).toContain('<strong>bold</strong>');
      expect(renderMarkdown('*italic*').html).toContain('<em>italic</em>');
      expect(renderMarkdown('2 * 3 * 4').html).toContain('2 * 3 * 4');
      expect(renderMarkdown('2 * 3 * 4').html).not.toContain('<em>');
      expect(renderMarkdown('snake_case_word').html).toContain('snake_case_word');
      expect(renderMarkdown('`**code**`').html).toContain('<code>**code**</code>');
      expect(renderMarkdown('```\n**code block**\n```').html).toContain('**code block**');
    });

    it('밑줄 회귀 방지: CJK 단어 내 밑줄이 em으로 변환되지 않고 원문 그대로 유지된다', () => {
      // 회귀 사례 4종 및 snake_case_word
      const cases = [
        '홍길동_이력서_최종.pdf',
        '파일_이름_확장자를 확인',
        '사용자_ID와 비밀번호_설정',
        '결과_보고서_최종본',
        'snake_case_word',
      ];
      for (const text of cases) {
        const { html } = renderMarkdown(text);
        expect(html, `사례 [${text}]는 em 태그를 포함하지 않아야 함`).not.toContain('<em>');
        expect(html).toContain(text);
      }
    });

    it('밑줄 정상 기울임은 em으로 정상 렌더링된다', () => {
      const { html } = renderMarkdown('_밑줄 기울임_ 입니다');
      expect(html).toContain('<em>밑줄 기울임</em> 입니다');
    });

    it('별표 대조군 및 인라인/블록 코드 내 밑줄과 별표가 보존된다', () => {
      expect(renderMarkdown('2 * 3 * 4').html).not.toContain('<em>');
      expect(renderMarkdown('별표 * 하나와 * 둘').html).toContain('별표 * 하나와 * 둘');
      expect(renderMarkdown('별표 * 하나와 * 둘').html).not.toContain('<em>');
      expect(renderMarkdown('가 ** 나 ** 다').html).toContain('가 ** 나 ** 다');
      expect(renderMarkdown('가 ** 나 ** 다').html).not.toContain('<strong>');
      expect(renderMarkdown('한*글*자').html).toContain('한<em>글</em>자');

      // 코드 안
      const inlineCode = renderMarkdown('`홍길동_이력서_최종.pdf 및 **bold**`').html;
      expect(inlineCode).toContain('<code>홍길동_이력서_최종.pdf 및 **bold**</code>');
      expect(inlineCode).not.toContain('<em>');
      expect(inlineCode).not.toContain('<strong>');

      const blockCode = renderMarkdown('```\n파일_이름_확장자 및 **코드**\n```').html;
      expect(blockCode).toContain('파일_이름_확장자 및 **코드**');
      expect(blockCode).not.toContain('<em>');
      expect(blockCode).not.toContain('<strong>');
    });

    it('중첩 강조 및 한 줄 다중 강조가 정상 동작한다', () => {
      const nested1 = renderMarkdown('***굵고 기울임***').html;
      expect(nested1).toContain('<em><strong>굵고 기울임</strong></em>');

      const nested2 = renderMarkdown('**굵게 *기울임* 굵게**').html;
      expect(nested2).toContain('<strong>굵게 <em>기울임</em> 굵게</strong>');

      const multi = renderMarkdown('**"A"**와 **(B)**와 ~~C:~~내용').html;
      expect(multi).toContain('<strong>&quot;A&quot;</strong>와 <strong>(B)</strong>와 <s>C:</s>내용');
    });

    it('링크, 헤딩, 목록, 표 안의 한글 강조도 정상 동작한다', () => {
      expect(renderMarkdown('# **"제목"**입니다').html).toContain('><strong>&quot;제목&quot;</strong>입니다</h1>');
      expect(renderMarkdown('[**"링크"**입니다](https://example.com)').html).toContain('<strong>&quot;링크&quot;</strong>입니다');
      expect(renderMarkdown('- **"항목"**입니다').html).toContain('<strong>&quot;항목&quot;</strong>입니다');
      expect(renderMarkdown('| **"표"**입니다 |').html).toContain('<strong>&quot;표&quot;</strong>입니다');
    });
  });

  describe('체크리스트 진행률 카드 (Checklist progress card)', () => {
    it('0/N, 일부, 전부 완료 상태 및 퍼센트 반올림을 정확히 렌더링한다', () => {
      // 0/3 (0%)
      const r0 = renderMarkdown('- [ ] 일1\n- [ ] 일2\n- [ ] 일3').html;
      expect(r0).toContain('체크리스트 0 / 3 완료');
      expect(r0).toContain('0%');
      expect(r0).toContain('<progress value="0" max="3" aria-label="체크리스트 진행률 0%">');
      expect(r0).not.toContain('is-complete');
      expect(r0).toContain('data-completed="false"');

      // 1/3 (33% 반올림)
      const r1 = renderMarkdown('- [x] 일1\n- [ ] 일2\n- [ ] 일3').html;
      expect(r1).toContain('체크리스트 1 / 3 완료');
      expect(r1).toContain('33%');
      expect(r1).toContain('<progress value="1" max="3" aria-label="체크리스트 진행률 33%">');
      expect(r1).toContain('data-completed="false"');

      // 3/3 (100% 완료 상태)
      const rAll = renderMarkdown('- [x] 일1\n- [x] 일2\n- [x] 일3').html;
      expect(rAll).toContain('체크리스트 3 / 3 완료');
      expect(rAll).toContain('100%');
      expect(rAll).toContain('<progress value="3" max="3" aria-label="체크리스트 진행률 100%">');
      expect(rAll).toContain('is-complete');
      expect(rAll).toContain('data-completed="true"');
    });

    it('중첩된 하위 목록의 체크박스 항목까지 합산하여 개수를 센다', () => {
      const src = [
        '- [x] 메인 1',
        '  - [x] 하위 1-1',
        '  - [ ] 하위 1-2',
        '- [ ] 메인 2',
      ].join('\n');
      const { html } = renderMarkdown(src);
      expect(html).toContain('체크리스트 2 / 4 완료');
      expect(html).toContain('50%');
      // 최상위 목록에만 카드가 있고 하위 목록에는 카드가 중복되지 않음
      const count = (html.match(/<div class="checklist-progress(?:[ "])/g) || []).length;
      expect(count).toBe(1);
    });

    it('체크박스가 없는 일반 목록에는 진행률 카드를 표시하지 않는다', () => {
      const { html } = renderMarkdown('- 사과\n- 바나나\n- 딸기');
      expect(html).not.toContain('checklist-progress');
    });

    it('인용문 안의 목록(level > 0)에는 진행률 카드를 표시하지 않는다', () => {
      const { html } = renderMarkdown('> - [ ] 인용문 안의 할 일\n> - [x] 인용문 2');
      expect(html).not.toContain('checklist-progress');
    });

    it('코드 블록 안의 - [ ] 는 세지 않는다', () => {
      const src = [
        '```markdown',
        '- [ ] 가짜1',
        '- [x] 가짜2',
        '```',
        '',
        '- [x] 진짜1',
        '- [ ] 진짜2',
      ].join('\n');
      const { html } = renderMarkdown(src);
      expect(html).toContain('체크리스트 1 / 2 완료');
    });

    it('한 문서에 여러 개의 체크리스트가 있을 때 각각 개별 카드가 생긴다', () => {
      const src = [
        '### 1차 목록',
        '- [x] A1',
        '- [ ] A2',
        '',
        '### 2차 목록',
        '- [x] B1',
        '- [x] B2',
        '- [x] B3',
      ].join('\n');
      const { html } = renderMarkdown(src);
      expect(html).toContain('체크리스트 1 / 2 완료');
      expect(html).toContain('체크리스트 3 / 3 완료');
      const matches = html.match(/<div class="checklist-progress(?:[ "])/g) || [];
      expect(matches.length).toBe(2);
    });

    it('번호 목록(ordered list)에서도 정상 동작한다', () => {
      const src = ['1. [x] 첫 번째', '2. [ ] 두 번째'].join('\n');
      const { html } = renderMarkdown(src);
      expect(html).toContain('체크리스트 1 / 2 완료');
      expect(html).toContain('50%');
    });

    it('체크박스의 data-task-line이 여전히 올바른 원문 줄 번호를 가리킨다', () => {
      const src = ['# 제목', '', '- [ ] 2번줄', '- [x] 3번줄'].join('\n');
      const { html } = renderMarkdown(src);
      expect(html).toContain('data-task-line="2"');
      expect(html).toContain('data-task-line="3" checked');
    });
  });
});
