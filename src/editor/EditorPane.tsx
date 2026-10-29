import { useEffect, useRef, useState } from 'react';
import {
  Bold,
  ChevronDown,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  MessageSquareWarning,
  Minus,
  Quote,
  Redo2,
  Sigma,
  SquareCode,
  Strikethrough,
  Table,
  Undo2,
  Workflow,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { redo, undo } from '@codemirror/commands';
import { startCompletion } from '@codemirror/autocomplete';
import { useDocuments } from '../stores/documents';
import { useUi } from '../stores/ui';
import { EDITOR_ACTIONS, runAction } from './commands';
import { attachEditor, detachEditor, getEditorView, showDocument, syncExternalContent } from './editorRegistry';
import { syncFromEditor } from '../preview/scrollSync';
import { scheduleRecordPosition } from '../app/positionTracker';
import { formatEditorDocument } from './formatAction';

const TOOLBAR: (readonly [string, LucideIcon, string] | 'sep')[] = [
  ['bold', Bold, '굵게'],
  ['italic', Italic, '기울임'],
  ['strike', Strikethrough, '취소선'],
  ['code', Code, '인라인 코드'],
  ['link', Link, '링크'],
  'sep',
  ['h1', Heading1, '제목 1'],
  ['h2', Heading2, '제목 2'],
  ['h3', Heading3, '제목 3'],
  'sep',
  ['bullet', List, '글머리 목록'],
  ['numbered', ListOrdered, '번호 목록'],
  ['task', ListChecks, '체크리스트'],
  ['quote', Quote, '인용'],
  'sep',
  ['table', Table, '표'],
  ['codeblock', SquareCode, '코드 블록'],
  ['math', Sigma, '수식 삽입'],
  ['mermaid', Workflow, '다이어그램 삽입'],
  ['hr', Minus, '구분선'],
];

function ToolButton({ icon: Icon, title, onClick }: { icon: LucideIcon; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded p-1.5 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
    >
      <Icon className="size-4" />
    </button>
  );
}

function CalloutMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title="콜아웃 상자"
        aria-label="콜아웃 상자"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center rounded p-1.5 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
      >
        <MessageSquareWarning className="size-4" />
        <ChevronDown className="size-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-44 rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg">
          {EDITOR_ACTIONS.filter((a) => a.group === 'callout').map((a) => (
            <button
              key={a.id}
              type="button"
              title={a.description}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const view = getEditorView();
                if (view) a.run(view);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-[var(--hover)]"
            >
              <span>{a.label}</span>
              <span className="text-xs text-[var(--muted)]">{a.example}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function openSlashMenuAtCursor() {
  const view = getEditorView();
  if (!view) return;
  view.focus();
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const lineHead = view.state.sliceDoc(line.from, from);

  // 이미 줄에 '/'가 입력되어 있다면 startCompletion만 호출
  if (lineHead.trim() === '/' || lineHead.endsWith('/')) {
    startCompletion(view);
    return;
  }

  // 빈 줄이 아니면 새 줄을 만들고 '/' 삽입, 빈 줄이면 바로 '/' 삽입
  let insert = '/';
  let pos = from;
  if (line.text.trim() !== '') {
    insert = '\n/';
    pos = line.to;
  }
  view.dispatch({
    changes: { from: pos, to: pos, insert },
    selection: { anchor: pos + insert.length },
  });
  startCompletion(view);
}

export function EditorPane() {
  const hostRef = useRef<HTMLDivElement>(null);
  const activeId = useDocuments((s) => s.activeId);

  useEffect(() => {
    const view = attachEditor(hostRef.current!);
    const onScroll = () => {
      if (useUi.getState().viewMode === 'split') syncFromEditor(view);
      scheduleRecordPosition(300);
    };
    view.scrollDOM.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      view.scrollDOM.removeEventListener('scroll', onScroll);
      detachEditor();
    };
  }, []);

  useEffect(() => {
    if (!activeId) return;
    const doc = useDocuments.getState().docs[activeId];
    if (doc) showDocument(activeId, doc.content);
  }, [activeId]);

  // 에디터 밖에서 바뀐 내용(같은 파일 다시 열기 등)을 반영
  useEffect(
    () =>
      useDocuments.subscribe((s) => {
        const doc = s.activeId ? s.docs[s.activeId] : undefined;
        if (doc) syncExternalContent(doc.id, doc.content);
      }),
    [],
  );

  const run = (id: string) => {
    const view = getEditorView();
    if (view) runAction(view, id);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="no-print flex shrink-0 flex-wrap items-center gap-0.5 border-b border-[var(--border)] px-2 py-1">
        <ToolButton icon={Undo2} title="실행 취소 (Ctrl+Z)" onClick={() => { const v = getEditorView(); if (v) undo(v); }} />
        <ToolButton icon={Redo2} title="다시 실행 (Ctrl+Y)" onClick={() => { const v = getEditorView(); if (v) redo(v); }} />
        <span className="mx-1 h-4 w-px bg-[var(--border)]" />
        {TOOLBAR.map((item, i) =>
          item === 'sep' ? (
            <span key={i} className="mx-1 h-4 w-px bg-[var(--border)]" />
          ) : (
            <ToolButton key={item[0]} icon={item[1]} title={item[2]} onClick={() => run(item[0])} />
          ),
        )}
        <CalloutMenu />
        <span className="mx-1 h-4 w-px bg-[var(--border)]" />
        <ToolButton
          icon={Sparkles}
          title="서식 정리"
          onClick={() => {
            const v = getEditorView();
            if (v) formatEditorDocument(v);
          }}
        />
        <div className="ml-auto flex items-center pl-2">
          <button
            type="button"
            title="삽입 메뉴 열기 (빈 줄에서 / 입력과 동일)"
            aria-label="삽입 ＋"
            onMouseDown={(e) => e.preventDefault()}
            onClick={openSlashMenuAtCursor}
            className="flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--hover)] hover:text-[var(--text)] transition-colors"
          >
            <span>삽입 ＋</span>
          </button>
        </div>
      </div>
      <div ref={hostRef} className="min-h-0 flex-1" />
    </div>
  );
}
