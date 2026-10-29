import { describe, expect, it, beforeEach } from 'vitest';
import {
  getEnvironmentNotice,
  isBannerDismissed,
  dismissBanner,
  DISMISSED_BANNER_KEY,
} from './banner';

describe('environment notice & banner logic', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  });

  it('일반 웹 환경(http/https 및 정상 저장소)에서는 배너 문구가 null이다', () => {
    const notice = getEnvironmentNotice({ isFileProtocol: false, isInMemoryMode: false });
    expect(notice).toBeNull();
  });

  it('file: 프로토콜이면서 정상 저장소인 경우 USB 이동 주의 배너를 반환한다', () => {
    const notice = getEnvironmentNotice({ isFileProtocol: true, isInMemoryMode: false });
    expect(notice).toContain('이 파일로 열면 글은 이 컴퓨터의 브라우저에 임시 저장됩니다');
    expect(notice).toContain('USB를 다른 컴퓨터에서 쓸 때는');
  });

  it('임시 모드(저장소 실패)인 경우 자동 저장 불가 안내 배너를 반환한다', () => {
    const notice = getEnvironmentNotice({ isFileProtocol: false, isInMemoryMode: true });
    expect(notice).toContain('이 환경에서는 자동 저장을 쓸 수 없습니다');
    expect(notice).toContain("작업한 글은 '저장'으로 파일에 보관하세요");
  });

  it('file: 프로토콜과 임시 모드가 겹치면 하나로 합친 안내 배너를 반환한다', () => {
    const notice = getEnvironmentNotice({ isFileProtocol: true, isInMemoryMode: true });
    expect(notice).toContain('이 환경에서는 자동 저장을 쓸 수 없습니다');
    expect(notice).toContain("작업한 글은 '저장'으로 파일(.md)을 보관하세요");
  });

  it('배너 닫기 상태 저장 및 확인이 안전하게 동작한다 (localStorage 오류 무시)', () => {
    expect(isBannerDismissed(DISMISSED_BANNER_KEY)).toBe(false);
    dismissBanner(DISMISSED_BANNER_KEY);
    expect(isBannerDismissed(DISMISSED_BANNER_KEY)).toBe(true);

    // localStorage가 예외를 던지는 환경에서도 에러 없이 false 반환
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => { throw new Error('SecurityError'); },
        setItem: () => { throw new Error('SecurityError'); },
      },
      writable: true,
      configurable: true,
    });
    expect(isBannerDismissed(DISMISSED_BANNER_KEY)).toBe(false);
    expect(() => dismissBanner(DISMISSED_BANNER_KEY)).not.toThrow();
  });
});
