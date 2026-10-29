import { describe, it, expect, beforeEach } from 'vitest';
import {
  createErrorCollector,
  type ErrorCollector,
  sanitizePath,
  sanitizeMessage,
  sanitizeStack,
} from './errorCollector';

describe('errorCollector (전역 오류 수집 및 개인정보 보호)', () => {
  let collector: ErrorCollector;

  beforeEach(() => {
    collector = createErrorCollector();
  });

  it('기본 에러를 정상적으로 기록한다', () => {
    collector.recordError(new Error('테스트 오류 발생'), 'error');
    const list = collector.getRecentErrors();
    expect(list).toHaveLength(1);
    expect(list[0].type).toBe('error');
    expect(list[0].message).toBe('테스트 오류 발생');
    expect(list[0].time).toBeDefined();
  });

  it('30개를 초과하여 에러가 발생하면 오래된 순서대로 버린다', () => {
    for (let i = 1; i <= 35; i++) {
      collector.recordError(`오류 #${i}`);
    }
    const list = collector.getRecentErrors();
    expect(list).toHaveLength(30);
    // 가장 오래된 #1~#5는 버려지고 #6부터 #35까지 남아있어야 함
    expect(list[0].message).toBe('오류 #6');
    expect(list[29].message).toBe('오류 #35');
  });

  it('메시지 길이가 200자를 초과하면 200자까지만 자른다', () => {
    const longMsg = 'A'.repeat(300);
    const sanitized = sanitizeMessage(longMsg);
    expect(sanitized.length).toBe(200);
  });

  it('스택 트레이스는 첫 5줄까지만 유지한다', () => {
    const stack = [
      'Error: 뭔가 잘못됨',
      '    at func1 (file.js:1:1)',
      '    at func2 (file.js:2:2)',
      '    at func3 (file.js:3:3)',
      '    at func4 (file.js:4:4)',
      '    at func5 (file.js:5:5)',
      '    at func6 (file.js:6:6)',
    ].join('\n');

    const sanitized = sanitizeStack(stack);
    expect(sanitized).toBeDefined();
    const lines = sanitized!.split('\n');
    expect(lines).toHaveLength(5);
  });

  it('경로성 문자열(Windows, file://, Unix 절대경로)에서 파일명과 경로를 마스킹한다', () => {
    const rawMsg =
      '파일 열기 실패: C:\\Users\\Administrator\\Desktop\\비밀문서.md 에서 오류가 발생했습니다. ' +
      '또한 file:///home/user/notes/secret_plan.txt 및 /var/log/private/report.pdf 참조 중.';

    const masked = sanitizePath(rawMsg);
    expect(masked).not.toContain('비밀문서');
    expect(masked).not.toContain('secret_plan');
    expect(masked).not.toContain('private/report');
    expect(masked).toContain('[경로/파일.md]');
    expect(masked).toContain('file:///[경로/파일.txt]');
    expect(masked).toContain('[경로/파일.pdf]');
  });

  it('예외적인 입력(객체, undefined, 순환참조 등)에도 에러 수집이 중단되지 않는다', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => {
      collector.recordError(circular);
      collector.recordError(null);
      collector.recordError(undefined);
    }).not.toThrow();

    const list = collector.getRecentErrors();
    expect(list).toHaveLength(3);
  });
});
