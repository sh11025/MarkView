/**
 * 워크스페이스 불러오기와 자동 저장. 저장 경로는 이 파일 하나뿐이다.
 * - 문서: 변경 후 500ms 뒤, 그리고 탭이 숨겨지거나 닫힐 때 즉시 IndexedDB에 기록
 * - 실패하면 사라지지 않는 오류 알림을 띄운다 (조용히 실패하지 않음)
 */
import { getDb, kvGet, kvSet } from './db';
import { useDocuments, type Doc } from '../stores/documents';
import { useSettings, pickSettings, type Settings } from '../stores/settings';
import { useUi } from '../stores/ui';
import { WELCOME_DOC } from '../constants/welcome';
import { sanitizePositions, type DocumentPosition } from '../features/position/positions';
import { usePositions } from '../stores/positions';
import { cleanupOrphanAttachments } from './attachmentCleanup';
import { useSaveStatus } from '../features/storage/saveStatus';

interface Session {
  order: string[];
  activeId: string | null;
  viewMode?: 'preview' | 'split' | 'editor';
  tocOpen?: boolean;
  positions?: Record<string, DocumentPosition>;
}

export const THEME_MIRROR_KEY = 'markview-theme';

export async function loadWorkspace(): Promise<void> {
  const db = await getDb();
  const [docs, session, settings] = await Promise.all([
    db.getAll('documents'),
    kvGet<Session>('session'),
    kvGet<Partial<Settings>>('settings'),
  ]);

  if (settings && Object.keys(settings).length > 0) {
    useSettings.getState().hydrate(settings);
  }
  if (session?.viewMode) useUi.getState().setViewMode(session.viewMode);
  if (session?.tocOpen === false) useUi.setState({ tocOpen: false });

  usePositions.getState().hydrate(sanitizePositions(session?.positions));

  if (docs.length > 0) {
    useDocuments.getState().hydrate(docs, session?.order ?? [], session?.activeId ?? null);
  } else {
    useDocuments.getState().createDoc(WELCOME_DOC);
  }

  void navigator.storage?.persist?.();
  void cleanupOrphanAttachments();
}

export function startAutosave(): () => void {
  let timer: number | undefined;
  let pending = false;
  let lastDocs = useDocuments.getState().docs;
  const changed = new Set<string>();
  const removed = new Set<string>();

  const flush = async () => {
    window.clearTimeout(timer);
    if (!pending) return;
    pending = false;
    const { docs, order, activeId } = useDocuments.getState();
    const { viewMode, tocOpen } = useUi.getState();
    const positions = usePositions.getState().positions;
    const toWrite = [...changed].map((id) => docs[id]).filter((d): d is Doc => Boolean(d));
    const toDelete = [...removed];
    changed.clear();
    removed.clear();

    for (const id of toDelete) {
      usePositions.getState().remove(id);
    }

    try {
      const db = await getDb();
      const tx = db.transaction(['documents', 'kv'], 'readwrite');
      await Promise.all([
        ...toWrite.map((d) => tx.objectStore('documents').put(d)),
        ...toDelete.map((id) => tx.objectStore('documents').delete(id)),
        tx.objectStore('kv').put({ order, activeId, viewMode, tocOpen, positions } satisfies Session, 'session'),
        tx.done,
      ]);
      useSaveStatus.getState().setSaved(Date.now());
    } catch (err) {
      console.error(err);
      toWrite.forEach((d) => changed.add(d.id));
      useSaveStatus.getState().setError();
      const isQuota = (err as Error)?.name === 'QuotaExceededError';
      useUi.getState().pushToast({
        text: isQuota
          ? '브라우저 저장 공간이 가득 차 저장에 실패했습니다. 백업을 내려받고 필요 없는 이미지를 정리하세요.'
          : '브라우저 저장에 실패했습니다. 저장 공간을 확인하고, 중요한 문서는 파일로 저장하세요.',
        kind: 'error',
        sticky: true,
        action: {
          label: '백업 내려받기',
          run: () => {
            void (async () => {
              const { exportAllDataForBackupDirect, triggerBackupDownload } = await import('./backupStorage');
              const b = await exportAllDataForBackupDirect();
              await triggerBackupDownload(b);
            })();
          },
        },
      });
    }
  };

  const schedule = (markSaving = false) => {
    pending = true;
    if (markSaving) {
      useSaveStatus.getState().setSaving();
    }
    window.clearTimeout(timer);
    timer = window.setTimeout(flush, 500);
  };

  useSaveStatus.getState().setRetryHandler(async () => {
    for (const id of Object.keys(useDocuments.getState().docs)) {
      changed.add(id);
    }
    pending = true;
    useSaveStatus.getState().setSaving();
    await flush();
  });

  const unsubDocs = useDocuments.subscribe((state, prev) => {
    for (const [id, doc] of Object.entries(state.docs)) if (lastDocs[id] !== doc) changed.add(id);
    for (const id of Object.keys(lastDocs)) if (!state.docs[id]) removed.add(id);
    lastDocs = state.docs;
    if (changed.size || removed.size || state.order !== prev.order || state.activeId !== prev.activeId) {
      schedule(changed.size > 0);
    }
  });
  const unsubUi = useUi.subscribe((s, p) => {
    if (s.viewMode !== p.viewMode || s.tocOpen !== p.tocOpen) schedule();
  });
  const unsubPositions = usePositions.subscribe(() => {
    schedule();
  });
  const unsubSettings = useSettings.subscribe((s) => {
    void kvSet('settings', pickSettings(s));
    try {
      localStorage.setItem(THEME_MIRROR_KEY, s.theme);
    } catch {
      // 첫 화면 테마 힌트용일 뿐이라 무시
    }
  });

  // 처음 만든 환영 문서도 바로 기록
  for (const id of Object.keys(lastDocs)) changed.add(id);
  schedule();

  const onHide = () => {
    if (document.visibilityState === 'hidden') void flush();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flush);

  return () => {
    unsubDocs();
    unsubUi();
    unsubPositions();
    unsubSettings();
    useSaveStatus.getState().setRetryHandler(null);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', flush);
  };
}
