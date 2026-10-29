import type { MarkdownIt } from 'markdown-it';

/**
 * 블록 요소마다 원문 줄 번호(0부터)를 `data-line`으로 단다.
 * 미리보기에서 하는 편집(표, 체크박스)과 동기 스크롤이 모두 이 값을 기준으로 동작한다.
 */
export function sourceLinesPlugin(md: MarkdownIt): void {
  md.core.ruler.push('source_lines', (state) => {
    let col = 0;
    for (const token of state.tokens) {
      if (token.map && (token.nesting === 1 || token.type === 'code_block')) {
        token.attrSet('data-line', String(token.map[0]));
        token.attrSet('data-line-end', String(token.map[1]));
      }

      if (token.type === 'table_open' && token.level === 0) {
        // 최상위 표만 편집 가능 (인용문·목록 안의 표는 줄 앞에 접두어가 붙어 있어 제외)
        token.attrJoin('class', 'editable-table');
      } else if (token.type === 'tr_open') {
        col = 0;
      } else if (token.type === 'th_open' || token.type === 'td_open') {
        token.attrSet('data-col', String(col++));
      }
    }
  });
}
