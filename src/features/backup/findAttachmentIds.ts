/**
 * @file 문서 본문에서 참조 중인 attachmentId들을 추출하는 순수 함수
 */

const ATTACHMENT_REGEX = /attachment:([a-zA-Z0-9_-]+)/g;

/**
 * 주어진 마크다운 문자열들에서 사용 중인 첨부파일 id 목록을 중복 없이 추출합니다.
 */
export function findAttachmentIds(contents: readonly string[]): Set<string> {
  const ids = new Set<string>();
  for (const text of contents) {
    if (!text) continue;
    ATTACHMENT_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = ATTACHMENT_REGEX.exec(text)) !== null) {
      if (match[1]) {
        ids.add(match[1]);
      }
    }
  }
  return ids;
}

/**
 * 문서 본문에서 참조 중이지만 실제 읽어온 첨부 목록(loadedIds)에 없는 누락 첨부 개수를 계산합니다.
 */
export function calculateMissingAttachmentCount(
  contents: readonly string[],
  loadedIds: Set<string> | readonly string[],
): number {
  const referencedIds = findAttachmentIds(contents);
  const loadedSet = loadedIds instanceof Set ? loadedIds : new Set(loadedIds);
  let missing = 0;
  for (const id of referencedIds) {
    if (!loadedSet.has(id)) {
      missing++;
    }
  }
  return missing;
}
