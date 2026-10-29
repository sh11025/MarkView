/** 빈 줄에서 `/`를 입력하면 뜨는 삽입 메뉴 (CodeMirror 자동완성으로 구현) */
import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import type { EditorView } from '@codemirror/view';
import { EDITOR_ACTIONS, SLASH_SECTION_TITLES, type EditorAction } from './commands';

/** 각 항목의 아이콘 SVG 패스 정의 (Lucide 스타일, 24x24 viewBox) */
export const SLASH_SVG_ICONS: Record<string, string> = {
  h1: '<path d="M4 12h8M4 18V6M12 18V6M17 12l3-2v8"/>',
  h2: '<path d="M4 12h8M4 18V6M12 18V6M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/>',
  h3: '<path d="M4 12h8M4 18V6M12 18V6M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2M17 18a4 4 0 0 0 4-4"/>',
  bullet: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  numbered: '<path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
  task: '<path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8"/>',
  quote: '<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2zM5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>',
  table: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18M3 9h18M3 15h18"/>',
  codeblock: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m10 10-2 2 2 2M14 14l2-2-2-2"/>',
  math: '<path d="M18 7V4H6l6 8-6 8h12v-3"/>',
  mermaid: '<rect width="6" height="6" x="3" y="3" rx="1"/><rect width="6" height="6" x="15" y="3" rx="1"/><rect width="6" height="6" x="9" y="15" rx="1"/><path d="M6 9v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9M12 13v2"/>',
  emoji: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
  'callout-note': '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  'callout-tip': '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4"/>',
  'callout-important': '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  'callout-warning': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17h.01"/>',
  'callout-caution': '<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><path d="M12 8v4M12 16h.01"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  hr: '<path d="M5 12h14"/>',
  template: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><polyline points="14 2 14 8 20 8"/>',
};

/** 콜아웃 색상 CSS 변수 매핑 */
const CALLOUT_COLORS: Record<string, string> = {
  'callout-note': 'var(--callout-note-border, #3b82f6)',
  'callout-tip': 'var(--callout-tip-border, #10b981)',
  'callout-important': 'var(--callout-important-border, #8b5cf6)',
  'callout-warning': 'var(--callout-warning-border, #f59e0b)',
  'callout-caution': 'var(--callout-caution-border, #ef4444)',
};

export interface SlashCompletionItem extends Completion {
  isSlashOption: boolean;
  actionId?: string;
  descriptionText?: string;
  exampleText?: string;
  iconId?: string;
  isSlashEmptyNotice?: boolean;
}

/** 슬래시 자동완성 항목의 커스텀 DOM 렌더러 */
export function renderSlashOptionElement(completion: Completion): Node | null {
  const item = completion as SlashCompletionItem;
  if (!item.isSlashOption && !item.isSlashEmptyNotice) return null;

  if (item.isSlashEmptyNotice) {
    const emptyBox = document.createElement('div');
    emptyBox.className = 'cm-slash-empty-notice';
    emptyBox.textContent = item.label;
    return emptyBox;
  }

  const container = document.createElement('div');
  container.className = 'cm-slash-row';

  // 1. 아이콘 컨테이너
  const iconWrap = document.createElement('div');
  iconWrap.className = 'cm-slash-icon-wrap';
  const customColor = item.iconId ? CALLOUT_COLORS[item.iconId] : undefined;
  if (customColor) {
    iconWrap.style.color = customColor;
  }

  const svgInner = (item.iconId && SLASH_SVG_ICONS[item.iconId]) || SLASH_SVG_ICONS.template;
  iconWrap.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgInner}</svg>`;

  // 2. 텍스트 컨테이너 (이름 + 한 줄 설명)
  const textWrap = document.createElement('div');
  textWrap.className = 'cm-slash-text-wrap';

  const labelSpan = document.createElement('div');
  labelSpan.className = 'cm-slash-label';
  labelSpan.textContent = item.label;

  const descSpan = document.createElement('div');
  descSpan.className = 'cm-slash-desc';
  descSpan.textContent = item.descriptionText || '';

  textWrap.appendChild(labelSpan);
  textWrap.appendChild(descSpan);

  // 3. 결과 예시 뱃지
  const exampleBadge = document.createElement('div');
  exampleBadge.className = 'cm-slash-example';
  exampleBadge.textContent = item.exampleText || '';

  // 조합
  const leftGroup = document.createElement('div');
  leftGroup.className = 'cm-slash-left-group';
  leftGroup.appendChild(iconWrap);
  leftGroup.appendChild(textWrap);

  container.appendChild(leftGroup);
  if (item.exampleText) {
    container.appendChild(exampleBadge);
  }

  return container;
}

/** 텍스트 검색(한글 부분 일치, 공백 분리 다중 키워드) 검사 */
export function matchAction(action: EditorAction, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  const label = action.label.toLowerCase();
  const desc = action.description.toLowerCase();
  const kw = action.keywords.toLowerCase();

  // 검색어가 여러 단어일 경우 모두 포함되어야 일치
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((token) => label.includes(token) || desc.includes(token) || kw.includes(token));
}

export function slashCompletions(context: CompletionContext): CompletionResult | null {
  const match = context.matchBefore(/\/[^\s/]*$/);
  if (!match) return null;
  const line = context.state.doc.lineAt(match.from);
  // 줄 맨 앞(들여쓰기 허용)에서만 연다 — 경로·URL 입력을 방해하지 않도록
  if (line.text.slice(0, match.from - line.from).trim() !== '') return null;

  const query = match.text.slice(1);
  const matchedActions = EDITOR_ACTIONS.filter((a) => a.inSlashMenu && matchAction(a, query));

  if (matchedActions.length === 0) {
    // 일치하는 항목이 없을 때 친절한 안내 메시지 표시 (Esc로 닫을 수 있음)
    const emptyNotice: SlashCompletionItem = {
      label: '일치하는 항목이 없습니다. Esc 키로 닫을 수 있습니다',
      displayLabel: '일치하는 항목이 없습니다. Esc 키로 닫을 수 있습니다',
      isSlashOption: false,
      isSlashEmptyNotice: true,
      apply: () => {},
    };
    return { from: match.from, to: match.to, options: [emptyNotice], filter: false };
  }

  const q = query.toLowerCase().trim();
  const options: SlashCompletionItem[] = matchedActions
    .map((action) => {
      let boost = 0;
      if (q) {
        const label = action.label.toLowerCase();
        if (label === q) boost = 99;
        else if (label.startsWith(q)) boost = 50;
        else if (label.includes(q)) boost = 30;
        else if (action.keywords.toLowerCase().includes(q)) boost = 10;
      }
      return {
        label: action.label,
        section: SLASH_SECTION_TITLES[action.group],
        isSlashOption: true,
        boost,
        actionId: action.id,
        descriptionText: action.description,
        exampleText: action.example,
        iconId: action.iconId,
        apply: (view: EditorView, _c: unknown, from: number, to: number) => {
          view.dispatch({ changes: { from, to, insert: '' }, selection: { anchor: from } });
          action.run(view);
        },
      };
    })
    .sort((a, b) => (b.boost || 0) - (a.boost || 0));

  return { from: match.from, to: match.to, options, filter: false };
}
