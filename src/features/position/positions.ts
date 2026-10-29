/**
/** 문서 커서 및 스크롤 위치 관련 순수 함수 */

export interface DocumentPosition {
  anchor: number;
  head: number;
  editorLine: number;
  previewLine: number;
}

/** 커서 범위를 문서 길이 [0, docLength] 내로 보정 */
export function clampCursor(
  cursor: { anchor: number; head: number },
  docLength: number,
): { anchor: number; head: number } {
  const safeLen = Math.max(0, docLength);
  return {
    anchor: Math.max(0, Math.min(safeLen, Math.floor(cursor.anchor))),
    head: Math.max(0, Math.min(safeLen, Math.floor(cursor.head))),
  };
}

/** 줄 번호 범위를 [0, totalLines - 1] 내로 보정 */
export function clampLine(line: number, totalLines: number): number {
  if (totalLines <= 0) return 0;
  return Math.max(0, Math.min(totalLines - 1, Math.floor(line)));
}

/**
 * 미리보기의 data-line 목록 중 targetLine 이하에서 가장 가까운 줄 번호를 반환한다.
 * (모든 data-line이 targetLine보다 크다면 첫 번째 요소의 줄 번호 반환)
 */
export function findClosestPreviewLine(availableLines: number[], targetLine: number): number | null {
  if (availableLines.length === 0) return null;
  const target = Math.max(0, Math.floor(targetLine));
  let best: number | null = null;
  for (const line of availableLines) {
    if (line <= target) {
      if (best === null || line > best) {
        best = line;
      }
    }
  }
  return best ?? availableLines[0];
}

/**
 * 저장된 positions 객체가 유효한지 검증하고 정리 (하위 호환성 및 오염 방지)
 */
export function sanitizePositions(raw: unknown): Record<string, DocumentPosition> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<string, DocumentPosition> = {};
  for (const [id, pos] of Object.entries(raw as Record<string, unknown>)) {
    if (
      pos &&
      typeof pos === 'object' &&
      typeof (pos as DocumentPosition).anchor === 'number' &&
      !Number.isNaN((pos as DocumentPosition).anchor) &&
      typeof (pos as DocumentPosition).head === 'number' &&
      !Number.isNaN((pos as DocumentPosition).head) &&
      typeof (pos as DocumentPosition).editorLine === 'number' &&
      !Number.isNaN((pos as DocumentPosition).editorLine) &&
      typeof (pos as DocumentPosition).previewLine === 'number' &&
      !Number.isNaN((pos as DocumentPosition).previewLine)
    ) {
      result[id] = {
        anchor: Math.max(0, Math.floor((pos as DocumentPosition).anchor)),
        head: Math.max(0, Math.floor((pos as DocumentPosition).head)),
        editorLine: Math.max(0, Math.floor((pos as DocumentPosition).editorLine)),
        previewLine: Math.max(0, Math.floor((pos as DocumentPosition).previewLine)),
      };
    }
  }
  return result;
}
