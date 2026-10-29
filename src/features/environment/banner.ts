/**
 * 환경(프로토콜 및 저장소 가용성)에 따른 사용자 안내 배너 판별 로직
 * 핵심 원칙: 순수 함수, React import 금지
 */

export interface EnvironmentParams {
  isFileProtocol: boolean;
  isInMemoryMode: boolean;
}

export const DISMISSED_BANNER_KEY = 'markview-banner-dismissed-file';

/**
 * 환경에 따라 표시할 안내 배너 문구를 반환한다.
 * 표시할 필요가 없으면 null을 반환한다.
 */
export function getEnvironmentNotice({ isFileProtocol, isInMemoryMode }: EnvironmentParams): string | null {
  // 1. 임시 모드(저장소 실패)와 file: 프로토콜이 겹치는 경우 하나로 통합
  if (isInMemoryMode && isFileProtocol) {
    return "이 환경에서는 자동 저장을 쓸 수 없습니다. 작업한 글은 '저장'으로 파일(.md)을 보관하세요.";
  }

  // 2. 임시 모드 단독 (웹 환경에서 시크릿 창 등으로 IndexedDB 실패)
  if (isInMemoryMode) {
    return "이 환경에서는 자동 저장을 쓸 수 없습니다. 작업한 글은 '저장'으로 파일에 보관하세요.";
  }

  // 3. file: 프로토콜 단독 (IndexedDB는 사용 가능하나 다른 PC로 USB 이동 시 주의)
  if (isFileProtocol) {
    return "이 파일로 열면 글은 이 컴퓨터의 브라우저에 임시 저장됩니다. USB를 다른 컴퓨터에서 쓸 때는 '저장'으로 파일(.md)을 USB에 보관하세요.";
  }

  return null;
}

/** 닫기 상태 확인 (localStorage try/catch) */
export function isBannerDismissed(key: string = DISMISSED_BANNER_KEY): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

/** 닫기 상태 저장 (localStorage try/catch) */
export function dismissBanner(key: string = DISMISSED_BANNER_KEY): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, 'true');
    }
  } catch {
    // 저장소 제한 시 조용히 무시
  }
}
