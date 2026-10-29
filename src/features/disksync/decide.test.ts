import { describe, it, expect } from 'vitest';
import { decideDiskSync } from './decide';

describe('decideDiskSync', () => {
  it('knownDiskModified가 없거나 0이면 record-only를 반환한다', () => {
    expect(
      decideDiskSync({
        knownDiskModified: undefined,
        currentDiskModified: 1000,
        isDirty: false,
      }),
    ).toBe('record-only');

    expect(
      decideDiskSync({
        knownDiskModified: 0,
        currentDiskModified: 1000,
        isDirty: true,
      }),
    ).toBe('record-only');
  });

  it('경계값: 디스크 수정 시각이 기존에 알고 있던 시각과 같으면 none을 반환한다', () => {
    expect(
      decideDiskSync({
        knownDiskModified: 1000,
        currentDiskModified: 1000,
        isDirty: false,
      }),
    ).toBe('none');

    expect(
      decideDiskSync({
        knownDiskModified: 1000,
        currentDiskModified: 1000,
        isDirty: true,
      }),
    ).toBe('none');
  });

  it('디스크 수정 시각이 기존 시각보다 과거이면 none을 반환한다', () => {
    expect(
      decideDiskSync({
        knownDiskModified: 2000,
        currentDiskModified: 1000,
        isDirty: false,
      }),
    ).toBe('none');
  });

  it('디스크가 더 새롭고 isDirty가 false이면 reload를 반환한다', () => {
    expect(
      decideDiskSync({
        knownDiskModified: 1000,
        currentDiskModified: 2000,
        isDirty: false,
      }),
    ).toBe('reload');
  });

  it('디스크가 더 새롭고 isDirty가 true이면 conflict를 반환한다', () => {
    expect(
      decideDiskSync({
        knownDiskModified: 1000,
        currentDiskModified: 2000,
        isDirty: true,
      }),
    ).toBe('conflict');
  });
});
