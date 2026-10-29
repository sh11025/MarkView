/**
 * @file IndexedDB 기반 전체 백업 추출 및 복원 실행 스토리지 계층
 * Zustand 스토어에 의존하지 않는 독립 경로를 제공하여 오류 화면에서도 직접 실행 가능합니다.
 */

import { getDb, type StoredDoc, type StoredAttachment, type MarkviewDB } from './db';
import type { IDBPDatabase } from 'idb';
import {
  createBackupData,
  generateBackupFileName,
  calculateMissingAttachmentCount,
  type MarkViewBackup,
  type BackupAttachment,
  type RestorePlan,
  type RestoreExecutionResult,
} from '../features/backup';

export const KV_KEY_LAST_BACKUP = 'last_backup_time';

/**
 * Blob을 base64 문자열로 비동기 변환합니다.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // data:image/png;base64,AAAA... 에서 base64 부분만 추출
      const commaIdx = dataUrl.indexOf(',');
      resolve(commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * base64 문자열을 Blob 객체로 변환합니다.
 */
export function base64ToBlob(base64: string, mime: string): Blob {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * (a) 오류 화면용 독립 백업 소스 읽기 함수
 * Zustand 스토어(useDocuments, useSettings)를 일절 import하지 않고
 * IndexedDB에서만 문서, 설정, 첨부파일을 직접 읽습니다.
 */
export async function readBackupSourceFromDatabase(
  dbGetter: () => Promise<IDBPDatabase<MarkviewDB>> = getDb,
): Promise<MarkViewBackup> {
  const db = await dbGetter();

  // 1. 문서 목록 직접 조회
  const docs: StoredDoc[] = await db.getAll('documents');

  // 2. 탭 순서 및 설정 직접 조회 (실제 앱 저장 키 'session'의 order 우선, 레거시 'tab_order' 호환)
  const session = (await db.get('kv', 'session')) as { order?: string[] } | undefined;
  const legacyTabOrder = (await db.get('kv', 'tab_order')) as string[] | undefined;
  const order = (session?.order && session.order.length > 0) ? session.order : (legacyTabOrder || docs.map((d) => d.id));
  const settings = ((await db.get('kv', 'settings')) as Record<string, unknown>) || {};

  // 3. 첨부파일 직접 조회 및 base64 변환
  const storedAttachments: StoredAttachment[] = await db.getAll('attachments');
  const backupAttachments: BackupAttachment[] = [];

  for (const att of storedAttachments) {
    try {
      const base64 = await blobToBase64(att.blob);
      backupAttachments.push({
        id: att.id,
        name: att.name,
        mime: att.blob?.type || 'application/octet-stream',
        base64,
      });
    } catch (err) {
      console.warn(`첨부파일(${att.id}) base64 변환 실패, 백업 제외:`, err);
    }
  }

  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0';
  return createBackupData({
    documents: docs,
    settings,
    attachments: backupAttachments,
    order,
    appVersion,
  });
}

/**
 * (b) 정상 앱 화면용 백업 소스 읽기 함수
 * 아직 디스크에 flush되지 않은 최근 편집분을 반영하기 위해 앱 상태(documents 스토어)를 우선 사용합니다.
 * IndexedDB 접근이 실패(임시 모드)하더라도 문서는 백업하며, 읽지 못한 참조 이미지 수를 계산하여 함께 반환합니다.
 */
export async function readBackupSourceFromStores(
  dbGetter: () => Promise<IDBPDatabase<MarkviewDB>> = getDb,
): Promise<{ backup: MarkViewBackup; missingAttachmentCount: number }> {
  // 1. 앱 스토어에서 문서와 탭 순서 가져오기
  const { useDocuments } = await import('../stores/documents');
  const docs = Object.values(useDocuments.getState().docs);
  const order = useDocuments.getState().order;

  // 2. 앱 스토어에서 설정 가져오기
  const { useSettings, pickSettings } = await import('../stores/settings');
  const settings: Record<string, unknown> = { ...pickSettings(useSettings.getState()) };

  // 3. 첨부파일 읽기 (IndexedDB 접근 실패 시에도 문서 백업은 중단되지 않음)
  const backupAttachments: BackupAttachment[] = [];
  const loadedAttachmentIds = new Set<string>();

  try {
    const db = await dbGetter();
    const storedAttachments: StoredAttachment[] = await db.getAll('attachments');
    for (const att of storedAttachments) {
      try {
        const base64 = await blobToBase64(att.blob);
        backupAttachments.push({
          id: att.id,
          name: att.name,
          mime: att.blob?.type || 'application/octet-stream',
          base64,
        });
        loadedAttachmentIds.add(att.id);
      } catch (err) {
        console.warn(`첨부파일(${att.id}) base64 변환 실패:`, err);
      }
    }
  } catch (err) {
    console.warn('저장소에서 첨부파일을 읽을 수 없음 (임시 모드 등):', err);
  }

  // 4. 본문에서 참조 중이지만 읽지 못한 첨부 개수 계산
  const missingAttachmentCount = calculateMissingAttachmentCount(
    docs.map((d) => d.content),
    loadedAttachmentIds,
  );

  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0';
  const backup = createBackupData({
    documents: docs,
    settings,
    attachments: backupAttachments,
    order,
    appVersion,
  });

  return { backup, missingAttachmentCount };
}

/**
 * 하위 호환용 래퍼: 정상 앱 경로에서 백업 객체 반환
 */
export async function exportAllDataForBackupDirect(): Promise<MarkViewBackup> {
  const { backup } = await readBackupSourceFromStores();
  return backup;
}

/**
 * 마지막 백업 일시를 kv 스토어에 기록합니다.
 */
export async function saveLastBackupTime(isoString: string): Promise<void> {
  try {
    const db = await getDb();
    await db.put('kv', isoString, KV_KEY_LAST_BACKUP);
  } catch (err) {
    console.warn('마지막 백업 시각 기록 실패:', err);
  }
}

/**
 * 마지막 백업 일시를 kv 스토어에서 조회합니다.
 */
export async function getLastBackupTime(): Promise<string | null> {
  try {
    const db = await getDb();
    const val = await db.get('kv', KV_KEY_LAST_BACKUP);
    return typeof val === 'string' ? val : null;
  } catch {
    return null;
  }
}

/**
 * 백업 객체를 JSON 파일로 다운로드합니다.
 * 용량이 200MB 이상일 것으로 예상되면 사용자에게 진행 여부를 확인합니다.
 */
export async function triggerBackupDownload(backup: MarkViewBackup): Promise<boolean> {
  const jsonString = JSON.stringify(backup, null, 2);
  const byteSize = new Blob([jsonString]).size;

  // 200MB 초과 예상 시 확인
  if (byteSize > 200 * 1024 * 1024) {
    const mb = (byteSize / (1024 * 1024)).toFixed(1);
    if (!window.confirm(`백업 파일 크기가 큽니다 (${mb}MB). 계속 다운로드하시겠습니까?`)) {
      return false;
    }
  }

  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const fileName = generateBackupFileName(new Date(backup.createdAt));

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  await saveLastBackupTime(backup.createdAt);
  return true;
}

/**
 * 복원 계획(RestorePlan)을 IndexedDB에 반영합니다.
 * 첨부파일과 새 문서를 저장하며, 기존 문서를 절대 덮어쓰지 않습니다.
 * IndexedDB 접근 실패 시 isStorageUnavailable: true를 반환하여 임시 모드 복원을 지원합니다.
 */
export async function executeRestorePlanToDb(
  plan: RestorePlan,
  dbGetter: () => Promise<IDBPDatabase<MarkviewDB>> = getDb,
): Promise<RestoreExecutionResult> {
  let db: IDBPDatabase<MarkviewDB> | null = null;
  try {
    db = await dbGetter();
  } catch (err) {
    console.warn('저장소(IndexedDB)를 열 수 없어 DB 저장을 건너뜁니다 (임시 모드):', err);
    return {
      docsSuccess: 0,
      docsFailed: plan.docsToAdd.length,
      attachmentsSuccess: 0,
      attachmentsFailed: plan.attachmentsToAdd.length,
      isStorageUnavailable: true,
    };
  }

  let attachmentsSuccess = 0;
  let attachmentsFailed = 0;
  let docsSuccess = 0;
  let docsFailed = 0;

  // 1. 첨부파일 저장
  for (const att of plan.attachmentsToAdd) {
    try {
      const blob = base64ToBlob(att.base64, att.mime);
      const storedAtt: StoredAttachment = {
        id: att.id,
        name: att.name,
        blob,
        createdAt: Date.now(),
      };
      await db.put('attachments', storedAtt);
      attachmentsSuccess++;
    } catch (err) {
      console.warn(`첨부(${att.id}) 복원 저장 실패:`, err);
      attachmentsFailed++;
    }
  }

  // 2. 문서 저장
  for (const doc of plan.docsToAdd) {
    try {
      const storedDoc: StoredDoc = {
        id: doc.id,
        name: doc.name,
        content: doc.content,
        updatedAt: doc.updatedAt,
        savedAt: doc.savedAt ?? 0,
        handleId: null, // 복원된 문서는 핸들 연결 없음
        folderPath: doc.folderPath,
      };
      await db.put('documents', storedDoc);
      docsSuccess++;
    } catch (err) {
      console.error(`문서(${doc.name}) 복원 저장 실패:`, err);
      docsFailed++;
    }
  }

  return {
    docsSuccess,
    docsFailed,
    attachmentsSuccess,
    attachmentsFailed,
    isStorageUnavailable: false,
  };
}
