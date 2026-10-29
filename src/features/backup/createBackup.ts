/**
 * @file MarkView 전체 백업 객체 생성 순수 함수 (React import 금지)
 */

import type { MarkViewBackup, BackupDocument, BackupAttachment } from './types';
import { findAttachmentIds } from './findAttachmentIds';

export interface CreateBackupParams {
  documents: Array<{
    name: string;
    content: string;
    updatedAt: number;
    savedAt?: number;
    folderPath?: string;
    handleId?: unknown; // 제외 대상
  }>;
  settings?: Record<string, unknown>;
  attachments?: BackupAttachment[];
  order?: string[];
  appVersion?: string;
  now?: string; // 테스트를 위한 시각 주입
}

/**
 * 앱의 문서, 첨부, 설정 데이터를 바탕으로 표준 MarkView 백업 객체를 생성합니다.
 * 파일 핸들(handleId)은 제외하며, 문서가 실제로 참조하는 첨부파일만 선별하여 크기를 최적화합니다.
 */
export function createBackupData(params: CreateBackupParams): MarkViewBackup {
  const {
    documents,
    settings = {},
    attachments = [],
    order = [],
    appVersion = '0.1.0',
    now = new Date().toISOString(),
  } = params;

  // 1. 참조되는 첨부 id 집합 추출
  const docContents = documents.map((d) => d.content);
  const referencedAttachmentIds = findAttachmentIds(docContents);

  // 2. 문서 정제 (handleId 등 런타임 전용 속성 제외)
  const cleanDocs: BackupDocument[] = documents.map((d) => ({
    name: d.name,
    content: d.content,
    updatedAt: d.updatedAt,
    ...(d.savedAt !== undefined ? { savedAt: d.savedAt } : {}),
    ...(d.folderPath ? { folderPath: d.folderPath } : {}),
  }));

  // 3. 참조되는 첨부만 보존
  const cleanAttachments: BackupAttachment[] = attachments.filter((att) =>
    referencedAttachmentIds.has(att.id),
  );

  return {
    format: 'markview-backup',
    version: 1,
    createdAt: now,
    app: {
      version: appVersion,
    },
    documents: cleanDocs,
    settings,
    attachments: cleanAttachments,
    order,
  };
}

/**
 * 백업 파일명을 생성합니다 (예: MarkView-백업-20261028-1430.json)
 */
export function generateBackupFileName(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `MarkView-백업-${yyyy}${mm}${dd}-${hh}${min}.json`;
}
