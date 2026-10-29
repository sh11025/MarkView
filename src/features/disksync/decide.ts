/**
 * 디스크 파일의 변경 사항과 현재 문서 상태를 비교하여 처리 방식을 결정하는 순수 함수.
 * React를 import하지 않는다.
 */

export type DiskSyncDecision = 'none' | 'record-only' | 'reload' | 'conflict';

export interface DiskSyncInput {
  knownDiskModified: number | undefined;
  currentDiskModified: number;
  isDirty: boolean;
}

/**
 * 디스크 파일 변경 감지 판단 규칙:
 * 1. knownDiskModified가 없거나 0이면: 예전에 열었거나 처음 추적하는 파일이므로 현재 디스크 시간을 기록만 한다 ('record-only').
 * 2. currentDiskModified <= knownDiskModified: 디스크 파일이 변경되지 않았거나 더 과거이므로 아무것도 하지 않는다 ('none').
 * 3. 디스크가 더 새로운 경우:
 *    - 사용자가 편집 중(isDirty === true)이면 덮어쓰지 않고 충돌 알림을 띄운다 ('conflict').
 *    - 사용자가 편집 중이 아니면(isDirty === false) 안전하게 디스크 내용으로 다시 불러온다 ('reload').
 */
export function decideDiskSync(input: DiskSyncInput): DiskSyncDecision {
  const { knownDiskModified, currentDiskModified, isDirty } = input;

  if (!knownDiskModified || knownDiskModified === 0) {
    return 'record-only';
  }

  if (currentDiskModified <= knownDiskModified) {
    return 'none';
  }

  return isDirty ? 'conflict' : 'reload';
}
