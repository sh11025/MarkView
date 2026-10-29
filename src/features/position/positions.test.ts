import { describe, it, expect } from 'vitest';
import {
  clampCursor,
  clampLine,
  findClosestPreviewLine,
  sanitizePositions,
  type DocumentPosition,
} from './positions';

describe('clampCursor', () => {
  it('문서 길이 범위 내의 커서는 그대로 유지한다', () => {
    expect(clampCursor({ anchor: 10, head: 15 }, 100)).toEqual({ anchor: 10, head: 15 });
  });

  it('문서 길이를 초과하는 커서는 문서 끝으로 고정한다', () => {
    expect(clampCursor({ anchor: 120, head: 150 }, 100)).toEqual({ anchor: 100, head: 100 });
  });

  it('음수 커서는 0으로 고정한다', () => {
    expect(clampCursor({ anchor: -5, head: -1 }, 50)).toEqual({ anchor: 0, head: 0 });
  });

  it('빈 문서(길이 0)에서는 항상 0으로 고정한다', () => {
    expect(clampCursor({ anchor: 10, head: 20 }, 0)).toEqual({ anchor: 0, head: 0 });
  });
});

describe('clampLine', () => {
  it('유효한 범위 내의 줄 번호는 그대로 유지한다', () => {
    expect(clampLine(5, 10)).toBe(5);
  });

  it('총 줄 수를 넘어서는 줄 번호는 마지막 줄(totalLines - 1)로 고정한다', () => {
    expect(clampLine(15, 10)).toBe(9);
  });

  it('음수 줄 번호는 0으로 고정한다', () => {
    expect(clampLine(-3, 10)).toBe(0);
  });

  it('총 줄 수가 0 이하이면 0을 반환한다', () => {
    expect(clampLine(5, 0)).toBe(0);
  });
});

describe('findClosestPreviewLine', () => {
  it('사용 가능한 줄 목록이 없으면 null을 반환한다', () => {
    expect(findClosestPreviewLine([], 10)).toBeNull();
  });

  it('targetLine 이하에서 가장 가까운(최대) 줄 번호를 반환한다', () => {
    const lines = [0, 5, 12, 20, 35];
    expect(findClosestPreviewLine(lines, 15)).toBe(12);
    expect(findClosestPreviewLine(lines, 20)).toBe(20);
    expect(findClosestPreviewLine(lines, 40)).toBe(35);
  });

  it('모든 줄이 targetLine보다 크면 첫 번째 줄 번호를 반환한다', () => {
    const lines = [10, 20, 30];
    expect(findClosestPreviewLine(lines, 5)).toBe(10);
  });
});

describe('sanitizePositions', () => {
  it('null, undefined, 비객체 입력 시 빈 객체를 반환한다', () => {
    expect(sanitizePositions(null)).toEqual({});
    expect(sanitizePositions(undefined)).toEqual({});
    expect(sanitizePositions('string')).toEqual({});
    expect(sanitizePositions(123)).toEqual({});
    expect(sanitizePositions([1, 2, 3])).toEqual({});
  });

  it('유효하지 않은 필드가 포함된 위치 객체는 제외한다', () => {
    const invalid = {
      doc1: { anchor: 10, head: 10 }, // editorLine, previewLine 누락
      doc2: { anchor: '10', head: 10, editorLine: 0, previewLine: 0 }, // 타입 불일치
      doc3: { anchor: NaN, head: 10, editorLine: 0, previewLine: 0 }, // NaN
    };
    expect(sanitizePositions(invalid)).toEqual({});
  });

  it('정상적인 위치 객체는 올바르게 정리하여 반환한다', () => {
    const valid: Record<string, DocumentPosition> = {
      doc1: { anchor: 10.5, head: 10, editorLine: 5, previewLine: 7 },
      doc2: { anchor: -2, head: 0, editorLine: 0, previewLine: 0 },
    };
    expect(sanitizePositions(valid)).toEqual({
      doc1: { anchor: 10, head: 10, editorLine: 5, previewLine: 7 },
      doc2: { anchor: 0, head: 0, editorLine: 0, previewLine: 0 },
    });
  });
});
