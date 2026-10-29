import { create } from 'zustand';
import { getDb, kvGet, kvSet, kvDelete, storeFolderHandle, type FolderHandle } from '../storage/db';
import {
  scanDirectory,
  queryFolderPermission,
  requestFolderPermission,
  type DirectoryHandleLike,
} from '../storage/folder';
import type { FolderEntry } from '../features/folder/types';

export type SidebarTab = 'toc' | 'files';

interface ConnectedFolderData {
  handleId: string;
  name: string;
}

interface FolderState {
  folder: ConnectedFolderData | null;
  handle: DirectoryHandleLike | null;
  tree: FolderEntry[];
  isLoading: boolean;
  error: string | null;
  needPermission: boolean;
  truncated: boolean;
  expandedPaths: Set<string>;
  activeTab: SidebarTab;
  refreshCount: number;

  setActiveTab(tab: SidebarTab): void;
  toggleExpand(path: string): void;
  setFolderHandle(handle: DirectoryHandleLike): Promise<void>;
  closeFolder(): Promise<void>;
  refresh(): Promise<void>;
  reconnect(): Promise<void>;
  init(): Promise<void>;
}

export const useFolder = create<FolderState>((set, get) => ({
  folder: null,
  handle: null,
  tree: [],
  isLoading: false,
  error: null,
  needPermission: false,
  truncated: false,
  expandedPaths: new Set(),
  activeTab: 'toc',
  refreshCount: 0,

  setActiveTab(activeTab) {
    set({ activeTab });
  },

  toggleExpand(path) {
    const next = new Set(get().expandedPaths);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    set({ expandedPaths: next });
  },

  async setFolderHandle(handle) {
    try {
      set({ isLoading: true, error: null, needPermission: false });
      const handleId = await storeFolderHandle(handle as FolderHandle);
      const folderData: ConnectedFolderData = { handleId, name: handle.name };
      await kvSet('folder', folderData);

      const scanResult = await scanDirectory(handle);

      // 1단계 하위 폴더들을 기본 펼침 처리
      const initialExpanded = new Set<string>();
      for (const item of scanResult.tree) {
        if (item.kind === 'directory') {
          initialExpanded.add(item.path);
        }
      }

      set({
        folder: folderData,
        handle,
        tree: scanResult.tree,
        truncated: scanResult.truncated,
        isLoading: false,
        expandedPaths: initialExpanded,
        activeTab: 'files',
      });
    } catch (err) {
      console.error('폴더 스캔 실패:', err);
      set({
        isLoading: false,
        error: '폴더를 불러오는 중 오류가 발생했습니다.',
      });
    }
  },

  async closeFolder() {
    await kvDelete('folder');
    set({
      folder: null,
      handle: null,
      tree: [],
      error: null,
      needPermission: false,
      truncated: false,
      expandedPaths: new Set(),
    });
  },

  async refresh() {
    const { handle } = get();
    if (!handle) return;
    try {
      set({ isLoading: true, error: null });
      const scanResult = await scanDirectory(handle);
      set((s) => ({
        tree: scanResult.tree,
        truncated: scanResult.truncated,
        isLoading: false,
        refreshCount: s.refreshCount + 1,
      }));
    } catch (err) {
      console.error('폴더 새로고침 실패:', err);
      set({
        isLoading: false,
        error: '폴더 새로고침 중 오류가 발생했습니다.',
      });
    }
  },

  async reconnect() {
    const { handle } = get();
    if (!handle) return;
    try {
      const perm = await requestFolderPermission(handle);
      if (perm === 'granted') {
        set({ needPermission: false });
        await get().refresh();
      } else {
        set({ error: '폴더 접근 권한이 필요합니다.' });
      }
    } catch (err) {
      console.error('폴더 재연결 실패:', err);
      set({ error: '폴더 권한 요청 중 오류가 발생했습니다.' });
    }
  },

  async init() {
    try {
      const saved = await kvGet<ConnectedFolderData>('folder');
      if (!saved?.handleId) return;

      const db = await getDb();
      const rawHandle = await db.get('handles', saved.handleId);
      if (!rawHandle || rawHandle.kind !== 'directory') {
        await kvDelete('folder');
        return;
      }

      const dirHandle = rawHandle as unknown as DirectoryHandleLike;
      const perm = await queryFolderPermission(dirHandle);

      if (perm === 'granted') {
        set({ folder: saved, handle: dirHandle, isLoading: true });
        const scanResult = await scanDirectory(dirHandle);
        const initialExpanded = new Set<string>();
        for (const item of scanResult.tree) {
          if (item.kind === 'directory') initialExpanded.add(item.path);
        }
        set({
          tree: scanResult.tree,
          truncated: scanResult.truncated,
          isLoading: false,
          expandedPaths: initialExpanded,
        });
      } else {
        // 권한 팝업을 절대 띄우지 않고 사용자 클릭을 기다림
        set({
          folder: saved,
          handle: dirHandle,
          needPermission: true,
          isLoading: false,
        });
      }
    } catch (err) {
      console.error('폴더 세션 복원 실패:', err);
    }
  },
}));
