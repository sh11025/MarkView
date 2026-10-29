// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import {
  isBraveBrowser,
  canUseNativeFolderPicker,
  copyBraveFlagUrl,
  BRAVE_FLAG_URL,
  BRAVE_GUIDE_MESSAGE,
  READONLY_FOLDER_NOTICE,
} from './browserCompat';

describe('browserCompat (브라우저별 호환성 및 안내)', () => {
  it('안내 문구와 플래그 URL이 정확히 정의되어 있다', () => {
    expect(BRAVE_FLAG_URL).toBe('brave://flags/#file-system-access-api');
    expect(BRAVE_GUIDE_MESSAGE).toContain('brave://flags/#file-system-access-api');
    expect(READONLY_FOLDER_NOTICE).toBe(
      '이 브라우저에서는 폴더 안 파일을 직접 덮어쓸 수 없어 다운로드로 저장됩니다',
    );
  });

  it('네이티브 폴더 피커 지원 여부를 판별한다', () => {
    expect(typeof canUseNativeFolderPicker()).toBe('boolean');
  });

  it('Brave 브라우저를 올바르게 판별한다', async () => {
    // navigator.brave가 없는 일반 환경
    expect(await isBraveBrowser()).toBe(false);

    // navigator.brave가 있는 Brave 환경 모킹
    Object.defineProperty(navigator, 'brave', {
      value: { isBrave: vi.fn().mockResolvedValue(true) },
      configurable: true,
      writable: true,
    });
    expect(await isBraveBrowser()).toBe(true);

    // 정리
    delete (navigator as any).brave;
  });

  it('클립보드에 Brave 플래그 URL을 복사한다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });

    const ok = await copyBraveFlagUrl();
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('brave://flags/#file-system-access-api');
  });
});
