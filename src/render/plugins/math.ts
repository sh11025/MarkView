import type { MarkdownIt } from 'markdown-it';
import type { StateBlock, StateInline } from 'markdown-it';
import katex from 'katex';

const DOLLAR = 0x24;
const BACKSLASH = 0x5c;

function renderMath(content: string, displayMode: boolean): string {
  return katex.renderToString(content, { displayMode, throwOnError: false, strict: 'ignore' });
}

/** `$$ ... $$` 블록 수식. 코드 블록 안은 fence 규칙이 먼저 소비하므로 침범하지 않는다. */
function mathBlock(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  if (start + 2 > max || state.src.slice(start, start + 2) !== '$$') return false;

  const firstLine = state.src.slice(start + 2, max).trimEnd();
  let content = '';
  let lastLine = startLine;
  let found = false;

  if (firstLine.endsWith('$$')) {
    content = firstLine.slice(0, -2);
    found = true;
  } else {
    const lines = [firstLine];
    for (let line = startLine + 1; line < endLine; line++) {
      const s = state.bMarks[line] + state.tShift[line];
      const e = state.eMarks[line];
      if (s < e && state.sCount[line] < state.blkIndent) break;
      const text = state.src.slice(s, e).trimEnd();
      if (text.endsWith('$$')) {
        lines.push(text.slice(0, -2));
        lastLine = line;
        found = true;
        break;
      }
      lines.push(text);
    }
    content = lines.join('\n');
  }

  if (!found) return false;
  if (silent) return true;

  state.line = lastLine + 1;
  const token = state.push('math_block', 'div', 0);
  token.block = true;
  token.content = content.trim();
  token.markup = '$$';
  token.map = [startLine, state.line];
  return true;
}

/** `$...$` 인라인 수식. 공백으로 시작·끝나거나 닫는 `$` 뒤에 숫자가 오면(`$5와 $10`) 수식으로 보지 않는다. */
function mathInline(state: StateInline, silent: boolean): boolean {
  const src = state.src;
  const start = state.pos;
  if (src.charCodeAt(start) !== DOLLAR || src.charCodeAt(start + 1) === DOLLAR) return false;

  const firstChar = src[start + 1];
  if (firstChar === undefined || /\s/.test(firstChar)) return false;

  let end = start + 1;
  for (;;) {
    end = src.indexOf('$', end);
    if (end === -1) return false;
    if (src.charCodeAt(end - 1) === BACKSLASH) {
      end++;
      continue;
    }
    break;
  }
  if (/\s/.test(src[end - 1])) return false;
  if (/[0-9]/.test(src[end + 1] ?? '')) return false;

  if (!silent) {
    const token = state.push('math_inline', 'span', 0);
    token.markup = '$';
    token.content = src.slice(start + 1, end);
  }
  state.pos = end + 1;
  return true;
}

export function mathPlugin(md: MarkdownIt): void {
  md.block.ruler.before('fence', 'math_block', mathBlock, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });
  md.inline.ruler.after('escape', 'math_inline', mathInline);

  md.renderer.rules.math_inline = (tokens, idx) =>
    `<span class="math-inline">${renderMath(tokens[idx].content, false)}</span>`;
  md.renderer.rules.math_block = (tokens, idx) => {
    const token = tokens[idx];
    const lines = token.map ? ` data-line="${token.map[0]}" data-line-end="${token.map[1]}"` : '';
    return `<div class="math-block"${lines}>${renderMath(token.content, true)}</div>\n`;
  };
}
