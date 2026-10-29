/**
 * @file 백업 복원 계획 수립 순수 로직 (React import 금지)
 * 기존 문서를 지우거나 덮어쓰지 않고, 새 ID를 발급하며 이름 충돌을 안전하게 해결합니다.
 */

import type { MarkViewBackup, RestorePlan, RestorePlanItemDoc, BackupAttachment } from './types';

export interface PlanRestoreParams {
  backup: MarkViewBackup;
  existingDocNames: readonly string[]; // 현재 열려 있거나 저장된 문서 이름들
  existingAttachmentIds: ReadonlySet<string>; // 현재 저장소에 있는 첨부 id들
  idGenerator?: () => string; // 새 문서 ID 생성기 (기본값 crypto.randomUUID)
}

/**
 * 기본 고유 ID 생성기
 */
function defaultIdGenerator(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'doc_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

/**
 * 중복되는 문서 이름에 "(복원)", "(복원 2)" 접미사를 부여합니다.
 */
export function resolveRestoredDocName(baseName: string, existingNames: Set<string>): string {
  if (!existingNames.has(baseName)) {
    existingNames.add(baseName);
    return baseName;
  }

  // 확장자 분리 (예: "회의록.md" -> namePart="회의록", ext=".md")
  const dotIndex = baseName.lastIndexOf('.');
  const hasExt = dotIndex > 0;
  const namePart = hasExt ? baseName.slice(0, dotIndex) : baseName;
  const ext = hasExt ? baseName.slice(dotIndex) : '';

  let candidate = `${namePart} (복원)${ext}`;
  let count = 2;
  while (existingNames.has(candidate)) {
    candidate = `${namePart} (복원 ${count})${ext}`;
    count++;
  }

  existingNames.add(candidate);
  return candidate;
}

/**
 * 백업 데이터를 바탕으로 복원 계획(추가할 새 문서 목록, 추가할 첨부 목록, 통계 요약)을 수립합니다.
 */
export function planRestore(params: PlanRestoreParams): RestorePlan {
  const {
    backup,
    existingDocNames,
    existingAttachmentIds,
    idGenerator = defaultIdGenerator,
  } = params;

  const usedNames = new Set<string>(existingDocNames);
  const docsToAdd: RestorePlanItemDoc[] = [];

  for (const doc of backup.documents) {
    const finalName = resolveRestoredDocName(doc.name, usedNames);
    docsToAdd.push({
      id: idGenerator(),
      name: finalName,
      content: doc.content,
      updatedAt: doc.updatedAt,
      savedAt: doc.savedAt ?? 0,
      folderPath: doc.folderPath,
      handleId: null,
    });
  }

  // 첨부 처리: 이미 저장소에 있는 것은 건너뜀
  const attachmentsToAdd: BackupAttachment[] = [];
  let skippedAttachmentCount = 0;

  for (const att of backup.attachments) {
    if (existingAttachmentIds.has(att.id)) {
      skippedAttachmentCount++;
    } else {
      attachmentsToAdd.push(att);
    }
  }

  return {
    docsToAdd,
    attachmentsToAdd,
    summary: {
      docCount: docsToAdd.length,
      attachmentCount: attachmentsToAdd.length,
      skippedAttachmentCount,
    },
  };
}
