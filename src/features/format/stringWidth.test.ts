import { describe, expect, it } from 'vitest';
import { getCharWidth, getStringWidth } from './stringWidth';

describe('stringWidth', () => {
  it('영문, 숫자, 기본 기호의 폭은 1이다', () => {
    expect(getStringWidth('abc')).toBe(3);
    expect(getStringWidth('123')).toBe(3);
    expect(getStringWidth('+-*/')).toBe(4);
    expect(getStringWidth('hello world')).toBe(11);
  });

  it('한글, 한자, 일본어(히라가나/가타카나)의 폭은 2이다', () => {
    expect(getStringWidth('한글')).toBe(4);
    expect(getStringWidth('漢字')).toBe(4);
    expect(getStringWidth('かな')).toBe(4);
    expect(getStringWidth('カナ')).toBe(4);
  });

  it('한글과 영문, 기호가 섞인 문자열의 폭을 올바르게 계산한다', () => {
    expect(getStringWidth('MarkView 시작하기')).toBe(8 + 1 + 8); // 17
    expect(getStringWidth('| 이름 | 값 |')).toBe(1 + 1 + 4 + 1 + 1 + 1 + 2 + 1 + 1); // 13
  });

  it('제어 문자는 폭 0으로 계산한다', () => {
    expect(getCharWidth(0)).toBe(0);
    expect(getCharWidth(10)).toBe(0); // \n
  });
});
