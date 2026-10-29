/**
 * 에디터 서식 정리 액션.
 * 문서 전체를 교체하지 않고, 앞뒤의 같은 줄을 제외한 가운데 부분만
 * 단일 트랜잭션으로 교체하여 커서와 스크롤 위치를 최대한 유지한다.
 */

import type { EditorView } from '@codemirror/view';
import { formatMarkdown } from '../features/format/formatMarkdown';
import { toast } from '../stores/ui';

function splitIntoLines(text: string): string[] {
  if (text.length === 0) return [];
  const lines: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      lines.push(text.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < text.length) {
    lines.push(text.slice(start));
  }
  return lines;
}

export function formatEditorDocument(view: EditorView): void {
  const oldText = view.state.doc.toString();
  const newText = formatMarkdown(oldText);

  if (oldText === newText) {
    toast('이미 정리되어 있습니다.');
    return;
  }

  const oldLines = splitIntoLines(oldText);
  const newLines = splitIntoLines(newText);

  let start = 0;
  while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) {
    start++;
  }

  let oldEnd = oldLines.length;
  let newEnd = newLines.length;
  while (oldEnd > start && newEnd > start && oldLines[oldEnd - 1] === newLines[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }

  const from = oldLines.slice(0, start).join('').length;
  const to = from + oldLines.slice(start, oldEnd).join('').length;
  const insert = newLines.slice(start, newEnd).join('');

  view.dispatch({
    changes: { from, to, insert },
    userEvent: 'format.document',
  });

  toast('서식을 정리했습니다.');
}
