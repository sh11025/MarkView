import type { MarkdownIt } from 'markdown-it';
import { stripLeadingText } from './stripLeadingText';

const TASK_RE = /^\[([ xX])\](?:[ \t]+|$)/;

export interface ChecklistStats {
  total: number;
  completed: number;
  percent: number;
}

/** `- [ ] 할 일` 체크리스트. 체크박스에 원문 줄 번호를 달아 클릭 시 정확한 줄을 고칠 수 있게 한다. */
export function tasksPlugin(md: MarkdownIt): void {
  md.core.ruler.after('inline', 'task_lists', (state) => {
    const tokens = state.tokens;
    for (let i = 2; i < tokens.length; i++) {
      const inline = tokens[i];
      const item = tokens[i - 2];
      if (inline.type !== 'inline' || tokens[i - 1].type !== 'paragraph_open') continue;
      if (item.type !== 'list_item_open' || !item.map) continue;

      const match = TASK_RE.exec(inline.content);
      if (!match || !inline.children) continue;

      stripLeadingText(inline.children, match[0].length);
      const checked = match[1] !== ' ';
      const checkbox = new state.Token('html_inline', '', 0);
      checkbox.content = `<input type="checkbox" class="task-checkbox" data-task-line="${item.map[0]}"${
        checked ? ' checked' : ''
      }> `;
      inline.children.unshift(checkbox);
      item.attrJoin('class', 'task-item');
      if (checked) {
        item.attrJoin('class', 'task-item-checked');
      }

      for (let j = i - 3; j >= 0; j--) {
        const t = tokens[j];
        if (t.level === item.level - 1 && (t.type === 'bullet_list_open' || t.type === 'ordered_list_open')) {
          if (!String(t.attrGet('class') ?? '').includes('task-list')) t.attrJoin('class', 'task-list');
          break;
        }
      }
    }

    // 최상위 목록(level 0)에 속한 모든 체크박스 개수(중첩 하위 목록 포함) 집계
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.level === 0 && (token.type === 'bullet_list_open' || token.type === 'ordered_list_open')) {
        const closeType = token.type === 'bullet_list_open' ? 'bullet_list_close' : 'ordered_list_close';
        let depth = 1;
        let total = 0;
        let completed = 0;

        for (let j = i + 1; j < tokens.length; j++) {
          const t = tokens[j];
          if (t.type === token.type) depth++;
          else if (t.type === closeType) {
            depth--;
            if (depth === 0) break;
          }

          if (t.type === 'list_item_open' && String(t.attrGet('class') ?? '').includes('task-item')) {
            total++;
            if (String(t.attrGet('class') ?? '').includes('task-item-checked')) {
              completed++;
            }
          }
        }

        if (total > 0) {
          const percent = Math.round((completed / total) * 100);
          token.meta = {
            ...token.meta,
            checklist: { total, completed, percent } as ChecklistStats,
          };
        }
      }
    }
  });

  function renderChecklistCard(token: any): string {
    const cl = token.meta?.checklist as ChecklistStats | undefined;
    if (!cl) return '';
    const isComplete = cl.completed === cl.total;
    return (
      `<div class="checklist-progress${isComplete ? ' is-complete' : ''}" data-completed="${isComplete}">` +
      `<div class="checklist-progress-header">` +
      `<span class="checklist-progress-label">체크리스트 ${cl.completed} / ${cl.total} 완료</span>` +
      `<span class="checklist-progress-percent">${cl.percent}%</span>` +
      `</div>` +
      `<progress value="${cl.completed}" max="${cl.total}" aria-label="체크리스트 진행률 ${cl.percent}%"></progress>` +
      `</div>\n`
    );
  }

  const defaultBullet =
    md.renderer.rules.bullet_list_open ||
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  const defaultOrdered =
    md.renderer.rules.ordered_list_open ||
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.bullet_list_open = (tokens, idx, options, env, self) => {
    return renderChecklistCard(tokens[idx]) + defaultBullet(tokens, idx, options, env, self);
  };

  md.renderer.rules.ordered_list_open = (tokens, idx, options, env, self) => {
    return renderChecklistCard(tokens[idx]) + defaultOrdered(tokens, idx, options, env, self);
  };
}
