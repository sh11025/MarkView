/**
 * 고정폭 글꼴 기준 글자 폭 계산.
 * 한글·한자·일본어 등 동아시아 넓은 문자(Fullwidth/Wide)는 폭 2, 그 외는 폭 1.
 */

export function getCharWidth(codePoint: number): number {
  // 널 및 제어 문자 (폭 0)
  if (codePoint < 32 || (codePoint >= 0x7f && codePoint < 0xa0)) {
    return 0;
  }

  // 동아시아 넓은 문자 (Fullwidth / Wide)
  if (
    // 한글 자모 (Hangul Jamo)
    (codePoint >= 0x1100 && codePoint <= 0x11ff) ||
    // CJK 부수, 한중일 기호, 히라가나, 가타카나, 주음부호, 한글 호환 자모, CJK 통합 표의문자
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
    // 한글 음절 (Hangul Syllables)
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    // CJK 호환 표의문자
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    // 세로 쓰기 형태 및 CJK 호환 형태
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
    // 전각 ASCII / 기호 (Fullwidth ASCII variants)
    (codePoint >= 0xff01 && codePoint <= 0xff60) ||
    // 전각 통화·기호
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    // 추가 CJK 통합 표의문자 평면 (SIP / TIP)
    (codePoint >= 0x20000 && codePoint <= 0x2fffd) ||
    (codePoint >= 0x30000 && codePoint <= 0x3fffd)
  ) {
    return 2;
  }

  return 1;
}

/**
 * 문자열 전체의 시각적 너비를 계산한다.
 */
export function getStringWidth(str: string): number {
  let width = 0;
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined) {
      width += getCharWidth(cp);
    }
  }
  return width;
}
