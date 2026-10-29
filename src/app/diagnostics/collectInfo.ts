/**
 * @file 브라우저 런타임 및 앱 상태에서 진단 정보를 수집하는 함수
 * 문서 내용이나 개인 파일 이름은 일절 가져오지 않으며 오직 통계 숫자만 수집합니다.
 */

import type { DiagnosticsData } from '../../features/diagnostics/report';
import { getRecentErrors } from '../../features/diagnostics/errorCollector';
import { getLastBackupTime } from '../../storage/backupStorage';
import { useDocuments } from '../../stores/documents';
import { useFolder } from '../../stores/folder';
import { useSettings } from '../../stores/settings';
import { useUi } from '../../stores/ui';
import { getDb, type StoredAttachment } from '../../storage/db';

export async function collectDiagnosticsData(): Promise<DiagnosticsData> {
  // 1. 실행 모드 판별
  let mode: 'web' | 'standalone' | 'file' = 'web';
  if (typeof window !== 'undefined') {
    if (window.location.protocol === 'file:') {
      mode = 'file';
    } else if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    ) {
      mode = 'standalone';
    }
  }

  // 2. 저장소 상태 (StorageManager)
  let usageMB: number | undefined;
  let quotaMB: number | undefined;
  let persisted: boolean | undefined;

  if (typeof navigator !== 'undefined' && navigator.storage) {
    try {
      if (typeof navigator.storage.estimate === 'function') {
        const est = await navigator.storage.estimate();
        if (typeof est.usage === 'number') usageMB = est.usage / (1024 * 1024);
        if (typeof est.quota === 'number') quotaMB = est.quota / (1024 * 1024);
      }
      if (typeof navigator.storage.persisted === 'function') {
        persisted = await navigator.storage.persisted();
      }
    } catch {
      // 권한 등의 문제로 조회 실패 시 무시
    }
  }

  // 3. 문서 및 첨부 통계 (내용/이름 제외, 오직 개수 및 합계 숫자만)
  let documentCount = 0;
  let totalCharCount = 0;
  let connectedFileCount = 0;

  try {
    const docs = Object.values(useDocuments.getState().docs);
    documentCount = docs.length;
    for (const d of docs) {
      if (d.content) {
        totalCharCount += d.content.length;
      }
      if (d.handleId) {
        connectedFileCount++;
      }
    }
  } catch {
    // 스토어 조회 실패 시 기본값
  }

  let attachmentCount = 0;
  let attachmentTotalBytes = 0;
  try {
    const db = await getDb();
    const attachments: StoredAttachment[] = await db.getAll('attachments');
    attachmentCount = attachments.length;
    for (const att of attachments) {
      if (att.blob && typeof att.blob.size === 'number') {
        attachmentTotalBytes += att.blob.size;
      }
    }
  } catch {
    // 첨부 조회 실패 시 기본값
  }

  // 4. 폴더, 설정, 뷰 상태
  let hasFolderConnected = false;
  try {
    hasFolderConnected = Boolean(useFolder.getState().handle);
  } catch {
    // 무시
  }

  let themeSetting = 'system';
  try {
    themeSetting = useSettings.getState().theme;
  } catch {
    // 무시
  }

  const actualTheme =
    typeof document !== 'undefined' ? document.documentElement.dataset.theme || 'light' : 'light';

  let viewMode = 'split';
  try {
    viewMode = useUi.getState().viewMode;
  } catch {
    // 무시
  }

  // 5. 최근 백업 시각
  const lastBackupTime = await getLastBackupTime();

  // 6. 브라우저 API 지원 여부
  const hasWindow = typeof window !== 'undefined';
  const capabilities = {
    hasOpenFilePicker: hasWindow && typeof (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker === 'function',
    hasSaveFilePicker: hasWindow && typeof (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function',
    hasDirectoryPicker: hasWindow && typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function',
    indexedDB: hasWindow && typeof window.indexedDB !== 'undefined',
    serviceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    clipboard: typeof navigator !== 'undefined' && Boolean(navigator.clipboard && navigator.clipboard.writeText),
  };

  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0';
  const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '개발 버전';

  return {
    app: {
      name: 'MarkView',
      version: appVersion,
      buildTime,
    },
    runtime: {
      mode,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      screen: {
        width: hasWindow ? window.innerWidth : 0,
        height: hasWindow ? window.innerHeight : 0,
        dpr: hasWindow ? window.devicePixelRatio || 1 : 1,
      },
      themeSetting,
      actualTheme,
    },
    capabilities,
    storage: {
      usageMB,
      quotaMB,
      persisted,
    },
    documentStats: {
      documentCount,
      totalCharCount,
      attachmentCount,
      attachmentTotalBytes,
      connectedFileCount,
      hasFolderConnected,
    },
    viewMode,
    recentErrors: getRecentErrors(),
    lastBackupTime,
  };
}
