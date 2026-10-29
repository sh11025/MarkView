import { create } from 'zustand';
import type { TocItem } from '../render/markdown';
import type { RestorePlan } from '../features/backup/types';

export type ViewMode = 'preview' | 'split' | 'editor';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'success' | 'error';
  /** true면 사용자가 닫을 때까지 유지 */
  sticky?: boolean;
  action?: ToastAction;
  actions?: ToastAction[];
}

export interface PendingAnchor {
  docId: string;
  id: string;
}

export interface MermaidEditorTarget {
  docId: string;
  startLine: number;
  endLine: number;
  originalLines: string[];
  initialCode: string;
}

interface UiState {
  viewMode: ViewMode;
  tocOpen: boolean;
  toc: TocItem[];
  activeHeadingId: string | null;
  toasts: Toast[];
  templateGalleryOpen: boolean;
  mathGalleryOpen: boolean;
  diagramGalleryOpen: boolean;
  diagnosticsOpen: boolean;
  restorePlan: RestorePlan | null;
  pendingAnchor: PendingAnchor | null;
  mermaidEditorTarget: MermaidEditorTarget | null;
  /** 임시(메모리) 모드 여부 */
  isEphemeral: boolean;
  /** 문서 탭별 접힌 목차 제목 ID 목록 */
  collapsedTocByDoc: Record<string, string[]>;
  /** 미리보기 문서 내 검색 막대 열림 여부 */
  previewSearchOpen: boolean;
  /** 미리보기 검색 입력창 포커스 트리거 카운터 */
  previewSearchFocusTick: number;

  setViewMode(mode: ViewMode): void;
  toggleToc(): void;
  setToc(toc: TocItem[]): void;
  setActiveHeading(id: string | null): void;
  pushToast(toast: Omit<Toast, 'id'>): void;
  dismissToast(id: number): void;
  openTemplateGallery(): void;
  closeTemplateGallery(): void;
  openMathGallery(): void;
  closeMathGallery(): void;
  openDiagramGallery(): void;
  closeDiagramGallery(): void;
  openDiagnostics(): void;
  closeDiagnostics(): void;
  openRestoreModal(plan: RestorePlan): void;
  closeRestoreModal(): void;
  setPendingAnchor(anchor: PendingAnchor | null): void;
  openMermaidEditor(target: MermaidEditorTarget): void;
  closeMermaidEditor(): void;
  setEphemeral(isEphemeral: boolean): void;
  toggleTocCollapse(docId: string, headingId: string): void;
  openPreviewSearch(): void;
  closePreviewSearch(): void;
}

let toastSeq = 0;

export const useUi = create<UiState>((set, get) => ({
  viewMode: 'split',
  tocOpen: true,
  toc: [],
  activeHeadingId: null,
  toasts: [],
  templateGalleryOpen: false,
  mathGalleryOpen: false,
  diagramGalleryOpen: false,
  diagnosticsOpen: false,
  restorePlan: null,
  pendingAnchor: null,
  mermaidEditorTarget: null,
  isEphemeral: false,
  collapsedTocByDoc: {},
  previewSearchOpen: false,
  previewSearchFocusTick: 0,

  setViewMode: (viewMode) => set({ viewMode }),
  toggleToc: () => set((s) => ({ tocOpen: !s.tocOpen })),
  setToc: (toc) => set({ toc }),
  setActiveHeading: (activeHeadingId) => {
    if (get().activeHeadingId !== activeHeadingId) set({ activeHeadingId });
  },
  openTemplateGallery: () => set({ templateGalleryOpen: true }),
  closeTemplateGallery: () => set({ templateGalleryOpen: false }),
  openMathGallery: () => set({ mathGalleryOpen: true }),
  closeMathGallery: () => set({ mathGalleryOpen: false }),
  openDiagramGallery: () => set({ diagramGalleryOpen: true }),
  closeDiagramGallery: () => set({ diagramGalleryOpen: false }),
  openDiagnostics: () => set({ diagnosticsOpen: true }),
  closeDiagnostics: () => set({ diagnosticsOpen: false }),
  openRestoreModal: (restorePlan) => set({ restorePlan }),
  closeRestoreModal: () => set({ restorePlan: null }),
  setPendingAnchor: (pendingAnchor) => set({ pendingAnchor }),
  openMermaidEditor: (target) => set({ mermaidEditorTarget: target }),
  closeMermaidEditor: () => set({ mermaidEditorTarget: null }),
  setEphemeral: (isEphemeral) => set({ isEphemeral }),
  toggleTocCollapse: (docId, headingId) =>
    set((s) => {
      const current = s.collapsedTocByDoc[docId] ?? [];
      const exists = current.includes(headingId);
      const next = exists ? current.filter((id) => id !== headingId) : [...current, headingId];
      return {
        collapsedTocByDoc: {
          ...s.collapsedTocByDoc,
          [docId]: next,
        },
      };
    }),
  openPreviewSearch: () =>
    set((s) => ({
      previewSearchOpen: true,
      previewSearchFocusTick: s.previewSearchFocusTick + 1,
    })),
  closePreviewSearch: () => set({ previewSearchOpen: false }),
  pushToast: (toast) => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts.filter((t) => t.text !== toast.text), { ...toast, id }] }));
    if (!toast.sticky) setTimeout(() => get().dismissToast(id), 3000);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (text: string, kind: Toast['kind'] = 'info') => useUi.getState().pushToast({ text, kind });
