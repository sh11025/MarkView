/**
 * 수식·다이어그램 템플릿 갤러리 삽입 문자열 생성 및 에디터 단일 트랜잭션 삽입 유틸리티.
 */
import { isolateHistory } from '@codemirror/commands';
import type { EditorView } from '@codemirror/view';

/**
 * 수식 LaTeX 원문을 블록(`$$ ... $$`) 또는 인라인(`$ ... $`) 마크다운 문자열로 감싼다.
 */
export function formatMathInsertion(latex: string, isBlock = true): string {
  const trimmed = latex.trim();
  if (!isBlock) {
    return `$${trimmed}$`;
  }
  return `$$\n${trimmed}\n$$`;
}

/**
 * Mermaid 다이어그램 코드를 마크다운 코드 블록 문자열로 감싼다.
 */
export function formatDiagramInsertion(code: string): string {
  const trimmed = code.trim();
  return `\`\`\`mermaid\n${trimmed}\n\`\`\``;
}

/**
 * 에디터의 현재 커서 위치에 스니펫을 단일 트랜잭션(Ctrl+Z 1회 복원 보장)으로 삽입한다.
 * 블록 스니펫은 앞뒤 줄바꿈을 자동으로 맞춰 주고, 인라인 스니펫은 선택 영역 자리에 바로 넣는다.
 */
export function insertSnippetAtCursor(view: EditorView, snippet: string, isBlock = true): void {
  const { state } = view;
  const { from, to } = state.selection.main;

  if (!isBlock) {
    view.dispatch({
      changes: { from, to, insert: snippet },
      selection: { anchor: from + snippet.length },
      annotations: isolateHistory.of('full'),
      userEvent: 'input.gallery',
      scrollIntoView: true,
    });
    view.focus();
    return;
  }

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

  const fullText = prefix + snippet + suffix;
  view.dispatch({
    changes: { from: insertFrom, to: insertTo, insert: fullText },
    selection: { anchor: insertFrom + prefix.length + snippet.length },
    annotations: isolateHistory.of('full'),
    userEvent: 'input.gallery',
    scrollIntoView: true,
  });
  view.focus();
}
