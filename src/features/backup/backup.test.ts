import { describe, it, expect } from 'vitest';
import {
  createBackupData,
  validateBackupJson,
  planRestore,
  calculateMissingAttachmentCount,
  MAX_BACKUP_DOCUMENTS,
  MAX_BACKUP_FILE_BYTES,
} from './index';

describe('backup (전체 백업 및 복원 순수 로직)', () => {
  it('문서와 참조 첨부파일을 포함한 정상 백업 객체를 생성한다', () => {
    const backup = createBackupData({
      documents: [
        {
          name: '문서1.md',
          content: '# 본문 1\n![그림](attachment:img_123)',
          updatedAt: 1000,
          handleId: 'h_1', // 제외되어야 함
        },
        {
          name: '문서2.md',
          content: '참조 없는 문서',
          updatedAt: 2000,
        },
      ],
      settings: { theme: 'dark' },
      attachments: [
        { id: 'img_123', name: 'image.png', mime: 'image/png', base64: 'AAAA' },
        { id: 'img_orphan', name: 'unused.png', mime: 'image/png', base64: 'BBBB' }, // 미참조 첨부
      ],
      order: ['doc1', 'doc2'],
      appVersion: '0.1.0',
      now: '2026-10-28T00:00:00.000Z',
    });

    expect(backup.format).toBe('markview-backup');
    expect(backup.version).toBe(1);
    expect(backup.createdAt).toBe('2026-10-28T00:00:00.000Z');
    expect(backup.documents).toHaveLength(2);
    expect(backup.documents[0]).not.toHaveProperty('handleId');

    // 실제로 참조된 img_123만 보존되고 미참조 img_orphan은 제외되어야 함
    expect(backup.attachments).toHaveLength(1);
    expect(backup.attachments[0].id).toBe('img_123');
  });

  describe('validateBackupJson (검증)', () => {
    it('정상적인 JSON 백업을 성공적으로 검증한다', () => {
      const json = JSON.stringify({
        format: 'markview-backup',
        version: 1,
        createdAt: '2026-10-28T00:00:00.000Z',
        app: { version: '0.1.0' },
        documents: [{ name: '안내.md', content: '내용', updatedAt: 12345 }],
      });

      const res = validateBackupJson(json);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.documents[0].name).toBe('안내.md');
      }
    });

    it('깨진 JSON 문자열인 경우 한국어 오류를 반환한다', () => {
      const res = validateBackupJson('{ format: "markview-backup", 깨짐..');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('INVALID_JSON');
        expect(res.error).toBe('백업 파일을 읽을 수 없습니다. 다른 파일을 선택해 주세요.');
      }
    });

    it('format이 다른 경우 오류를 반환한다', () => {
      const json = JSON.stringify({ format: 'other-app', version: 1, documents: [] });
      const res = validateBackupJson(json);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('INVALID_FORMAT');
        expect(res.error).toBe('MarkView 백업 파일이 아닙니다.');
      }
    });

    it('미래 버전인 경우 버전 안내 오류를 반환한다', () => {
      const json = JSON.stringify({ format: 'markview-backup', version: 99, documents: [] });
      const res = validateBackupJson(json);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('UNSUPPORTED_VERSION');
        expect(res.error).toContain('더 새로운 버전에서 만든 백업입니다');
      }
    });

    it('필수 필드(documents)가 누락되거나 타입이 잘못된 경우 오류를 반환한다', () => {
      const json = JSON.stringify({ format: 'markview-backup', version: 1, documents: 'not-an-array' });
      const res = validateBackupJson(json);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('INVALID_FIELDS');
      }
    });

    it('문서 개수 상한(5000개) 초과 시 거부한다', () => {
      const docs = Array.from({ length: MAX_BACKUP_DOCUMENTS + 1 }, (_, i) => ({
        name: `doc_${i}.md`,
        content: 'content',
        updatedAt: 1,
      }));
      const json = JSON.stringify({ format: 'markview-backup', version: 1, documents: docs });
      const res = validateBackupJson(json);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('SIZE_LIMIT_EXCEEDED');
      }
    });

    it('파일 용량 상한(300MB) 초과 시 거부한다', () => {
      const json = JSON.stringify({ format: 'markview-backup', version: 1, documents: [] });
      const res = validateBackupJson(json, MAX_BACKUP_FILE_BYTES + 10);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('SIZE_LIMIT_EXCEEDED');
        expect(res.error).toContain('300MB');
      }
    });
  });

  describe('planRestore (복원 계획)', () => {
    it('기존 문서를 지우지 않고 새 ID와 함께 추가 계획을 세운다', () => {
      const backup = createBackupData({
        documents: [{ name: '기존문서.md', content: '새로운 내용', updatedAt: 2000 }],
      });

      let idCounter = 1;
      const plan = planRestore({
        backup,
        existingDocNames: ['기존문서.md'],
        existingAttachmentIds: new Set(),
        idGenerator: () => `new_id_${idCounter++}`,
      });

      expect(plan.docsToAdd).toHaveLength(1);
      expect(plan.docsToAdd[0].id).toBe('new_id_1');
      // 기존 문서 이름과 겹치므로 (복원) 접미사 추가
      expect(plan.docsToAdd[0].name).toBe('기존문서 (복원).md');
      expect(plan.docsToAdd[0].content).toBe('새로운 내용');
    });

    it('이미 "(복원)" 이름이 존재할 경우 "(복원 2)"로 처리한다', () => {
      const backup = createBackupData({
        documents: [{ name: '메모.md', content: '내용', updatedAt: 1 }],
      });

      const plan = planRestore({
        backup,
        existingDocNames: ['메모.md', '메모 (복원).md'],
        existingAttachmentIds: new Set(),
      });

      expect(plan.docsToAdd[0].name).toBe('메모 (복원 2).md');
    });

    it('이미 저장소에 존재하는 첨부파일은 건너뛰고 없는 것만 추가한다', () => {
      const backup = createBackupData({
        documents: [{ name: 'doc.md', content: 'attachment:att1 attachment:att2', updatedAt: 1 }],
        attachments: [
          { id: 'att1', name: 'img1.png', mime: 'image/png', base64: '1111' },
          { id: 'att2', name: 'img2.png', mime: 'image/png', base64: '2222' },
        ],
      });

      const plan = planRestore({
        backup,
        existingDocNames: [],
        existingAttachmentIds: new Set(['att1']), // att1은 이미 존재
      });

      expect(plan.attachmentsToAdd).toHaveLength(1);
      expect(plan.attachmentsToAdd[0].id).toBe('att2');
      expect(plan.summary.skippedAttachmentCount).toBe(1);
      expect(plan.summary.attachmentCount).toBe(1);
    });
  });

  describe('왕복 (Round-trip) 및 특수문자 검증', () => {
    it('한글, 이모지, 줄바꿈, 특수 기호가 포함된 긴 문서가 백업 후 복원 계획까지 완전히 동일하게 유지된다', () => {
      const complexContent = [
        '# 🚀 특수 문자 및 한글 마크다운 문서 테스트',
        '',
        '이것은 한국어 본문입니다. 자음과 모음: 훈민정음 혜례본 ㉮㉯㉰',
        '이모지 모음: 🎉🔥✨💡💻📂🛡️',
        '수식: $\\alpha + \\beta = \\gamma$',
        '```javascript',
        'const greeting = "안녕 \\"world\\"\\n줄바꿈";',
        '```',
        '| 열 1 | 열 2 |',
        '| :--- | :--- |',
        '| 가 | 나 |',
      ].join('\n');

      const originalDocs = [
        {
          name: '복합 문서.md',
          content: complexContent,
          updatedAt: 1729000000000,
        },
      ];

      // 1. 백업 생성
      const backup = createBackupData({ documents: originalDocs });
      const json = JSON.stringify(backup);

      // 2. 백업 검증
      const validation = validateBackupJson(json);
      expect(validation.ok).toBe(true);
      if (!validation.ok) return;

      // 3. 복원 계획
      const plan = planRestore({
        backup: validation.data,
        existingDocNames: [],
        existingAttachmentIds: new Set(),
      });

      expect(plan.docsToAdd).toHaveLength(1);
      expect(plan.docsToAdd[0].content).toBe(complexContent);
      expect(plan.docsToAdd[0].name).toBe('복합 문서.md');
      expect(plan.docsToAdd[0].updatedAt).toBe(1729000000000);
    });

    it('빈 문서 목록도 안전하게 백업 및 복원 계획이 수립된다', () => {
      const backup = createBackupData({ documents: [] });
      const json = JSON.stringify(backup);
      const val = validateBackupJson(json);
      expect(val.ok).toBe(true);
      if (!val.ok) return;

      const plan = planRestore({
        backup: val.data,
        existingDocNames: [],
        existingAttachmentIds: new Set(),
      });

      expect(plan.docsToAdd).toHaveLength(0);
      expect(plan.summary.docCount).toBe(0);
    });

    it('참조되지만 읽어오지 못한 첨부파일 개수를 정확히 계산한다', () => {
      const contents = [
        '# 글 1\n![그림](attachment:att_1)\n![그림2](attachment:att_2)',
        '# 글 2\n![그림3](attachment:att_3)\n중복참조: attachment:att_1',
      ];
      // att_1만 읽어온 상태
      const missingCount = calculateMissingAttachmentCount(contents, new Set(['att_1']));
      // att_2와 att_3이 누락되었으므로 2개
      expect(missingCount).toBe(2);

      // 모두 읽어온 경우
      expect(calculateMissingAttachmentCount(contents, ['att_1', 'att_2', 'att_3'])).toBe(0);

      // 첨부가 전혀 없는 경우
      expect(calculateMissingAttachmentCount(['# 글만 있음', '내용'], [])).toBe(0);
    });
  });
});
