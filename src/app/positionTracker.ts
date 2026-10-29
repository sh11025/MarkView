/**
 * 활성 문서의 커서 및 스크롤 위치 추적.
 * 탭 전환 직전, 탭 숨김 시, 그리고 스크롤이 멈추고 300ms 뒤에 기록한다.
 */
import { useDocuments } from '../stores/documents';
import { usePositions } from '../stores/positions';
import { getEditorView, setSelectionChangeHandler } from '../editor/editorRegistry';
import { editorTopLine, getPreviewElement, getPreviewTopLine } from '../preview/scrollSync';

let debounceTimer: number | undefined;

setSelectionChangeHandler(() => scheduleRecordPosition(300));

export function recordCurrentPosition(): void {
  const activeId = useDocuments.getState().activeId;
  if (!activeId) return;

  const view = getEditorView();
  const preview = getPreviewElement();

  let anchor = 0;
  let head = 0;
  let editorLine = 0;
  let previewLine = 0;

  const prev = usePositions.getState().positions[activeId];
  if (prev) {
    anchor = prev.anchor;
    head = prev.head;
    editorLine = prev.editorLine;
    previewLine = prev.previewLine;
  }

  if (view) {
    anchor = view.state.selection.main.anchor;
    head = view.state.selection.main.head;
    editorLine = Math.floor(editorTopLine(view));
  }

  if (preview) {
    previewLine = getPreviewTopLine(preview);
  }

  usePositions.getState().update(activeId, {
    anchor,
    head,
    editorLine,
    previewLine,
  });
}

/** 스크롤 멈추고 300ms 뒤에 위치 기록 */
export function scheduleRecordPosition(delay = 300): void {
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(recordCurrentPosition, delay);
}
