import { create } from 'zustand';
import type { StoredDoc } from '../storage/db';
import { newId } from '../storage/db';
import type { OpenedFile } from '../storage/fileSystem';

export type Doc = StoredDoc;

/** 디스크 파일에 저장되지 않은 변경이 있는지 (브라우저 자동 저장과는 별개) */
export const isDirty = (doc: Doc): boolean => doc.updatedAt > doc.savedAt;

interface DocumentsState {
  docs: Record<string, Doc>;
  order: string[];
  activeId: string | null;

  hydrate(docs: Doc[], order: string[], activeId: string | null): void;
  createDoc(init?: { name?: string; content?: string }): string;
  addOpenedFiles(files: OpenedFile[]): void;
  addRestoredDocs(restoredDocs: StoredDoc[]): void;
  updateContent(id: string, content: string): void;
  rename(id: string, name: string): void;
  close(id: string): void;
  setActive(id: string): void;
  markSaved(id: string, info: { handleId: string | null; name?: string; diskModified?: number }): void;
  reloadDoc(id: string, content: string, diskModified: number): void;
  updateDiskModified(id: string, diskModified: number): void;
}

function ensureMdName(name: string): string {
  const trimmed = name.trim() || '새 문서';
  return /\.(md|markdown|txt)$/i.test(trimmed) ? trimmed : `${trimmed}.md`;
}

function nextUntitledName(docs: Record<string, Doc>): string {
  const names = new Set(Object.values(docs).map((d) => d.name));
  if (!names.has('새 문서.md')) return '새 문서.md';
  let n = 2;
  while (names.has(`새 문서 ${n}.md`)) n++;
  return `새 문서 ${n}.md`;
}

export const useDocuments = create<DocumentsState>((set, get) => ({
  docs: {},
  order: [],
  activeId: null,

  hydrate(docs, order, activeId) {
    const map = Object.fromEntries(docs.map((d) => [d.id, d]));
    const validOrder = order.filter((id) => map[id]);
    for (const d of docs) if (!validOrder.includes(d.id)) validOrder.push(d.id);
    set({ docs: map, order: validOrder, activeId: activeId && map[activeId] ? activeId : (validOrder[0] ?? null) });
  },

  createDoc(init = {}) {
    const now = Date.now();
    const doc: Doc = {
      id: newId('doc'),
      name: init.name ? ensureMdName(init.name) : nextUntitledName(get().docs),
      content: init.content ?? '',
      updatedAt: now,
      savedAt: now,
      handleId: null,
      diskModified: 0,
    };
    set((s) => ({ docs: { ...s.docs, [doc.id]: doc }, order: [...s.order, doc.id], activeId: doc.id }));
    return doc.id;
  },

  addOpenedFiles(files) {
    if (files.length === 0) return;
    const now = Date.now();
    const docs = { ...get().docs };
    const order = [...get().order];
    let lastId: string | null = null;

    for (const file of files) {
      // 같은 파일이 이미 열려 있으면 새 탭을 만들지 않는다 (handleId 또는 (sourceFolder, folderPath) 기준)
      const existing = Object.values(docs).find((d) => {
        if (file.handleId && d.handleId === file.handleId) return true;
        if (
          file.sourceFolder &&
          file.folderPath &&
          d.sourceFolder === file.sourceFolder &&
          d.folderPath === file.folderPath
        ) {
          return true;
        }
        if (!file.sourceFolder && !d.sourceFolder && file.folderPath && d.folderPath === file.folderPath) {
          return true;
        }
        return false;
      });

      if (existing) {
        if (!isDirty(existing)) {
          docs[existing.id] = {
            ...existing,
            content: file.content,
            updatedAt: now,
            savedAt: now,
            diskModified: file.lastModified,
            folderPath: existing.folderPath ?? file.folderPath,
            sourceFolder: existing.sourceFolder ?? file.sourceFolder,
          };
        } else {
          docs[existing.id] = {
            ...existing,
            folderPath: existing.folderPath ?? file.folderPath,
            sourceFolder: existing.sourceFolder ?? file.sourceFolder,
          };
        }
        lastId = existing.id;
        continue;
      }
      const doc: Doc = {
        id: newId('doc'),
        name: file.name,
        content: file.content,
        updatedAt: now,
        savedAt: now,
        handleId: file.handleId,
        diskModified: file.lastModified,
        folderPath: file.folderPath,
        sourceFolder: file.sourceFolder,
      };
      docs[doc.id] = doc;
      order.push(doc.id);
      lastId = doc.id;
    }
    set({ docs, order, activeId: lastId ?? get().activeId });
  },

  addRestoredDocs(restoredDocs: StoredDoc[]) {
    if (restoredDocs.length === 0) return;
    const docs = { ...get().docs };
    const order = [...get().order];
    for (const d of restoredDocs) {
      docs[d.id] = d;
      order.push(d.id);
    }
    set({ docs, order, activeId: restoredDocs[0].id });
  },

  updateContent(id, content) {
    const doc = get().docs[id];
    if (!doc || doc.content === content) return;
    set((s) => ({ docs: { ...s.docs, [id]: { ...doc, content, updatedAt: Date.now() } } }));
  },

  rename(id, name) {
    const doc = get().docs[id];
    if (!doc) return;
    set((s) => ({ docs: { ...s.docs, [id]: { ...doc, name: ensureMdName(name) } } }));
  },

  close(id) {
    const { docs, order, activeId } = get();
    if (!docs[id]) return;
    const rest = { ...docs };
    delete rest[id];
    const idx = order.indexOf(id);
    const nextOrder = order.filter((x) => x !== id);
    const nextActive = activeId === id ? (nextOrder[Math.min(idx, nextOrder.length - 1)] ?? null) : activeId;
    set({ docs: rest, order: nextOrder, activeId: nextActive });
    if (nextOrder.length === 0) get().createDoc();
  },

  setActive(id) {
    if (get().docs[id]) set({ activeId: id });
  },

  markSaved(id, { handleId, name, diskModified }) {
    const doc = get().docs[id];
    if (!doc) return;
    set((s) => ({
      docs: {
        ...s.docs,
        [id]: {
          ...doc,
          handleId: handleId !== undefined ? handleId : doc.handleId,
          name: name ?? doc.name,
          savedAt: Math.max(Date.now(), doc.updatedAt),
          diskModified: diskModified !== undefined ? diskModified : (doc.diskModified ?? 0),
        },
      },
    }));
  },

  reloadDoc(id, content, diskModified) {
    const doc = get().docs[id];
    if (!doc) return;
    const now = Date.now();
    set((s) => ({
      docs: {
        ...s.docs,
        [id]: {
          ...doc,
          content,
          updatedAt: now,
          savedAt: now,
          diskModified,
        },
      },
    }));
  },

  updateDiskModified(id, diskModified) {
    const doc = get().docs[id];
    if (!doc) return;
    set((s) => ({
      docs: { ...s.docs, [id]: { ...doc, diskModified } },
    }));
  },
}));

export function getActiveDoc(): Doc | null {
  const { docs, activeId } = useDocuments.getState();
  return activeId ? (docs[activeId] ?? null) : null;
}
