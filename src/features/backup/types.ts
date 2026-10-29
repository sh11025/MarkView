/**
 * @file MarkView 전체 백업 데이터 구조 및 타입 정의
 */

export interface BackupDocument {
  name: string;
  content: string;
  updatedAt: number;
  savedAt?: number;
  folderPath?: string;
}

export interface BackupAttachment {
  id: string;
  name: string;
  mime: string;
  base64: string;
}

export interface MarkViewBackup {
  format: 'markview-backup';
  version: 1;
  createdAt: string; // ISO 8601
  app: {
    version: string;
  };
  documents: BackupDocument[];
  settings: Record<string, unknown>;
  attachments: BackupAttachment[];
  order: string[];
}

export interface RestoreSummary {
  docCount: number;
  attachmentCount: number;
  skippedAttachmentCount: number;
}

export interface RestorePlanItemDoc {
  id: string; // 새로 부여된 고유 id
  name: string; // 이름 충돌 시 "이름 (복원).md"
  content: string;
  updatedAt: number;
  savedAt: number;
  folderPath?: string;
  handleId: null;
}

export interface RestorePlan {
  docsToAdd: RestorePlanItemDoc[];
  attachmentsToAdd: BackupAttachment[];
  summary: RestoreSummary;
}

export interface RestoreExecutionResult {
  docsSuccess: number;
  docsFailed: number;
  attachmentsSuccess: number;
  attachmentsFailed: number;
  isStorageUnavailable?: boolean;
}
