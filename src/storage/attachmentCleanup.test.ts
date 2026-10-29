import { describe, it, expect } from 'vitest';
import {
  findOrphanAttachmentIds,
  ORPHAN_GRACE_DAYS,
  ORPHAN_GRACE_MS,
  type AttachmentMeta,
} from './attachmentCleanup';

describe('findOrphanAttachmentIds', () => {
  const now = 1_000_000_000_000;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  it('참조 중인 첨부는 오래됐어도 남는다 (삭제 대상 아님)', () => {
    const stored: AttachmentMeta[] = [
      { id: 'img-referenced-old', createdAt: now - 30 * ONE_DAY_MS }, // 30일 경과
    ];
    const referencedIds = new Set(['img-referenced-old']);

    const result = findOrphanAttachmentIds(stored, referencedIds, now);
    expect(result).toEqual([]);
  });

  it('참조 없고 7일이 지난 첨부는 삭제 대상이다', () => {
    const stored: AttachmentMeta[] = [
      { id: 'img-orphan-8days', createdAt: now - 8 * ONE_DAY_MS }, // 8일 경과
    ];
    const referencedIds = new Set<string>();

    const result = findOrphanAttachmentIds(stored, referencedIds, now);
    expect(result).toEqual(['img-orphan-8days']);
  });

  it('참조 없지만 7일이 안 된 첨부는 남는다 (유예 기간 적용)', () => {
    const stored: AttachmentMeta[] = [
      { id: 'img-orphan-3days', createdAt: now - 3 * ONE_DAY_MS }, // 3일 경과
    ];
    const referencedIds = new Set<string>();

    const result = findOrphanAttachmentIds(stored, referencedIds, now);
    expect(result).toEqual([]);
  });

  it('정확히 7일째 경계(경과 시간 === 7일)에서는 삭제하지 않고 보존한다', () => {
    // 경계 정책: '7일보다 오래된 것만 삭제' 원칙에 따라,
    // 생성된 지 정확히 7일(7 * 24 * 60 * 60 * 1000 ms)이 된 시점은 7일을 초과하지 않았으므로 보존(미삭제) 처리한다.
    const stored: AttachmentMeta[] = [
      { id: 'img-exact-7days', createdAt: now - ORPHAN_GRACE_MS }, // 정확히 7일 전
      { id: 'img-7days-plus-1ms', createdAt: now - (ORPHAN_GRACE_MS + 1) }, // 7일 + 1ms 전
    ];
    const referencedIds = new Set<string>();

    const result = findOrphanAttachmentIds(stored, referencedIds, now);
    expect(result).toEqual(['img-7days-plus-1ms']);
    expect(result).not.toContain('img-exact-7days');
  });

  it('첨부가 하나도 없을 때 빈 목록을 돌려준다', () => {
    const result = findOrphanAttachmentIds([], new Set(), now);
    expect(result).toEqual([]);
  });

  it('상수 ORPHAN_GRACE_DAYS는 7이고, ORPHAN_GRACE_MS는 7일에 해당하는 밀리초이다', () => {
    expect(ORPHAN_GRACE_DAYS).toBe(7);
    expect(ORPHAN_GRACE_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
