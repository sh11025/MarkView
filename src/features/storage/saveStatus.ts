import { create } from 'zustand';

export type PersistencePhase = 'idle' | 'saving' | 'saved' | 'error';

export type SaveStatusKind =
  | 'ephemeral'
  | 'error'
  | 'saving'
  | 'unsaved-changes'
  | 'autosaved'
  | 'file-saved';

export interface SaveStatusInput {
  /** 임시(메모리) 모드 여부 */
  isEphemeral: boolean;
  /** 브라우저 자동 저장 진행 상태 */
  persistencePhase: PersistencePhase;
  /** 마지막 브라우저 자동 저장 시각 (ms) */
  lastAutosavedAt: number | null;
  /** 현재 문서가 로컬 파일 핸들과 연결되어 있는지 여부 */
  hasFileHandle: boolean;
  /** 현재 문서에 파일로 저장되지 않은 변경 사항이 있는지 여부 (updatedAt > savedAt) */
  isDocDirty: boolean;
}

export interface SaveStatusDisplay {
  kind: SaveStatusKind;
  /** 데스크톱 기본 표시 문구 */
  label: string;
  /** 모바일 좁은 폭용 축약 문구 */
  shortLabel: string;
  /** 마우스 호버 시 상세 설명 */
  title: string;
  /** 클릭 시 재시도 동작이 필요한지 여부 */
  canRetry: boolean;
}

/**
 * 시각(ms 또는 Date)을 "HH:MM" (24시간제) 문자열로 포맷한다.
 */
export function formatSaveTime(timestamp: number | Date): string {
  const d = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * 현재 저장소 및 문서 상태를 바탕으로 표시할 저장 상태 문구를 결정하는 순수 함수.
 */
export function resolveSaveStatus(input: SaveStatusInput): SaveStatusDisplay {
  if (input.isEphemeral) {
    return {
      kind: 'ephemeral',
      label: '이 컴퓨터에 저장되지 않는 임시 모드',
      shortLabel: '임시 모드',
      title: '브라우저 저장소가 비활성화되어 탭을 닫으면 내용이 사라집니다. 파일로 저장하거나 백업을 받으세요.',
      canRetry: false,
    };
  }

  if (input.persistencePhase === 'error') {
    return {
      kind: 'error',
      label: '저장 실패 — 다시 시도',
      shortLabel: '저장 실패',
      title: '브라우저 자동 저장에 실패했습니다. 눌러서 다시 시도하거나 백업을 내려받으세요.',
      canRetry: true,
    };
  }

  if (input.persistencePhase === 'saving') {
    return {
      kind: 'saving',
      label: '저장 중…',
      shortLabel: '저장 중…',
      title: '변경 사항을 브라우저에 자동 저장하고 있습니다.',
      canRetry: false,
    };
  }

  // 파일 핸들에 저장했거나 변경 사항이 없는 상태
  if (!input.isDocDirty) {
    return {
      kind: 'file-saved',
      label: '파일로 저장됨',
      shortLabel: '파일로 저장됨',
      title: '모든 변경 사항이 저장되어 있습니다.',
      canRetry: false,
    };
  }

  // 파일 핸들이 연결된 문서인데 아직 파일에 저장하지 않은 변경이 있는 경우
  if (input.hasFileHandle) {
    const timeSuffix = input.lastAutosavedAt ? ` (브라우저 자동 저장됨 ${formatSaveTime(input.lastAutosavedAt)})` : '';
    return {
      kind: 'unsaved-changes',
      label: '저장 안 된 변경 있음',
      shortLabel: '변경 있음',
      title: `연결된 파일에 아직 저장되지 않은 변경 사항이 있습니다.${timeSuffix} Ctrl+S로 파일에 저장하세요.`,
      canRetry: false,
    };
  }

  // 일반 탭 문서가 편집되어 브라우저에 자동 저장된 상태
  if (input.lastAutosavedAt !== null) {
    const timeStr = formatSaveTime(input.lastAutosavedAt);
    return {
      kind: 'autosaved',
      label: `자동 저장됨 ${timeStr}`,
      shortLabel: `자동 저장됨 ${timeStr}`,
      title: `브라우저에 ${timeStr}에 자동 저장되었습니다.`,
      canRetry: false,
    };
  }

  return {
    kind: 'unsaved-changes',
    label: '저장 안 된 변경 있음',
    shortLabel: '변경 있음',
    title: '저장되지 않은 변경 사항이 있습니다.',
    canRetry: false,
  };
}

interface SaveStatusStore {
  phase: PersistencePhase;
  lastAutosavedAt: number | null;
  retryHandler: (() => Promise<void>) | null;
  setSaving: () => void;
  setSaved: (at?: number) => void;
  setError: () => void;
  setIdle: () => void;
  setRetryHandler: (fn: (() => Promise<void>) | null) => void;
}

export const useSaveStatus = create<SaveStatusStore>((set) => ({
  phase: 'idle',
  lastAutosavedAt: null,
  retryHandler: null,
  setSaving: () => set({ phase: 'saving' }),
  setSaved: (at = Date.now()) => set({ phase: 'saved', lastAutosavedAt: at }),
  setError: () => set({ phase: 'error' }),
  setIdle: () => set({ phase: 'idle' }),
  setRetryHandler: (fn) => set({ retryHandler: fn }),
}));
