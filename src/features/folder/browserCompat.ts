/**
 * @file browserCompat.ts
 * Firefox, Brave 등 브라우저별 파일 시스템 기능 호환성 검사 및 안내 유틸리티입니다.
 */

export const BRAVE_FLAG_URL = 'brave://flags/#file-system-access-api';
export const BRAVE_GUIDE_MESSAGE =
  'Brave에서는 주소창에 brave://flags/#file-system-access-api 를 입력해 사용 설정하면 폴더 저장까지 됩니다';

export const READONLY_FOLDER_NOTICE =
  '이 브라우저에서는 폴더 안 파일을 직접 덮어쓸 수 없어 다운로드로 저장됩니다';

/**
 * 현재 브라우저가 Brave인지 비동기 판별합니다.
 */
export async function isBraveBrowser(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as unknown as { brave?: { isBrave?: () => Promise<boolean> } };
  if (nav.brave && typeof nav.brave.isBrave === 'function') {
    try {
      return await nav.brave.isBrave();
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * 네이티브 File System Access API(showDirectoryPicker)를 지원하는지 여부
 */
export function canUseNativeFolderPicker(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'
  );
}

/**
 * 클립보드에 Brave 플래그 URL을 복사합니다.
 */
export async function copyBraveFlagUrl(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(BRAVE_FLAG_URL);
    return true;
  } catch {
    return false;
  }
}
