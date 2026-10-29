/**
 * @file 백업 파일 JSON 검증 순수 로직 (React import 금지)
 */

import type { MarkViewBackup, BackupDocument, BackupAttachment } from './types';

export const MAX_BACKUP_DOCUMENTS = 5000;
export const MAX_BACKUP_FILE_BYTES = 300 * 1024 * 1024; // 300MB

export type ValidationResult =
  | { ok: true; data: MarkViewBackup }
  | { ok: false; error: string; code: 'INVALID_JSON' | 'INVALID_FORMAT' | 'UNSUPPORTED_VERSION' | 'INVALID_FIELDS' | 'SIZE_LIMIT_EXCEEDED' };

/**
 * 전달받은 백업 JSON 문자열 또는 객체의 유효성을 철저히 검증합니다.
 */
export function validateBackupJson(jsonInput: string, byteSize?: number): ValidationResult {
  // 1. 파일 크기 검증
  if (byteSize !== undefined && byteSize > MAX_BACKUP_FILE_BYTES) {
    return {
      ok: false,
      code: 'SIZE_LIMIT_EXCEEDED',
      error: '파일 크기가 허용 상한(300MB)을 초과했습니다.',
    };
  }

  // 2. JSON 파싱
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonInput);
  } catch {
    return {
      ok: false,
      code: 'INVALID_JSON',
      error: '백업 파일을 읽을 수 없습니다. 다른 파일을 선택해 주세요.',
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      code: 'INVALID_FORMAT',
      error: 'MarkView 백업 파일이 아닙니다.',
    };
  }

  const obj = parsed as Record<string, unknown>;

  // 3. format 확인
  if (obj.format !== 'markview-backup') {
    return {
      ok: false,
      code: 'INVALID_FORMAT',
      error: 'MarkView 백업 파일이 아닙니다.',
    };
  }

  // 4. version 확인
  if (typeof obj.version !== 'number') {
    return {
      ok: false,
      code: 'INVALID_FIELDS',
      error: '백업 파일의 버전 정보가 올바르지 않습니다.',
    };
  }

  if (obj.version > 1) {
    return {
      ok: false,
      code: 'UNSUPPORTED_VERSION',
      error: '더 새로운 버전에서 만든 백업입니다. 최신 버전의 MarkView를 사용해 주세요.',
    };
  }

  // 5. documents 배열 검증
  if (!Array.isArray(obj.documents)) {
    return {
      ok: false,
      code: 'INVALID_FIELDS',
      error: '문서 목록이 올바르지 않습니다.',
    };
  }

  if (obj.documents.length > MAX_BACKUP_DOCUMENTS) {
    return {
      ok: false,
      code: 'SIZE_LIMIT_EXCEEDED',
      error: `문서 개수가 허용 상한(${MAX_BACKUP_DOCUMENTS.toLocaleString()}개)을 초과했습니다.`,
    };
  }

  const validatedDocs: BackupDocument[] = [];
  for (let i = 0; i < obj.documents.length; i++) {
    const doc = obj.documents[i];
    if (!doc || typeof doc !== 'object') {
      return {
        ok: false,
        code: 'INVALID_FIELDS',
        error: `문서 #${i + 1}의 데이터 형식이 올바르지 않습니다.`,
      };
    }
    const d = doc as Record<string, unknown>;
    if (typeof d.name !== 'string' || typeof d.content !== 'string') {
      return {
        ok: false,
        code: 'INVALID_FIELDS',
        error: `문서 #${i + 1}의 제목 또는 내용 형식이 올바르지 않습니다.`,
      };
    }
    validatedDocs.push({
      name: d.name,
      content: d.content,
      updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : Date.now(),
      savedAt: typeof d.savedAt === 'number' ? d.savedAt : undefined,
      folderPath: typeof d.folderPath === 'string' ? d.folderPath : undefined,
    });
  }

  // 6. attachments 검증
  const validatedAttachments: BackupAttachment[] = [];
  if (obj.attachments !== undefined) {
    if (!Array.isArray(obj.attachments)) {
      return {
        ok: false,
        code: 'INVALID_FIELDS',
        error: '첨부파일 목록 형식이 올바르지 않습니다.',
      };
    }
    for (const att of obj.attachments) {
      if (
        att &&
        typeof att === 'object' &&
        typeof (att as Record<string, unknown>).id === 'string' &&
        typeof (att as Record<string, unknown>).name === 'string' &&
        typeof (att as Record<string, unknown>).mime === 'string' &&
        typeof (att as Record<string, unknown>).base64 === 'string'
      ) {
        validatedAttachments.push(att as BackupAttachment);
      }
    }
  }

  const validBackup: MarkViewBackup = {
    format: 'markview-backup',
    version: 1,
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : new Date().toISOString(),
    app: {
      version: typeof (obj.app as Record<string, unknown>)?.version === 'string'
        ? (obj.app as { version: string }).version
        : '0.1.0',
    },
    documents: validatedDocs,
    settings: (obj.settings && typeof obj.settings === 'object' && !Array.isArray(obj.settings))
      ? (obj.settings as Record<string, unknown>)
      : {},
    attachments: validatedAttachments,
    order: Array.isArray(obj.order) ? (obj.order as string[]) : [],
  };

  return { ok: true, data: validBackup };
}
