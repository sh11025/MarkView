/**
 * @file 브라우저 저장 공간 용량 경고 알림 모듈
 * 할당량의 80% 이상 사용 시 사용자에게 백업 및 정리 권고 토스트를 노출합니다.
 */

import { checkStorageQuota } from '../features/storage/quotaCheck';
import { useUi } from '../stores/ui';

export interface StorageWarningGate {
  hasWarned(): boolean;
  triggerStorageQuotaCheck(): Promise<boolean>;
}

/**
 * 저장 공간 경고 게이트 인스턴스를 생성합니다.
 */
export function createStorageWarningGate(): StorageWarningGate {
  let hasWarnedInSession = false;

  return {
    hasWarned: () => hasWarnedInSession,
    async triggerStorageQuotaCheck(): Promise<boolean> {
      if (hasWarnedInSession) return false;
      if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.estimate !== 'function') {
        return false;
      }

      try {
        const est = await navigator.storage.estimate();
        const { shouldWarn } = checkStorageQuota(est);

        if (shouldWarn && !hasWarnedInSession) {
          hasWarnedInSession = true;

          useUi.getState().pushToast({
            text: '브라우저 저장 공간이 거의 찼습니다. 글 백업을 내려받고 필요 없는 이미지를 정리하세요.',
            kind: 'error',
            sticky: true,
            action: {
              label: '백업 내려받기',
              run: () => {
                void (async () => {
                  try {
                    const { downloadFullBackup } = await import('./fileActions');
                    await downloadFullBackup();
                  } catch (err) {
                    alert('백업 파일 생성 실패: ' + String(err));
                  }
                })();
              },
            },
          });

          return true;
        }
      } catch (err) {
        console.warn('저장소 사용량 조회 실패:', err);
      }

      return false;
    },
  };
}

export const defaultStorageWarningGate = createStorageWarningGate();

/**
 * 브라우저 저장 공간 사용량을 비동기로 점검하고 필요 시 경고 토스트를 띄웁니다.
 */
export const triggerStorageQuotaCheck = (): Promise<boolean> =>
  defaultStorageWarningGate.triggerStorageQuotaCheck();
