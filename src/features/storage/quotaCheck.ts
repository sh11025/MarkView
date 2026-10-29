/**
 * @file 브라우저 저장소 할당량 및 사용량 경고 판단 순수 함수 (React import 금지)
 */

export interface StorageEstimateData {
  usage?: number;
  quota?: number;
}

export interface QuotaCheckResult {
  shouldWarn: boolean;
  ratio: number; // 0.0 ~ 1.0 (또는 그 이상)
  usageMB: number;
  quotaMB: number;
}

export const STORAGE_WARN_THRESHOLD = 0.8; // 80%

/**
 * navigator.storage.estimate() 결과를 바탕으로 80% 임계값 초과 여부를 판단합니다.
 */
export function checkStorageQuota(estimate?: StorageEstimateData | null): QuotaCheckResult {
  if (!estimate || typeof estimate.quota !== 'number' || estimate.quota <= 0) {
    return {
      shouldWarn: false,
      ratio: 0,
      usageMB: 0,
      quotaMB: 0,
    };
  }

  const usage = typeof estimate.usage === 'number' && estimate.usage > 0 ? estimate.usage : 0;
  const quota = estimate.quota;
  const ratio = usage / quota;

  return {
    shouldWarn: ratio >= STORAGE_WARN_THRESHOLD,
    ratio,
    usageMB: usage / (1024 * 1024),
    quotaMB: quota / (1024 * 1024),
  };
}
