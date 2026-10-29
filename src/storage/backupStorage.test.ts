// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import {
  readBackupSourceFromDatabase,
  executeRestorePlanToDb,
} from './backupStorage';
import type { RestorePlan } from '../features/backup';

// (a) readBackupSourceFromDatabase가 스토어에 일절 접근하지 않음을 엄격히 증명하기 위해
// 스토어 모듈 접근 시 즉시 예외를 발생시킵니다.
vi.mock('../stores/documents', () => {
  return {
    useDocuments: {
      getState: () => {
        throw new Error('오류: readBackupSourceFromDatabase는 useDocuments 스토어에 접근하면 안 됩니다!');
      },
    },
  };
});

vi.mock('../stores/settings', () => {
  return {
    useSettings: {
      getState: () => {
        throw new Error('오류: readBackupSourceFromDatabase는 useSettings 스토어에 접근하면 안 됩니다!');
      },
    },
  };
});

function createFakeDb(overrides: Record<string, unknown> = {}) {
  const fake = {
    getAll: vi.fn(async (storeName: string) => {
      if (storeName === 'documents') {
        return [{ id: 'doc-db', name: 'DB직접문서.md', content: 'DB내용', updatedAt: 12345 }];
      }
      if (storeName === 'attachments') {
        return [];
      }
      return [];
    }),
    get: vi.fn(async (_storeName: string, key: string) => {
      if (key === 'tab_order') return ['doc-db'];
      if (key === 'settings') return { theme: 'dark', fontSize: 18 };
      return undefined;
    }),
    put: vi.fn(async () => undefined),
    ...overrides,
  };
  return fake as any;
}

describe('backupStorage (독립 DB 백업 읽기 및 복원 안전성)', () => {
  it('readBackupSourceFromDatabase는 스토어 모듈에 접근하지 않고 IndexedDB만으로 백업 객체를 생성한다', async () => {
    const fakeDb = createFakeDb({
      get: vi.fn(async (_storeName: string, key: string) => {
        if (key === 'session') return { order: ['doc-2', 'doc-1'], activeId: 'doc-2' };
        if (key === 'settings') return { theme: 'dark', fontSize: 18 };
        return undefined;
      }),
      getAll: vi.fn(async (storeName: string) => {
        if (storeName === 'documents') {
          return [
            { id: 'doc-1', name: '문서1.md', content: '내용1', updatedAt: 100 },
            { id: 'doc-2', name: '문서2.md', content: '내용2', updatedAt: 200 },
          ];
        }
        return [];
      }),
    });
    const backup = await readBackupSourceFromDatabase(async () => fakeDb);

    expect(backup.format).toBe('markview-backup');
    expect(backup.documents).toHaveLength(2);
    expect(backup.order).toEqual(['doc-2', 'doc-1']);
    expect(backup.settings).toEqual({ theme: 'dark', fontSize: 18 });
    expect(fakeDb.getAll).toHaveBeenCalledWith('documents');
  });

  it('readBackupSourceFromDatabase는 kv session의 order가 없을 때 레거시 tab_order나 문서 순서로 fallback한다', async () => {
    const fakeDb = createFakeDb({
      get: vi.fn(async (_storeName: string, key: string) => {
        if (key === 'tab_order') return ['doc-legacy'];
        return undefined;
      }),
      getAll: vi.fn(async (storeName: string) => {
        if (storeName === 'documents') {
          return [{ id: 'doc-legacy', name: '레거시.md', content: '내용', updatedAt: 100 }];
        }
        return [];
      }),
    });
    const backup = await readBackupSourceFromDatabase(async () => fakeDb);
    expect(backup.order).toEqual(['doc-legacy']);
  });

  it('executeRestorePlanToDb는 저장소 차단 환경(getDb 실패)에서 isStorageUnavailable: true를 돌려준다', async () => {
    const plan: RestorePlan = {
      docsToAdd: [
        {
          id: 'new-1',
          name: '복원글.md',
          content: '본문',
          updatedAt: 1000,
          savedAt: 1000,
          handleId: null,
        },
      ],
      attachmentsToAdd: [
        {
          id: 'att-1',
          name: 'img.png',
          mime: 'image/png',
          base64: 'AAAA',
        },
      ],
      summary: { docCount: 1, attachmentCount: 1, skippedAttachmentCount: 0 },
    };

    const result = await executeRestorePlanToDb(plan, async () => {
      throw new Error('IndexedDB blocked');
    });

    expect(result.isStorageUnavailable).toBe(true);
    expect(result.docsSuccess).toBe(0);
    expect(result.docsFailed).toBe(1);
    expect(result.attachmentsSuccess).toBe(0);
    expect(result.attachmentsFailed).toBe(1);
  });

  it('executeRestorePlanToDb는 첨부파일 저장이 일부 실패하면 정확한 실패 건수를 집계한다', async () => {
    const fakeDb = createFakeDb({
      put: vi.fn(async (storeName: string, value: any) => {
        if (storeName === 'attachments' && value.id === 'att-fail') {
          throw new Error('Quota exceeded on attachment');
        }
        return undefined;
      }),
    });

    const plan: RestorePlan = {
      docsToAdd: [
        {
          id: 'doc-1',
          name: '성공문서.md',
          content: '본문',
          updatedAt: 1000,
          savedAt: 1000,
          handleId: null,
        },
      ],
      attachmentsToAdd: [
        {
          id: 'att-ok',
          name: '성공.png',
          mime: 'image/png',
          base64: 'AAAA',
        },
        {
          id: 'att-fail',
          name: '실패.png',
          mime: 'image/png',
          base64: 'BBBB',
        },
      ],
      summary: { docCount: 1, attachmentCount: 2, skippedAttachmentCount: 0 },
    };

    const result = await executeRestorePlanToDb(plan, async () => fakeDb);

    expect(result.isStorageUnavailable).toBe(false);
    expect(result.docsSuccess).toBe(1);
    expect(result.docsFailed).toBe(0);
    expect(result.attachmentsSuccess).toBe(1);
    expect(result.attachmentsFailed).toBe(1);
  });
});
