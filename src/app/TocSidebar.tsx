import { useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useUi } from '../stores/ui';
import { scrollPreviewTo } from '../preview/scrollSync';
import { revealLine } from '../editor/editorRegistry';
import { useFolder } from '../stores/folder';
import { useDocuments } from '../stores/documents';
import { useSettings, type TocMaxLevel } from '../stores/settings';
import { filterTocItems } from '../features/toc/tocFilter';
import { openFileFromFolder, openFolderFromDisk } from './fileActions';
import { canUseFolderPicker } from '../storage/folder';
import type { FolderEntry } from '../features/folder/types';

function FolderTreeNode({
  entry,
  depth,
  expandedPaths,
  toggleExpand,
  activeDocPath,
  activeDocHandleId,
}: {
  entry: FolderEntry;
  depth: number;
  expandedPaths: Set<string>;
  toggleExpand: (path: string) => void;
  activeDocPath?: string;
  activeDocHandleId?: string | null;
}) {
  if (entry.kind === 'directory') {
    const isExpanded = expandedPaths.has(entry.path);
    return (
      <li>
        <button
          type="button"
          onClick={() => toggleExpand(entry.path)}
          style={{ paddingLeft: `${depth * 12 + 6}px` }}
          className="flex w-full items-center gap-1.5 rounded py-1 pr-2 text-left text-sm text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
        >
          {isExpanded ? (
            <ChevronDown className="size-3.5 shrink-0 opacity-70" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 opacity-70" />
          )}
          {isExpanded ? (
            <FolderOpen className="size-4 shrink-0 text-[var(--accent)]" />
          ) : (
            <Folder className="size-4 shrink-0 opacity-80" />
          )}
          <span className="truncate">{entry.name}</span>
        </button>
        {isExpanded && entry.children.length > 0 && (
          <ul className="space-y-0.5">
            {entry.children.map((child) => (
              <FolderTreeNode
                key={child.path}
                entry={child}
                depth={depth + 1}
                expandedPaths={expandedPaths}
                toggleExpand={toggleExpand}
                activeDocPath={activeDocPath}
                activeDocHandleId={activeDocHandleId}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  // 파일 항목
  const isActive = activeDocPath ? activeDocPath === entry.path : false;

  return (
    <li>
      <button
        type="button"
        onClick={() => void openFileFromFolder(entry)}
        style={{ paddingLeft: `${depth * 12 + 22}px` }}
        className={`flex w-full items-center gap-1.5 rounded py-1 pr-2 text-left text-sm ${
          isActive
            ? 'bg-[var(--hover)] font-semibold text-[var(--accent)]'
            : 'text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]'
        }`}
        title={entry.path}
      >
        <FileText className="size-3.5 shrink-0 opacity-80" />
        <span className="truncate">{entry.name}</span>
      </button>
    </li>
  );
}

function FilesTabContent() {
  const folder = useFolder((s) => s.folder);
  const tree = useFolder((s) => s.tree);
  const isLoading = useFolder((s) => s.isLoading);
  const error = useFolder((s) => s.error);
  const needPermission = useFolder((s) => s.needPermission);
  const truncated = useFolder((s) => s.truncated);
  const expandedPaths = useFolder((s) => s.expandedPaths);
  const toggleExpand = useFolder((s) => s.toggleExpand);
  const refresh = useFolder((s) => s.refresh);
  const closeFolder = useFolder((s) => s.closeFolder);
  const reconnect = useFolder((s) => s.reconnect);

  const activeDoc = useDocuments((s) => (s.activeId ? s.docs[s.activeId] : undefined));

  // 1. 폴더가 연결되어 있지 않은 경우
  if (!folder) {
    return (
      <div className="space-y-3 px-2 py-3 text-center">
        <p className="text-xs text-[var(--muted)]">작업 폴더를 열어 마크다운 파일을 관리하세요.</p>
        {canUseFolderPicker ? (
          <button
            type="button"
            onClick={() => void openFolderFromDisk()}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--hover)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--border)]"
          >
            <FolderPlus className="size-3.5" />
            <span>폴더 열기</span>
          </button>
        ) : (
          <p className="text-[11px] text-[var(--muted)]">이 브라우저에서는 폴더 열기를 지원하지 않습니다.</p>
        )}
      </div>
    );
  }

  // 2. 권한이 필요한 경우 (새로고침 후)
  if (needPermission) {
    return (
      <div className="space-y-3 px-2 py-3 text-center">
        <div className="text-xs font-semibold text-[var(--text)] truncate">📁 {folder.name}</div>
        <p className="text-xs text-[var(--muted)]">폴더 접근 권한이 필요합니다.</p>
        <button
          type="button"
          onClick={() => void reconnect()}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:opacity-90"
        >
          <span>폴더 다시 연결</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 폴더 헤더 */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-1 pb-1.5">
        <span className="truncate text-xs font-bold text-[var(--text)]" title={folder.name}>
          📁 {folder.name}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="새로고침"
            onClick={() => void refresh()}
            disabled={isLoading}
            className="rounded p-1 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-40"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            title="폴더 닫기"
            onClick={() => void closeFolder()}
            className="rounded p-1 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* 로딩 / 에러 / 잘림 안내 */}
      {isLoading && <p className="px-2 py-1 text-xs text-[var(--muted)]">불러오는 중…</p>}

      {error && (
        <div className="rounded bg-red-500/10 p-2 text-xs text-red-600 dark:text-red-400">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-1 font-semibold underline"
          >
            다시 시도
          </button>
        </div>
      )}

      {truncated && (
        <div className="flex items-start gap-1 rounded bg-amber-500/10 p-1.5 text-[11px] text-amber-700 dark:text-amber-300">
          <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
          <span>파일이 너무 많아 일부만 표시됩니다</span>
        </div>
      )}

      {/* 파일 트리 */}
      {!isLoading && tree.length === 0 && !error && (
        <p className="px-2 py-3 text-xs text-[var(--muted)]">마크다운 파일이 없습니다.</p>
      )}

      {tree.length > 0 && (
        <ul className="space-y-0.5">
          {tree.map((entry) => (
            <FolderTreeNode
              key={entry.path}
              entry={entry}
              depth={0}
              expandedPaths={expandedPaths}
              toggleExpand={toggleExpand}
              activeDocPath={activeDoc?.folderPath}
              activeDocHandleId={activeDoc?.handleId}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

const TOC_DEPTH_OPTIONS: readonly [TocMaxLevel, string][] = [
  [6, '전체'],
  [2, 'H2까지'],
  [3, 'H3까지'],
];

export function TocSidebar() {
  const toc = useUi((s) => s.toc);
  const activeHeadingId = useUi((s) => s.activeHeadingId);
  const collapsedTocByDoc = useUi((s) => s.collapsedTocByDoc);
  const toggleTocCollapse = useUi((s) => s.toggleTocCollapse);
  const activeDocId = useDocuments((s) => s.activeId);

  const tocMaxLevel = useSettings((s) => s.tocMaxLevel);
  const setSettings = useSettings((s) => s.set);

  const [searchQuery, setSearchQuery] = useState('');

  const collapsedIds = activeDocId ? (collapsedTocByDoc[activeDocId] ?? []) : [];
  const visibleItems = filterTocItems(toc, {
    maxLevel: tocMaxLevel,
    query: searchQuery,
    collapsedIds,
  });

  const minLevel = Math.min(...toc.map((t) => t.level), 6);

  const activeTab = useFolder((s) => s.activeTab);
  const setActiveTab = useFolder((s) => s.setActiveTab);

  return (
    <aside className="no-print hidden w-60 shrink-0 overflow-y-auto border-r border-[var(--border)] bg-[var(--surface-2)] px-2 py-3 md:block">
      {/* 탭 전환 버튼: 목차 / 파일 */}
      <div className="mb-2 flex gap-1 rounded-md bg-[var(--surface)] p-0.5 border border-[var(--border)]">
        <button
          type="button"
          onClick={() => setActiveTab('toc')}
          className={`flex-1 rounded py-1 text-xs font-semibold transition-colors ${
            activeTab === 'toc'
              ? 'bg-[var(--hover)] font-bold text-[var(--text)] shadow-xs'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          목차
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('files')}
          className={`flex-1 rounded py-1 text-xs font-semibold transition-colors ${
            activeTab === 'files'
              ? 'bg-[var(--hover)] font-bold text-[var(--text)] shadow-xs'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          파일
        </button>
      </div>

      {activeTab === 'toc' ? (
        <div>
          {/* 목차 헤더 및 깊이 필터 */}
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-[var(--muted)]">목차</span>
            <div className="flex items-center gap-0.5 rounded bg-[var(--surface)] p-0.5 border border-[var(--border)]">
              {TOC_DEPTH_OPTIONS.map(([level, label]) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setSettings({ tocMaxLevel: level })}
                  className={`rounded px-1.5 py-0.5 text-[11px] transition-colors ${
                    tocMaxLevel === level
                      ? 'bg-[var(--hover)] font-semibold text-[var(--text)]'
                      : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 목차 검색칸 */}
          {toc.length > 0 && (
            <div className="relative mb-2 px-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[var(--muted)] opacity-70" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="제목 검색…"
                aria-label="목차 검색"
                className="w-full rounded border border-[var(--border)] bg-[var(--surface)] py-1 pr-6 pl-7 text-xs text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="목차 검색어 지우기"
                  onClick={() => setSearchQuery('')}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          )}

          {toc.length === 0 ? (
            <p className="px-2 text-xs text-[var(--muted)]">제목(#)을 쓰면 여기에 목차가 생깁니다.</p>
          ) : visibleItems.length === 0 ? (
            <p className="px-2 py-2 text-xs text-[var(--muted)]">일치하는 제목이 없습니다.</p>
          ) : (
            <ul className="space-y-0.5">
              {visibleItems.map((item) => (
                <li
                  key={item.id}
                  style={{ paddingLeft: `${(item.level - minLevel) * 12}px` }}
                  className="flex items-center gap-0.5"
                >
                  {item.hasChildren ? (
                    <button
                      type="button"
                      aria-label={item.isCollapsed ? `${item.text} 펼치기` : `${item.text} 접기`}
                      title={item.isCollapsed ? '하위 목차 펼치기' : '하위 목차 접기'}
                      onClick={() => {
                        if (activeDocId) toggleTocCollapse(activeDocId, item.id);
                      }}
                      className="flex size-5 shrink-0 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                    >
                      {item.isCollapsed ? (
                        <ChevronRight className="size-3.5" />
                      ) : (
                        <ChevronDown className="size-3.5" />
                      )}
                    </button>
                  ) : (
                    <span className="size-5 shrink-0" />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (!scrollPreviewTo(item.id)) revealLine(item.line);
                    }}
                    className={`min-w-0 flex-1 truncate rounded py-1 px-1.5 text-left text-sm ${
                      item.id === activeHeadingId
                        ? 'bg-[var(--hover)] font-semibold text-[var(--accent)]'
                        : 'text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]'
                    }`}
                    title={item.text}
                  >
                    {item.text || '(제목 없음)'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <FilesTabContent />
      )}
    </aside>
  );
}
