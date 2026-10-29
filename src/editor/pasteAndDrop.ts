/** 에디터 붙여넣기·드롭: 이미지 → 첨부, 스프레드시트 → 표, 마크다운 파일 → 새 탭 */
import { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { clipboardToMarkdownTable } from '../features/paste/clipboardTable';
import { addAttachment } from '../storage/attachments';
import { isMarkdownFileName } from '../storage/fileSystem';
import { insertBlock } from './commands';
import { triggerStorageQuotaCheck } from '../app/storageQuotaAlert';

const CODE_NODES = new Set(['FencedCode', 'CodeBlock', 'InlineCode', 'CodeText']);

function isInCode(view: EditorView, pos: number): boolean {
  for (let node: ReturnType<typeof syntaxTree>['topNode'] | null = syntaxTree(view.state).resolveInner(pos, -1); node; node = node.parent) {
    if (CODE_NODES.has(node.name)) return true;
  }
  return false;
}

async function insertImages(view: EditorView, files: File[], pos: number): Promise<void> {
  const parts: string[] = [];
  for (const file of files) {
    const id = await addAttachment(file, file.name);
    const alt = file.name && file.name !== 'image.png' ? file.name.replace(/\.[^.]+$/, '') : '이미지';
    parts.push(`![${alt}](attachment:${id})`);
  }
  const insert = parts.join('\n');
  view.dispatch({ changes: { from: pos, insert }, selection: { anchor: pos + insert.length } });
  view.focus();
  void triggerStorageQuotaCheck();
}

/** 드롭된 마크다운 파일 처리는 앱 쪽에서 등록한다 (탭 열기) */
let onMarkdownDrop: ((items: DataTransferItemList) => void) | null = null;
export function setMarkdownDropHandler(handler: (items: DataTransferItemList) => void): void {
  onMarkdownDrop = handler;
}

export const pasteAndDrop = EditorView.domEventHandlers({
  paste(event, view) {
    const data = event.clipboardData;
    if (!data) return false;

    const images = [...data.files].filter((f) => f.type.startsWith('image/'));
    if (images.length > 0) {
      event.preventDefault();
      void insertImages(view, images, view.state.selection.main.from);
      return true;
    }

    if (isInCode(view, view.state.selection.main.from)) return false;
    const table = clipboardToMarkdownTable(data.getData('text/html'), data.getData('text/plain'));
    if (table) {
      event.preventDefault();
      insertBlock(view, table);
      return true;
    }
    return false;
  },

  drop(event, view) {
    const data = event.dataTransfer;
    if (!data || data.files.length === 0) return false;
    const files = [...data.files];

    if (files.some((f) => isMarkdownFileName(f.name))) {
      event.preventDefault();
      onMarkdownDrop?.(data.items);
      return true;
    }

    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length > 0) {
      event.preventDefault();
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.from;
      void insertImages(view, images, pos);
      return true;
    }
    return false;
  },
});
