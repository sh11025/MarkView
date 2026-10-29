import { describe, it, expect } from 'vitest';
import { checkStorageQuota, STORAGE_WARN_THRESHOLD } from './quotaCheck';

describe('checkStorageQuota (저장 공간 할당량 경고 판단 순수 로직)', () => {
  it('사용량이 80% 미만(예: 79.9%)이면 경고하지 않는다', () => {
    const res = checkStorageQuota({
      usage: 799,
      quota: 1000,
    });
    expect(res.shouldWarn).toBe(false);
    expect(res.ratio).toBeCloseTo(0.799);
  });

  it('사용량이 정확히 80%이면 경고한다', () => {
    const res = checkStorageQuota({
      usage: 800,
      quota: 1000,
    });
    expect(res.shouldWarn).toBe(true);
    expect(res.ratio).toBe(STORAGE_WARN_THRESHOLD);
  });

  it('사용량이 100%이거나 초과하면 경고한다', () => {
    const res = checkStorageQuota({
      usage: 1000,
      quota: 1000,
    });
    expect(res.shouldWarn).toBe(true);

    const over = checkStorageQuota({
      usage: 1200,
      quota: 1000,
    });
    expect(over.shouldWarn).toBe(true);
  });

  it('quota가 0이거나 정의되지 않은 경우 경고하지 않는다', () => {
    expect(checkStorageQuota({ usage: 100, quota: 0 }).shouldWarn).toBe(false);
    expect(checkStorageQuota({ usage: 100, quota: -10 }).shouldWarn).toBe(false);
    expect(checkStorageQuota({ usage: 100 }).shouldWarn).toBe(false);
    expect(checkStorageQuota(null).shouldWarn).toBe(false);
    expect(checkStorageQuota(undefined).shouldWarn).toBe(false);
  });
});
