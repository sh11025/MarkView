/**
 * 분할 보기 동기 스크롤. 미리보기 요소의 `data-line`(원문 줄 번호)을 기준점으로 삼아
 * 기준점 사이를 비례 보간한다. 한쪽을 움직이면 잠시 반대쪽 스크롤 이벤트를 무시해 되먹임을 막는다.
 */
import type { EditorView } from '@codemirror/view';
import { findClosestPreviewLine } from '../features/position/positions';

interface Anchor {
  line: number;
  top: number;
}

let previewEl: HTMLElement | null = null;
let anchors: Anchor[] | null = null;
let lockedBy: 'editor' | 'preview' | null = null;
let unlockTimer: number | undefined;

export function registerPreview(el: HTMLElement | null): void {
  previewEl = el;
  anchors = null;
}

export function getPreviewElement(): HTMLElement | null {
  return previewEl;
}

/** 목차에서 고른 제목으로 미리보기를 스크롤. 미리보기가 보이지 않으면 false */
export function scrollPreviewTo(id: string): boolean {
  if (!previewEl || !previewEl.offsetParent) return false;
  const target = previewEl.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`);
  if (!target) return false;
  previewEl.scrollTo({ top: target.offsetTop - 12, behavior: 'smooth' });
  return true;
}

/** 미리보기 내용이 바뀌거나 크기가 바뀌면 호출 */
export function invalidateAnchors(): void {
  anchors = null;
}

function lock(by: 'editor' | 'preview'): void {
  lockedBy = by;
  window.clearTimeout(unlockTimer);
  unlockTimer = window.setTimeout(() => (lockedBy = null), 120);
}

function getAnchors(totalLines: number): Anchor[] {
  if (anchors || !previewEl) return anchors ?? [];
  const base = previewEl.getBoundingClientRect().top - previewEl.scrollTop;
  const list: Anchor[] = [{ line: 0, top: 0 }];
  previewEl.querySelectorAll<HTMLElement>('[data-line]').forEach((el) => {
    if (!el.offsetParent) return;
    const line = Number(el.dataset.line);
    const top = el.getBoundingClientRect().top - base;
    const last = list[list.length - 1];
    if (line > last.line && top >= last.top) list.push({ line, top });
  });
  list.push({ line: totalLines, top: previewEl.scrollHeight });
  anchors = list;
  return list;
}

export function editorTopLine(view: EditorView): number {
  const scroller = view.scrollDOM;
  const docOffset = view.documentTop - scroller.getBoundingClientRect().top + scroller.scrollTop;
  const height = Math.max(0, scroller.scrollTop - docOffset);
  const block = view.lineBlockAtHeight(height);
  const line = view.state.doc.lineAt(block.from).number - 1;
  return line + Math.min(1, Math.max(0, (height - block.top) / Math.max(1, block.height)));
}

export function scrollEditorToLine(view: EditorView, line: number): void {
  const lineNo = Math.max(1, Math.min(view.state.doc.lines, Math.floor(line) + 1));
  const pos = view.state.doc.line(lineNo).from;
  const block = view.lineBlockAt(pos);
  const scroller = view.scrollDOM;
  const docOffset = view.documentTop - scroller.getBoundingClientRect().top + scroller.scrollTop;
  scroller.scrollTop = Math.max(0, docOffset + block.top);
}

export function getPreviewTopLine(container: HTMLElement): number {
  if (container.scrollTop <= 2) return 0;
  const elements = container.querySelectorAll<HTMLElement>('[data-line]');
  if (elements.length === 0) return 0;
  const containerTop = container.getBoundingClientRect().top;
  for (const el of elements) {
    if (!el.offsetParent && el.tagName !== 'TR') continue;
    const rect = el.getBoundingClientRect();
    if (rect.bottom > containerTop + 4) {
      return Number(el.dataset.line);
    }
  }
  return Number(elements[elements.length - 1].dataset.line);
}

export function scrollPreviewToLine(container: HTMLElement, targetLine: number): void {
  if (targetLine <= 0) {
    container.scrollTo({ top: 0 });
    return;
  }
  const elements = [...container.querySelectorAll<HTMLElement>('[data-line]')].filter(
    (el) => el.offsetParent || el.tagName === 'TR',
  );
  if (elements.length === 0) return;
  const lines = elements.map((el) => Number(el.dataset.line));
  const bestLine = findClosestPreviewLine(lines, targetLine);
  if (bestLine === null || bestLine <= 0) {
    container.scrollTo({ top: 0 });
    return;
  }
  const targetEl = elements.find((el) => Number(el.dataset.line) === bestLine);
  if (targetEl) {
    const containerRect = container.getBoundingClientRect();
    const elRect = targetEl.getBoundingClientRect();
    const targetTop = elRect.top - containerRect.top + container.scrollTop;
    container.scrollTo({ top: Math.max(0, targetTop) });
  }
}

export function syncFromEditor(view: EditorView): void {
  if (!previewEl || lockedBy === 'preview') return;
  const list = getAnchors(view.state.doc.lines);
  const line = editorTopLine(view);
  let i = 0;
  while (i < list.length - 2 && list[i + 1].line <= line) i++;
  const a = list[i];
  const b = list[i + 1] ?? a;
  const ratio = b.line > a.line ? (line - a.line) / (b.line - a.line) : 0;
  lock('editor');
  previewEl.scrollTop = a.top + (b.top - a.top) * ratio;
}

export function syncFromPreview(view: EditorView): void {
  if (!previewEl || lockedBy === 'editor') return;
  const list = getAnchors(view.state.doc.lines);
  const top = previewEl.scrollTop;
  let i = 0;
  while (i < list.length - 2 && list[i + 1].top <= top) i++;
  const a = list[i];
  const b = list[i + 1] ?? a;
  const ratio = b.top > a.top ? (top - a.top) / (b.top - a.top) : 0;
  const lineFloat = a.line + (b.line - a.line) * ratio;

  const doc = view.state.doc;
  const lineNo = Math.min(doc.lines, Math.floor(lineFloat) + 1);
  const block = view.lineBlockAt(doc.line(lineNo).from);
  const scroller = view.scrollDOM;
  const docOffset = view.documentTop - scroller.getBoundingClientRect().top + scroller.scrollTop;
  lock('preview');
  scroller.scrollTop = docOffset + block.top + block.height * (lineFloat - Math.floor(lineFloat));
}
