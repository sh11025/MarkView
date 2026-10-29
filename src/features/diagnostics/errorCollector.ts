/**
 * @file 전역 오류 수집 순수 로직 모듈 (React import 금지)
 * 브라우저의 error 및 unhandledrejection 이벤트를 포착하여 최근 30개의 에러를 메모리에 보관합니다.
 * 개인 정보(문서 내용, 파일명 등)가 누출되지 않도록 길이 제한과 경로 마스킹을 수행합니다.
 */

export interface CapturedError {
  time: string; // ISO 8601
  type: 'error' | 'unhandledrejection' | 'react';
  message: string; // 최대 200자, 경로 마스킹
  stack?: string; // 첫 5줄, 경로 마스킹
}

const MAX_ERROR_COUNT = 30;
const MAX_MESSAGE_LENGTH = 200;
const MAX_STACK_LINES = 5;

/**
 * 경로성 문자열(예: file:///..., C:\..., /Users/...)에서 실제 파일명/폴더명을 마스킹합니다.
 */
export function sanitizePath(input: string): string {
  if (!input) return '';

  let sanitized = input;

  // 1. file:/// URL 패턴: file:///path/to/secret.md -> file:///[경로/파일]
  sanitized = sanitized.replace(/file:\/\/\/[^\s:)'"]+/gi, (match) => {
    const ext = match.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? '';
    return `file:///[경로/파일${ext}]`;
  });

  // 2. Windows 드라이브 경로 패턴: C:\Users\name\secret.md -> [경로/파일]
  sanitized = sanitized.replace(/[a-zA-Z]:\\[^\s:)'"]+/g, (match) => {
    const ext = match.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? '';
    return `[경로/파일${ext}]`;
  });

  // 3. Unix 절대 경로 패턴 (최소 2단계 디렉터리): /Users/name/secret.md -> [경로/파일]
  sanitized = sanitized.replace(/(?:^|[\s('"])(?:\/[a-zA-Z0-9_.-]+){2,}/g, (match) => {
    const prefix = match.startsWith(' ') || match.startsWith('(') || match.startsWith("'") || match.startsWith('"')
      ? match[0]
      : '';
    const cleanMatch = match.slice(prefix.length);
    const ext = cleanMatch.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? '';
    return `${prefix}[경로/파일${ext}]`;
  });

  return sanitized;
}

/**
 * 에러 메시지를 200자 이내로 자르고 경로를 마스킹합니다.
 */
export function sanitizeMessage(rawMessage: string): string {
  if (!rawMessage) return '알 수 없는 오류';
  const sliced = rawMessage.slice(0, MAX_MESSAGE_LENGTH);
  return sanitizePath(sliced);
}

/**
 * 스택 트레이스를 첫 5줄로 제한하고 경로를 마스킹합니다.
 */
export function sanitizeStack(rawStack?: string): string | undefined {
  if (!rawStack) return undefined;
  const lines = rawStack.split('\n').slice(0, MAX_STACK_LINES).join('\n');
  return sanitizePath(lines);
}

export interface ErrorCollector {
  recordError(rawError: unknown, type?: 'error' | 'unhandledrejection' | 'react'): CapturedError;
  getRecentErrors(): readonly CapturedError[];
  initGlobalListener(targetWindow?: Window): () => void;
}

/**
 * 독립적인 에러 수집기 인스턴스를 생성합니다.
 */
export function createErrorCollector(): ErrorCollector {
  const errorBuffer: CapturedError[] = [];
  let isListenerRegistered = false;

  const record = (
    rawError: unknown,
    type: 'error' | 'unhandledrejection' | 'react' = 'error',
  ): CapturedError => {
    try {
      let message = '알 수 없는 오류';
      let stack: string | undefined;

      if (rawError instanceof Error) {
        message = rawError.message || rawError.name || 'Error';
        stack = rawError.stack;
      } else if (typeof rawError === 'string') {
        message = rawError;
      } else if (rawError && typeof rawError === 'object') {
        try {
          const obj = rawError as { message?: string; stack?: string };
          message = obj.message || JSON.stringify(rawError);
          stack = obj.stack;
        } catch {
          message = 'Object error';
        }
      }

      const captured: CapturedError = {
        time: new Date().toISOString(),
        type,
        message: sanitizeMessage(message),
        stack: sanitizeStack(stack),
      };

      errorBuffer.push(captured);
      if (errorBuffer.length > MAX_ERROR_COUNT) {
        errorBuffer.shift(); // 오래된 것 제거
      }

      return captured;
    } catch {
      // 수집 로직 자체의 예외로 인해 앱 동작이 방해받지 않도록 방어
      const fallback: CapturedError = {
        time: new Date().toISOString(),
        type,
        message: '오류 수집 중 예외 발생',
      };
      return fallback;
    }
  };

  const getRecent = (): readonly CapturedError[] => {
    return [...errorBuffer];
  };

  const initGlobal = (targetWindow: Window = typeof window !== 'undefined' ? window : ({} as Window)): () => void => {
    if (isListenerRegistered || !targetWindow || typeof targetWindow.addEventListener !== 'function') {
      return () => {};
    }
    isListenerRegistered = true;

    const errorHandler = (event: ErrorEvent) => {
      try {
        record(event.error || event.message, 'error');
      } catch {
        // 무시
      }
    };

    const rejectionHandler = (event: PromiseRejectionEvent) => {
      try {
        record(event.reason, 'unhandledrejection');
      } catch {
        // 무시
      }
    };

    targetWindow.addEventListener('error', errorHandler);
    targetWindow.addEventListener('unhandledrejection', rejectionHandler);

    return () => {
      targetWindow.removeEventListener('error', errorHandler);
      targetWindow.removeEventListener('unhandledrejection', rejectionHandler);
      isListenerRegistered = false;
    };
  };

  return {
    recordError: record,
    getRecentErrors: getRecent,
    initGlobalListener: initGlobal,
  };
}

// 제품 전역에서 사용하는 기본 인스턴스
export const defaultErrorCollector = createErrorCollector();

/**
 * 새로운 오류를 수집 버퍼에 기록합니다.
 */
export const recordError = (
  rawError: unknown,
  type: 'error' | 'unhandledrejection' | 'react' = 'error',
): CapturedError => defaultErrorCollector.recordError(rawError, type);

/**
 * 최근 수집된 오류 목록의 복사본을 반환합니다.
 */
export const getRecentErrors = (): readonly CapturedError[] => defaultErrorCollector.getRecentErrors();

/**
 * 브라우저 전역 에러 리스너를 등록합니다 (앱 시작 시 1회 호출).
 */
export const initGlobalErrorCollector = (): void => {
  defaultErrorCollector.initGlobalListener();
};
