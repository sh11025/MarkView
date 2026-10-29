import type { MarkdownIt } from 'markdown-it';
import { stripLeadingText } from './stripLeadingText';

const ALERT_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*/i;

export const ALERT_LABELS: Record<string, string> = {
  note: '📌 참고',
  tip: '💡 팁',
  important: '❗ 중요',
  warning: '⚠️ 주의',
  caution: '🛑 경고',
};

/** GitHub 스타일 콜아웃: `> [!TIP]` */
export function alertsPlugin(md: MarkdownIt): void {
  md.core.ruler.after('inline', 'github_alerts', (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length - 2; i++) {
      if (tokens[i].type !== 'blockquote_open') continue;
      if (tokens[i + 1].type !== 'paragraph_open' || tokens[i + 2].type !== 'inline') continue;

      const inline = tokens[i + 2];
      const match = ALERT_RE.exec(inline.content);
      if (!match || !inline.children) continue;

      const kind = match[1].toLowerCase();
      stripLeadingText(inline.children, match[0].length);
      const first = inline.children[0];
      if (first && (first.type === 'softbreak' || first.type === 'hardbreak')) inline.children.shift();

      tokens[i].attrJoin('class', `callout callout-${kind}`);
      const title = new state.Token('html_block', '', 0);
      title.content = `<p class="callout-title">${ALERT_LABELS[kind]}</p>\n`;
      tokens.splice(i + 1, 0, title);
    }
  });
}
