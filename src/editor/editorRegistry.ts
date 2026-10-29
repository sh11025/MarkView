/**
 * 에디터와 나머지 앱을 잇는 통로.
 * 미리보기에서 하는 편집도 여기의 `replaceLines`로 에디터 트랜잭션이 되므로 Ctrl+Z로 되돌릴 수 있다.
 */
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { baseExtensions } from './extensions';
import { useDocuments } from '../stores/documents';
import { usePositions } from '../stores/positions';
import { clampCursor } from '../features/position/positions';
import { scrollEditorToLine } from '../preview/scrollSync';

let view: EditorView | null = null;
let currentDocId: string | null = null;
const states = new Map<string, EditorState>();
/** 에디터가 마지막으로 스토어에 넘긴 내용 (외부 변경과 구분용) */
const lastEmitted = new Map<string, string>();
let onSelectionChange: (() => void) | null = null;

export function setSelectionChangeHandler(handler: () => void): void {
  onSelectionChange = handler;
}

function emit(text: string): void {
  if (!currentDocId) return;
  lastEmitted.set(currentDocId, text);
  useDocuments.getState().updateContent(currentDocId, text);
}

function createState(content: string, selection?: { anchor: number; head: number }): EditorState {
  return EditorState.create({
    doc: content,
    extensions: baseExtensions(emit, () => onSelectionChange?.()),
    selection: selection ? EditorSelection.range(selection.anchor, selection.head) : undefined,
  });
}

export function attachEditor(parent: HTMLElement): EditorView {
  view = new EditorView({ parent, state: createState('') });
  return view;
}

export function detachEditor(): void {
  view?.destroy();
  view = null;
  currentDocId = null;
}

export function getEditorView(): EditorView | null {
  return view;
}

/** 활성 문서를 에디터에 띄운다. 문서마다 EditorState(실행 취소 기록 포함)를 따로 보관한다. */
export function showDocument(id: string, content: string): void {
  if (!view) return;
  if (currentDocId && currentDocId !== id) states.set(currentDocId, view.state);
  currentDocId = id;

  let state = states.get(id);
  const savedPos = usePositions.getState().positions[id];
  if (!state) {
    const safeCursor = savedPos
      ? clampCursor({ anchor: savedPos.anchor, head: savedPos.head }, content.length)
      : undefined;
    state = createState(content, safeCursor);
    lastEmitted.set(id, content);
  }
  view.setState(state);
  syncExternalContent(id, content);

  if (savedPos && typeof savedPos.editorLine === 'number') {
    requestAnimationFrame(() => {
      if (view && currentDocId === id) {
        scrollEditorToLine(view, savedPos.editorLine);
      }
    });
  }
}

/** 스토어 내용이 에디터 밖에서 바뀌었으면(파일 다시 열기 등) 에디터에 반영한다. */
export function syncExternalContent(id: string, content: string): void {
  if (!view || id !== currentDocId || lastEmitted.get(id) === content) return;
  if (view.state.doc.toString() === content) return;
  lastEmitted.set(id, content);
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } });
}

export function forgetDocument(id: string): void {
  states.delete(id);
  lastEmitted.delete(id);
  usePositions.getState().remove(id);
}

/** 원문 줄 [from, to) (0부터)를 새 줄들로 바꾼다. */
export function replaceLines(from: number, to: number, lines: string[]): void {
  if (!view) return;
  const doc = view.state.doc;
  if (from < 0 || to > doc.lines || from >= to) return;
  const start = doc.line(from + 1).from;
  const end = doc.line(to).to;
  view.dispatch({ changes: { from: start, to: end, insert: lines.join('\n') }, userEvent: 'input.preview' });
}

export function getLines(from: number, to: number): string[] {
  if (!view) return [];
  const doc = view.state.doc;
  const out: string[] = [];
  for (let n = from + 1; n <= Math.min(to, doc.lines); n++) out.push(doc.line(n).text);
  return out;
}

/** 원문 줄(0부터)로 커서를 옮기고 보이게 한다. */
export function revealLine(line: number): void {
  if (!view) return;
  const pos = view.state.doc.line(Math.min(line + 1, view.state.doc.lines)).from;
  view.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: 'start', yMargin: 16 }) });
}
