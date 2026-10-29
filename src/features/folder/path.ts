/**
 * 폴더 기준 상대 경로를 계산한다. 구분자는 항상 '/'이다.
 * React를 import하지 않는다.
 */
export function joinPath(parentPath: string, name: string): string {
  if (!parentPath) return name;
  return `${parentPath}/${name}`.replace(/\\+/g, '/').replace(/\/+/g, '/');
}

export type ResolveResult =
  | { ok: true; path: string; hash: string }
  | { ok: false; reason: 'external' | 'empty' | 'outside' };

function safeDecodeURIComponent(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

/**
 * 현재 문서의 folderPath를 기준으로 상대 경로 target을 해석한다.
 * - baseFilePath: 현재 문서의 폴더 기준 상대 경로 (예: "docs/guide.md", 루트면 "a.md")
 * - target: 링크 또는 이미지 src (예: "./2장.md#제목", "../img/logo.png?v=1")
 */
export function resolveRelativePath(baseFilePath: string, target: string): ResolveResult {
  if (!target || typeof target !== 'string') {
    return { ok: false, reason: 'empty' };
  }

  const normalizedTarget = target.trim().replace(/\\+/g, '/');

  // 외부 URL, 스킴, 절대경로, 드라이브 경로 검사
  // 스킴: http:, https:, data:, blob:, mailto:, tel:, attachment:, file: 등
  if (
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(normalizedTarget) ||
    normalizedTarget.startsWith('//') ||
    normalizedTarget.startsWith('/') ||
    /^[a-zA-Z]:/.test(normalizedTarget)
  ) {
    return { ok: false, reason: 'external' };
  }

  // #hash 분리
  let pathWithQuery = normalizedTarget;
  let hash = '';
  const hashIdx = pathWithQuery.indexOf('#');
  if (hashIdx !== -1) {
    hash = safeDecodeURIComponent(pathWithQuery.slice(hashIdx + 1));
    pathWithQuery = pathWithQuery.slice(0, hashIdx);
  }

  // ?query 분리
  const queryIdx = pathWithQuery.indexOf('?');
  if (queryIdx !== -1) {
    pathWithQuery = pathWithQuery.slice(0, queryIdx);
  }

  const cleanTargetPath = pathWithQuery.trim();
  if (!cleanTargetPath) {
    return { ok: false, reason: 'empty' };
  }

  const decodedTargetPath = safeDecodeURIComponent(cleanTargetPath);

  // baseFilePath에서 기준 디렉토리 추출
  const normalizedBase = (baseFilePath || '').trim().replace(/\\+/g, '/');
  const lastSlash = normalizedBase.lastIndexOf('/');
  const baseDir = lastSlash >= 0 ? normalizedBase.slice(0, lastSlash) : '';

  const stack: string[] = baseDir ? baseDir.split('/').filter(Boolean) : [];
  const parts = decodedTargetPath.split('/');

  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (stack.length === 0) {
        return { ok: false, reason: 'outside' };
      }
      stack.pop();
    } else {
      stack.push(part);
    }
  }

  return {
    ok: true,
    path: stack.join('/'),
    hash,
  };
}
