import { useState } from 'react';
import { Plus, X, FileText, Folder, Loader2, Check, AlertTriangle } from 'lucide-react';
import { useDocuments, isDirty } from '../stores/documents';
import { closeDocument } from './fileActions';
import { recordCurrentPosition } from './positionTracker';
import { useUi } from '../stores/ui';
import { resolveSaveStatus, useSaveStatus } from '../features/storage/saveStatus';

export function TabBar() {
  const { docs, order, activeId, setActive, createDoc, rename } = useDocuments();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const isEphemeral = useUi((s) => s.isEphemeral);
  const persistencePhase = useSaveStatus((s) => s.phase);
  const lastAutosavedAt = useSaveStatus((s) => s.lastAutosavedAt);
  const retryHandler = useSaveStatus((s) => s.retryHandler);

  const activeDoc = activeId ? docs[activeId] : undefined;
  const saveStatus = resolveSaveStatus({
    isEphemeral,
    persistencePhase,
    lastAutosavedAt,
    hasFileHandle: Boolean(activeDoc?.handleId),
    isDocDirty: activeDoc ? isDirty(activeDoc) : false,
  });

  const commitRename = (id: string) => {
    const trimmed = draft.trim();
    if (trimmed) rename(id, trimmed.endsWith('.md') || trimmed.includes('.') ? trimmed : `${trimmed}.md`);
    setRenamingId(null);
  };

  const renderStatusText = () => {
    if (saveStatus.label === saveStatus.shortLabel) {
      return <span>{saveStatus.label}</span>;
    }
    return (
      <>
        <span className="hidden sm:inline">{saveStatus.label}</span>
        <span className="sm:hidden">{saveStatus.shortLabel}</span>
      </>
    );
  };

  return (
    <nav className="no-print flex h-9 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--bg)] px-2 text-xs select-none">
      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
        {order.map((id) => {
          const doc = docs[id];
          if (!doc) return null;
          const active = id === activeId;
          const dirty = isDirty(doc);
          const isFolderDoc = Boolean(doc.folderPath);

          return (
            <div
              key={id}
              onClick={() => {
                if (id !== activeId) recordCurrentPosition();
                setActive(id);
              }}
              onDoubleClick={() => {
                setRenamingId(id);
                setDraft(doc.name);
              }}
              title={doc.folderPath ? `${doc.folderPath} (더블클릭하면 이름 변경)` : '더블클릭하면 이름을 바꿉니다'}
              className={`group flex h-7 max-w-52 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 transition ${
                active
                  ? 'border border-[var(--border)] bg-[var(--surface)] font-medium text-[var(--text)] shadow-2xs'
                  : 'text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]'
              }`}
            >
              {isFolderDoc ? (
                <Folder className="size-3.5 shrink-0 text-[var(--accent)] opacity-80" />
              ) : (
                <FileText className="size-3.5 shrink-0 opacity-60" />
              )}
              {renamingId === id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitRename(id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(id);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-28 rounded bg-[var(--surface-2)] px-1 text-xs text-[var(--text)] outline-1 outline-[var(--accent)]"
                />
              ) : (
                <span className="truncate">{doc.name}</span>
              )}
              {dirty && <span title="파일로 저장하지 않은 변경이 있습니다" className="size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />}
              <button
                type="button"
                title="탭 닫기"
                onClick={(e) => {
                  e.stopPropagation();
                  closeDocument(id);
                }}
                className="ml-0.5 rounded p-0.5 opacity-60 hover:bg-[var(--hover)] hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </div>
          );
        })}

        <button
          type="button"
          title="새 문서"
          onClick={() => createDoc()}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {/* 저장 상태 표시 (오른쪽 고정, 모바일에서도 넘치지 않게 축약) */}
      <div className="shrink-0 flex items-center" role="status" aria-live="polite">
        {saveStatus.canRetry ? (
          <button
            type="button"
            aria-label={saveStatus.label}
            title={saveStatus.title}
            onClick={() => {
              void retryHandler?.();
            }}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400 hover:bg-[var(--hover)] transition-colors"
          >
            <AlertTriangle className="size-3 shrink-0" />
            {renderStatusText()}
          </button>
        ) : (
          <span
            aria-label={saveStatus.label}
            title={saveStatus.title}
            className={`flex items-center gap-1 px-1.5 py-0.5 text-[11px] ${
              saveStatus.kind === 'ephemeral'
                ? 'text-amber-700 dark:text-amber-300 font-medium'
                : saveStatus.kind === 'unsaved-changes'
                  ? 'text-[var(--text)] opacity-85'
                  : 'text-[var(--muted)]'
            }`}
          >
            {saveStatus.kind === 'saving' && <Loader2 className="size-3 shrink-0 animate-spin text-[var(--accent)]" />}
            {(saveStatus.kind === 'autosaved' || saveStatus.kind === 'file-saved') && (
              <Check className="size-3 shrink-0 opacity-75" />
            )}
            {saveStatus.kind === 'unsaved-changes' && (
              <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
            )}
            {saveStatus.kind === 'ephemeral' && <AlertTriangle className="size-3 shrink-0" />}
            {renderStatusText()}
          </span>
        )}
      </div>
    </nav>
  );
}
