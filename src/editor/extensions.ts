import { EditorState, Prec, type Extension } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder,
} from '@codemirror/view';
import { history, indentWithTab, redo, standardKeymap, undo } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { closeSearchPanel, highlightSelectionMatches, openSearchPanel, search } from '@codemirror/search';
import {
  acceptCompletion,
  autocompletion,
  closeCompletion,
  moveCompletionSelection,
} from '@codemirror/autocomplete';
import { tags as t } from '@lezer/highlight';
import { renderSlashOptionElement, slashCompletions } from './slashMenu';
import { emojiCompletions } from './emojiCompletion';
import { pasteAndDrop } from './pasteAndDrop';

/**
 * 단축키는 최소한만 둔다: Ctrl+Z / Ctrl+Y(Ctrl+Shift+Z), Ctrl+F.
 * (Ctrl+S는 앱 전역에서 처리. 방향키·Enter·Tab 같은 기본 편집 키는 그대로)
 */
const minimalKeymap = keymap.of([
  { key: 'Mod-z', run: undo, preventDefault: true },
  { key: 'Mod-y', run: redo, preventDefault: true },
  { key: 'Mod-Shift-z', run: redo, preventDefault: true },
  { key: 'Mod-f', run: openSearchPanel, scope: 'editor search-panel', preventDefault: true },
  { key: 'Escape', run: closeSearchPanel, scope: 'editor search-panel' },
  indentWithTab,
  ...standardKeymap,
]);

/** 슬래시 메뉴·이모지 자동완성이 열려 있을 때만 동작하는 키 (목록 이어쓰기 Enter보다 먼저) */
const completionKeys = Prec.highest(
  keymap.of([
    { key: 'ArrowDown', run: moveCompletionSelection(true) },
    { key: 'ArrowUp', run: moveCompletionSelection(false) },
    { key: 'Enter', run: acceptCompletion },
    { key: 'Tab', run: acceptCompletion },
    { key: 'Escape', run: closeCompletion },
  ]),
);

const highlightStyle = HighlightStyle.define([
  { tag: t.heading1, fontWeight: '700', fontSize: '1.2em', color: 'var(--cm-heading)' },
  { tag: t.heading2, fontWeight: '700', fontSize: '1.1em', color: 'var(--cm-heading)' },
  { tag: t.heading, fontWeight: '700', color: 'var(--cm-heading)' },
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: [t.link, t.url], color: 'var(--cm-link)' },
  { tag: t.monospace, color: 'var(--cm-code)' },
  { tag: t.quote, color: 'var(--cm-muted)', fontStyle: 'italic' },
  { tag: [t.processingInstruction, t.meta, t.contentSeparator, t.labelName], color: 'var(--cm-muted)' },
  { tag: t.list, color: 'var(--cm-accent)' },
  { tag: [t.keyword, t.operatorKeyword, t.modifier], color: 'var(--cm-keyword)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--cm-string)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--cm-number)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--cm-muted)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.definition(t.variableName)], color: 'var(--cm-function)' },
]);

const theme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--surface)', color: 'var(--text)', fontSize: '14px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.7' },
  '.cm-content': { padding: '16px 0', caretColor: 'var(--accent)' },
  '.cm-line': { padding: '0 16px' },
  '.cm-gutters': { backgroundColor: 'var(--surface)', color: 'var(--muted)', border: 'none' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--active-line)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--selection) !important',
  },
  '.cm-cursor': { borderLeftColor: 'var(--accent)' },
  '.cm-panels': { backgroundColor: 'var(--surface-2)', color: 'var(--text)' },
  '.cm-tooltip': { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' },
  '.cm-tooltip.cm-tooltip-autocomplete': {
    minWidth: '360px',
    maxWidth: 'calc(100vw - 20px)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    backgroundColor: 'var(--surface)',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': {
    maxHeight: '360px !important',
    overflowY: 'auto !important',
    fontFamily: 'inherit',
    scrollbarWidth: 'thin',
    scrollbarColor: 'var(--border) transparent',
  },
  '@media (max-height: 720px), (max-width: 600px)': {
    '.cm-tooltip.cm-tooltip-autocomplete > ul': {
      maxHeight: 'min(360px, 50vh) !important',
    },
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li.cm-slash-item': {
    minHeight: '44px !important',
    maxHeight: '52px !important',
    padding: '0 !important',
    boxSizing: 'border-box !important',
    display: 'flex !important',
    alignItems: 'center !important',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li.cm-slash-item .cm-completionLabel, .cm-tooltip.cm-tooltip-autocomplete > ul > li.cm-slash-item .cm-completionDetail': {
    display: 'none !important',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li.cm-slash-empty-item .cm-completionLabel, .cm-tooltip.cm-tooltip-autocomplete > ul > li.cm-slash-empty-item .cm-completionDetail': {
    display: 'none !important',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--accent)',
    color: 'var(--accent-fg, #ffffff)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > .cm-completionSection': {
    height: '24px !important',
    lineHeight: '24px !important',
    fontSize: '11px !important',
    fontWeight: '600 !important',
    color: 'var(--muted) !important',
    backgroundColor: 'var(--surface-2) !important',
    padding: '0 12px !important',
    borderTop: '1px solid var(--border) !important',
    borderBottom: '1px solid var(--border) !important',
    boxSizing: 'border-box !important',
  },
  '.cm-slash-row': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '4px 12px',
    minHeight: '44px',
    gap: '10px',
    boxSizing: 'border-box',
  },
  '.cm-slash-left-group': {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: '0',
  },
  '.cm-slash-icon-wrap': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    flexShrink: '0',
    color: 'var(--accent)',
  },
  '.cm-slash-text-wrap': {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    minWidth: '0',
    textAlign: 'left',
    lineHeight: '1.25',
  },
  '.cm-slash-label': {
    fontSize: '13px',
    fontWeight: '600',
    lineHeight: '1.25',
    color: 'var(--text)',
    margin: '0',
    padding: '0',
  },
  '.cm-slash-desc': {
    fontSize: '11.5px',
    color: 'var(--muted)',
    lineHeight: '1.25',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    margin: '0',
    padding: '0',
  },
  '.cm-slash-example': {
    fontSize: '10.5px',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: 'var(--surface-2)',
    border: '1px solid var(--border)',
    color: 'var(--muted)',
    flexShrink: '0',
  },
  '.cm-slash-empty-notice': {
    padding: '12px 14px',
    fontSize: '12.5px',
    color: 'var(--muted)',
    textAlign: 'center',
    width: '100%',
    boxSizing: 'border-box',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected] .cm-slash-label': {
    color: 'var(--accent-fg, #ffffff) !important',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected] .cm-slash-desc': {
    color: 'var(--accent-fg, #ffffff) !important',
    opacity: '0.88',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected] .cm-slash-icon-wrap': {
    color: 'var(--accent-fg, #ffffff) !important',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected] .cm-slash-example': {
    backgroundColor: 'rgba(128, 128, 128, 0.2) !important',
    borderColor: 'rgba(128, 128, 128, 0.3) !important',
    color: 'var(--accent-fg, #ffffff) !important',
  },
});

const koreanPhrases = EditorState.phrases.of({
  Find: '찾기',
  Replace: '바꾸기',
  next: '다음',
  previous: '이전',
  all: '모두',
  'match case': '대소문자 구분',
  regexp: '정규식',
  'by word': '단어 단위',
  replace: '바꾸기',
  'replace all': '모두 바꾸기',
  close: '닫기',
  'current match': '현재 항목',
  'on line': '줄',
});

export function baseExtensions(
  onDocChange: (text: string) => void,
  onSelectionChange?: () => void,
): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    history(),
    drawSelection(),
    dropCursor(),
    EditorView.lineWrapping,
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    syntaxHighlighting(highlightStyle),
    search({ top: true }),
    highlightSelectionMatches(),
    autocompletion({
      override: [slashCompletions, emojiCompletions],
      defaultKeymap: false,
      icons: false,
      optionClass: (c) => {
        if ((c as any).isSlashOption) return 'cm-slash-item';
        if ((c as any).isSlashEmptyNotice) return 'cm-slash-empty-item';
        return '';
      },
      addToOptions: [
        {
          position: 25,
          render: renderSlashOptionElement,
        },
      ],
    }),
    completionKeys,
    minimalKeymap,
    pasteAndDrop,
    placeholder('/ 를 눌러 제목·표·수식·그림을 넣어 보세요'),
    koreanPhrases,
    theme,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onDocChange(update.state.doc.toString());
      if (update.selectionSet || update.docChanged) onSelectionChange?.();
    }),
  ];
}
