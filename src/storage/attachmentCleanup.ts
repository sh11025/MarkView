/**
 * 사용하지 않는 첨부 이미지 정리 모듈.
 * 어떤 문서에서도 참조되지 않고 보존 유예 기간(7일)이 지난 첨부 이미지를 IndexedDB에서 삭제한다.
 * React를 import하지 않으며, 앱 시작 시 1회 백그라운드로 안전하게 실행된다.
 */
import { getDb } from './db';
import { revokeAttachmentUrls } from './attachments';
import { useDocuments } from '../stores/documents';
import { findAttachmentIds } from '../render/markdown';

/**
 * 사용자가 Ctrl+Z(실행 취소)로 지운 이미지를 되살리거나 닫은 탭의 내용을 복구할 수 있도록
 * 어떤 문서에서도 참조하지 않는 첨부라도 최소 7일간은 보존한다.
 */
export const ORPHAN_GRACE_DAYS = 7;
export const ORPHAN_GRACE_MS = ORPHAN_GRACE_DAYS * 24 * 60 * 60 * 1000;

export interface AttachmentMeta {
  id: string;
  createdAt: number;
}

/**
 * 저장된 첨부 목록 중 참조가 없고 유예 기간(7일)을 초과한 삭제 대상 id 목록을 판별하는 순수 함수.
 * 경계 처리: 정확히 7일째인 경우(경과 시간 === 7일)는 아직 7일을 초과하지 않았으므로 삭제하지 않고 보존한다.
 */
export function findOrphanAttachmentIds(
  stored: AttachmentMeta[],
  referencedIds: Set<string>,
  now: number,
  graceDays = ORPHAN_GRACE_DAYS,
): string[] {
  if (stored.length === 0) return [];
  const graceMs = graceDays * 24 * 60 * 60 * 1000;
  const toDelete: string[] = [];

  for (const item of stored) {
    if (!referencedIds.has(item.id)) {
      // 7일보다 오래된 것만 삭제 (경과 시간 > 7일)
      if (now - item.createdAt > graceMs) {
        toDelete.push(item.id);
      }
    }
  }

  return toDelete;
}

/**
 * 앱 시작 후 1회 실행되어 어떤 문서에서도 쓰지 않는 오래된 첨부를 정리한다.
 * 실패하더라도 앱 동작에 영향을 주지 않고 console.error만 기록한다.
 */
export async function cleanupOrphanAttachments(): Promise<void> {
  try {
    const db = await getDb();
    const stored = await db.getAll('attachments');
    if (stored.length === 0) return;

    // 현재 열려있거나 저장된 모든 문서의 본문에서 참조 중인 첨부 id 수집
    const docs = useDocuments.getState().docs;
    const referencedIds = new Set<string>();
    for (const doc of Object.values(docs)) {
      if (doc?.content) {
        for (const id of findAttachmentIds(doc.content)) {
          referencedIds.add(id);
        }
      }
    }

    const orphanIds = findOrphanAttachmentIds(stored, referencedIds, Date.now());
    if (orphanIds.length === 0) return;

    const tx = db.transaction('attachments', 'readwrite');
    await Promise.all([
      ...orphanIds.map((id) => tx.store.delete(id)),
      tx.done,
    ]);

    // 메모리 URL 해제
    revokeAttachmentUrls(orphanIds);
  } catch (err) {
    console.error('쓰지 않는 첨부 이미지 정리 중 오류 발생:', err);
  }
}
