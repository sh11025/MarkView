/** 에디터 서식 명령. 도구 막대와 슬래시(/) 메뉴가 같은 목록을 쓴다. */
import { EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { startCompletion } from '@codemirror/autocomplete';
import { useUi } from '../stores/ui';

function wrapSelection(view: EditorView, before: string, after: string, placeholder: string): void {
  const { state } = view;
  view.dispatch(
    state.changeByRange((range) => {
      const selected = state.sliceDoc(range.from, range.to);
      const outerBefore = state.sliceDoc(range.from - before.length, range.from);
      const outerAfter = state.sliceDoc(range.to, range.to + after.length);

      // 이미 감싸져 있으면 풀기
      if (outerBefore === before && outerAfter === after) {
        return {
          changes: [
            { from: range.from - before.length, to: range.from },
            { from: range.to, to: range.to + after.length },
          ],
          range: EditorSelection.range(range.from - before.length, range.to - before.length),
        };
      }

      const text = selected || placeholder;
      return {
        changes: { from: range.from, to: range.to, insert: before + text + after },
        range: EditorSelection.range(range.from + before.length, range.from + before.length + text.length),
      };
    }),
  );
  view.focus();
}

const LINE_PREFIX_RE = /^(\s*)(#{1,6}\s+|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+|>\s?)?/;

/** 선택한 줄들의 앞머리(제목·목록·인용)를 바꾼다. 같은 종류가 이미 있으면 해제한다. */
function setLinePrefix(view: EditorView, makePrefix: (index: number) => string, kind: RegExp): void {
  const { state } = view;
  const changes: { from: number; to: number; insert: string }[] = [];
  const startLine = state.doc.lineAt(state.selection.main.from).number;
  const endLine = state.doc.lineAt(state.selection.main.to).number;

  const lines = [];
  for (let n = startLine; n <= endLine; n++) lines.push(state.doc.line(n));
  const allHaveKind = lines.every((l) => kind.test(l.text.replace(/^\s*/, '')));

  lines.forEach((line, i) => {
    const m = LINE_PREFIX_RE.exec(line.text)!;
    const indent = m[1];
    const existingLength = m[0].length;
    const insert = allHaveKind ? indent : indent + makePrefix(i);
    changes.push({ from: line.from, to: line.from + existingLength, insert });
  });
  view.dispatch({ changes });
  view.focus();
}

/** 블록(표·코드 등)을 앞뒤 빈 줄을 맞춰 넣고, `cursorAt`(삽입 텍스트 내 위치)에 커서를 둔다. */
export function insertBlock(view: EditorView, text: string, cursorAt = text.length): void {
  const { state } = view;
  const { from, to } = state.selection.main;
  const line = state.doc.lineAt(from);
  const lineIsEmpty = line.text.trim() === '';

  let insertFrom = from;
  let insertTo = to;
  let prefix = '';
  if (lineIsEmpty) {
    insertFrom = line.from;
    insertTo = Math.max(to, line.to);
    const prev = line.number > 1 ? state.doc.line(line.number - 1).text : '';
    if (prev.trim() !== '') prefix = '\n';
  } else {
    insertFrom = insertTo = state.doc.lineAt(to).to;
    prefix = '\n\n';
  }

  const nextLineNo = state.doc.lineAt(insertTo).number + 1;
  const next = nextLineNo <= state.doc.lines ? state.doc.line(nextLineNo).text : '';
  const suffix = next.trim() !== '' ? '\n' : '';

  view.dispatch({
    changes: { from: insertFrom, to: insertTo, insert: prefix + text + suffix },
    selection: { anchor: insertFrom + prefix.length + cursorAt },
    scrollIntoView: true,
  });
  view.focus();
}

function insertLink(view: EditorView): void {
  const { from, to } = view.state.selection.main;
  const text = view.state.sliceDoc(from, to) || '링크 텍스트';
  const insert = `[${text}](https://)`;
  const urlStart = from + text.length + 3;
  view.dispatch({ changes: { from, to, insert }, selection: EditorSelection.range(urlStart, urlStart + 8) });
  view.focus();
}

function insertEmojiTrigger(view: EditorView): void {
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert: ':' },
    selection: { anchor: from + 1 },
  });
  view.focus();
  setTimeout(() => {
    startCompletion(view);
  }, 20);
}

const callout = (kind: string, body: string) => `> [!${kind}]\n> ${body}`;

export type ActionGroup = 'inline' | 'shape' | 'insert' | 'callout' | 'misc';

export interface EditorAction {
  id: string;
  label: string;
  description: string;
  example: string;
  iconId: string;
  group: ActionGroup;
  /** 슬래시 메뉴 검색어 */
  keywords: string;
  /** 슬래시 메뉴에 표시할지 */
  inSlashMenu: boolean;
  run(view: EditorView): void;
}

export const SLASH_SECTION_TITLES: Record<ActionGroup, string> = {
  shape: '글 모양(제목·목록)',
  insert: '넣기(표·수식·그림·이모지)',
  callout: '상자(참고·팁·주의)',
  misc: '링크·기타',
  inline: '서식',
};

const TABLE = '| 항목 | 내용 | 비고 |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |';

export const EDITOR_ACTIONS: EditorAction[] = [
  // 서식 (도구 막대 전용)
  { id: 'bold', label: '굵게', description: '선택한 글자를 굵게 강조', example: '**굵게**', iconId: 'bold', group: 'inline', keywords: 'bold 굵게 강조', inSlashMenu: false, run: (v) => wrapSelection(v, '**', '**', '굵은 글씨') },
  { id: 'italic', label: '기울임', description: '선택한 글자를 기울임꼴로 표시', example: '*기울임*', iconId: 'italic', group: 'inline', keywords: 'italic 기울임', inSlashMenu: false, run: (v) => wrapSelection(v, '*', '*', '기울임') },
  { id: 'strike', label: '취소선', description: '선택한 글자에 가로줄을 그음', example: '~~취소선~~', iconId: 'strike', group: 'inline', keywords: 'strike 취소선', inSlashMenu: false, run: (v) => wrapSelection(v, '~~', '~~', '취소선') },
  { id: 'code', label: '인라인 코드', description: '코드나 명령어를 짧게 표시', example: '`코드`', iconId: 'code', group: 'inline', keywords: 'code 코드', inSlashMenu: false, run: (v) => wrapSelection(v, '`', '`', '코드') },

  // 글 모양(제목·목록)
  { id: 'h1', label: '큰 제목', description: '글 맨 위 제목에 씁니다', example: '큰 글씨', iconId: 'h1', group: 'shape', keywords: 'h1 heading 제목 큰제목 큰 글씨', inSlashMenu: true, run: (v) => setLinePrefix(v, () => '# ', /^# /) },
  { id: 'h2', label: '중간 제목', description: '큰 제목 아래 소제목', example: '중간 글씨', iconId: 'h2', group: 'shape', keywords: 'h2 heading 제목 중간제목 중간 글씨 소제목', inSlashMenu: true, run: (v) => setLinePrefix(v, () => '## ', /^## /) },
  { id: 'h3', label: '작은 제목', description: '더 세부적인 소제목', example: '작은 글씨', iconId: 'h3', group: 'shape', keywords: 'h3 heading 제목 작은제목 작은 글씨 세부 소제목', inSlashMenu: true, run: (v) => setLinePrefix(v, () => '### ', /^### /) },
  { id: 'bullet', label: '점 목록', description: '• 항목을 나열합니다', example: '• 항목', iconId: 'bullet', group: 'shape', keywords: 'list bullet 목록 점목록 글머리 항목', inSlashMenu: true, run: (v) => setLinePrefix(v, () => '- ', /^[-*+]\s+(?!\[)/) },
  { id: 'numbered', label: '번호 목록', description: '1. 2. 3. 순서대로 나열합니다', example: '1. 항목', iconId: 'numbered', group: 'shape', keywords: 'numbered ordered 번호 목록 순서 나열', inSlashMenu: true, run: (v) => setLinePrefix(v, (i) => `${i + 1}. `, /^\d+[.)]\s/) },
  { id: 'task', label: '체크리스트', description: '☑ 할 일 목록. 미리보기에서 눌러 체크합니다', example: '☑ 할 일', iconId: 'task', group: 'shape', keywords: 'todo task check 체크 할일 체크리스트 체크박스', inSlashMenu: true, run: (v) => setLinePrefix(v, () => '- [ ] ', /^[-*+]\s+\[[ xX]\]/) },
  { id: 'quote', label: '인용문', description: '남의 말이나 강조할 문장을 들여쓴 줄로 나타냅니다', example: '▎인용', iconId: 'quote', group: 'shape', keywords: 'quote 인용 인용문 들여쓰기', inSlashMenu: true, run: (v) => setLinePrefix(v, () => '> ', /^>/) },

  // 넣기(표·수식·그림·이모지)
  { id: 'table', label: '표', description: '칸이 있는 표를 만듭니다', example: '⊞ 표', iconId: 'table', group: 'insert', keywords: 'table 표 테이블 엑셀 칸', inSlashMenu: true, run: (v) => insertBlock(v, TABLE, 2) },
  { id: 'codeblock', label: '코드 상자', description: '프로그램 코드를 그대로 보여 주는 상자', example: '</> 코드', iconId: 'codeblock', group: 'insert', keywords: 'code block 코드 코드상자 코드블록 프로그램', inSlashMenu: true, run: (v) => insertBlock(v, '```\n\n```', 4) },
  { id: 'math', label: '수식(공식)', description: '수학 공식 모음에서 골라 넣습니다', example: '∑ 수식', iconId: 'math', group: 'insert', keywords: 'math latex 수식 공식 수학 템플릿', inSlashMenu: true, run: () => useUi.getState().openMathGallery() },
  { id: 'mermaid', label: '다이어그램(그림)', description: '순서도·일정표 등 그림 예시에서 골라 넣습니다', example: '◇ 순서도', iconId: 'mermaid', group: 'insert', keywords: 'mermaid diagram 다이어그램 순서도 그림 일정표 차트 사진은 아님', inSlashMenu: true, run: () => useUi.getState().openDiagramGallery() },
  { id: 'emoji', label: '이모지', description: '😀 그림 문자를 고릅니다(:를 입력해도 됩니다)', example: '😀 이모지', iconId: 'emoji', group: 'insert', keywords: 'emoji 이모지 그림문자 웃음 스마일 표정', inSlashMenu: true, run: (v) => insertEmojiTrigger(v) },

  // 상자(참고·팁·주의)
  { id: 'callout-note', label: '참고 상자', description: '파란색 안내 상자', example: 'ℹ️ 참고', iconId: 'callout-note', group: 'callout', keywords: 'note callout 참고 파랑 안내 상자', inSlashMenu: true, run: (v) => insertBlock(v, callout('NOTE', '')) },
  { id: 'callout-tip', label: '팁 상자', description: '초록색 도움말 상자', example: '💡 팁', iconId: 'callout-tip', group: 'callout', keywords: 'tip callout 팁 초록 도움말 상자', inSlashMenu: true, run: (v) => insertBlock(v, callout('TIP', '')) },
  { id: 'callout-important', label: '중요 상자', description: '보라색 중요 내용 상자', example: '📌 중요', iconId: 'callout-important', group: 'callout', keywords: 'important callout 중요 보라 강조 상자', inSlashMenu: true, run: (v) => insertBlock(v, callout('IMPORTANT', '')) },
  { id: 'callout-warning', label: '주의 상자', description: '주황색 조심할 내용 상자', example: '⚠️ 주의', iconId: 'callout-warning', group: 'callout', keywords: 'warning callout 주의 주황 조심 상자', inSlashMenu: true, run: (v) => insertBlock(v, callout('WARNING', '')) },
  { id: 'callout-caution', label: '경고 상자', description: '빨간색 위험·금지 상자', example: '🛑 경고', iconId: 'callout-caution', group: 'callout', keywords: 'caution callout 경고 빨강 위험 금지 상자', inSlashMenu: true, run: (v) => insertBlock(v, callout('CAUTION', '')) },

  // 링크·기타
  { id: 'link', label: '링크', description: '글자를 누르면 웹 주소로 이동', example: '🔗 주소', iconId: 'link', group: 'misc', keywords: 'link 링크 url 웹사이트 주소 연결', inSlashMenu: true, run: insertLink },
  { id: 'hr', label: '구분선', description: '문단 사이에 가로줄', example: '── 구분', iconId: 'hr', group: 'misc', keywords: 'hr divider 구분선 가로줄 선 분리', inSlashMenu: true, run: (v) => insertBlock(v, '---\n') },
  { id: 'template-new', label: '템플릿으로 새 문서 만들기', description: '회의록·보고서 등 서식 모음 열기', example: '📋 템플릿', iconId: 'template', group: 'misc', keywords: 'template 템플릿 서식 회의록 보고서 양식 새문서', inSlashMenu: true, run: () => useUi.getState().openTemplateGallery() },
];

export function runAction(view: EditorView, id: string): void {
  EDITOR_ACTIONS.find((a) => a.id === id)?.run(view);
}
