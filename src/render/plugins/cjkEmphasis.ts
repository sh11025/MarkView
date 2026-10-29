/**
 * @file CJK(한글·한자·일본어) 강조 및 취소선 flanking 규칙 보정 플러그인
 * CommonMark 명세에서 구두점(따옴표, 괄호, 쌍점 등) 바로 뒤에 조사가 띄어쓰기 없이 붙는 경우
 * (예: **"인용"**은, **(괄호)**를, **텍스트:**내용, ~~취소:~~내용)
 * right-flanking이 false로 판정되어 강조가 닫히지 않는 문제를 보정합니다.
 * 원문 정규식 전처리를 일절 하지 않고 markdown-it의 scanDelims 판정을 보정합니다.
 */

import type { MarkdownIt } from 'markdown-it';

/**
 * CJK 문자(한글 음절, 한글 자모, CJK 통합 한자, 히라가나, 가타카나 등)인지 판별합니다.
 */
export function isCjkCharCode(code: number): boolean {
  return (
    (code >= 0xac00 && code <= 0xd7a3) || // 한글 음절 (가-힣)
    (code >= 0x1100 && code <= 0x11ff) || // 한글 자모
    (code >= 0x3130 && code <= 0x318f) || // 한글 호환 자모
    (code >= 0xa960 && code <= 0xa97f) || // 한글 자모 확장-A
    (code >= 0xd7b0 && code <= 0xd7ff) || // 한글 자모 확장-B
    (code >= 0x4e00 && code <= 0x9fff) || // CJK 통합 한자
    (code >= 0x3400 && code <= 0x4dbf) || // CJK 통합 한자 확장-A
    (code >= 0x3040 && code <= 0x309f) || // 히라가나
    (code >= 0x30a0 && code <= 0x30ff)    // 가타카나
  );
}

export function cjkEmphasisPlugin(md: MarkdownIt): void {
  const OriginalState = md.inline.State;

  // 플러그인이 중복 적용되는 것을 방지
  if ((OriginalState as any).__cjkPatched) return;

  /**
   * 전역 StateInline.prototype을 직접 변경하지 않고,
   * 해당 md 인스턴스의 State 생성자를 서브클래스로 교체하여 다른 인스턴스/테스트와의 격리를 보장합니다.
   */
  class CjkStateInline extends (OriginalState as any) {
    scanDelims(start: number, canSplitWord: boolean) {
      const res = super.scanDelims(start, canSplitWord);

      // markdown-it에서 *와 ~는 canSplitWord=true, _는 false로 호출된다.
      // 밑줄(_)은 CommonMark의 단어 내 강조 방지(intra-word emphasis 금지) 규칙에 따라
      // canSplitWord=false로 전달되므로, CJK 보정 대상에서 제외하고 원래 결과를 그대로 반환한다.
      if (!canSplitWord) return res;

      // 이미 열기/닫기 모두 가능한 delimiter라면 추가 보정 불필요
      if (res.can_open && res.can_close) return res;

      const max = this.posMax;

      // delimiter 바로 앞 문자(lastChar) 조회
      let lastChar = 32;
      if (start === 1) {
        lastChar = this.src.charCodeAt(0);
      } else if (start > 1) {
        lastChar = this.src.charCodeAt(start - 1);
      }

      // delimiter 바로 뒤 문자(nextChar) 조회
      const pos = start + res.length;
      const nextChar = pos < max ? this.src.charCodeAt(pos) : 32;

      const isLastCjk = isCjkCharCode(lastChar);
      const isNextCjk = isCjkCharCode(nextChar);

      // 1. 닫는 delimiter 보정:
      // 앞이 구두점(따옴표, 괄호, 콜론 등)이고 뒤가 CJK 문자(은, 를, 내용 등)인 경우
      // 표준 CommonMark는 right-flanking을 거부하지만 CJK 문법상 반드시 닫힐 수 있어야 함
      if (!res.can_close && isNextCjk) {
        res.can_close = true;
      }

      // 2. 여는 delimiter 보정:
      // 앞이 CJK 문자이고 뒤가 구두점인 경우 열릴 수 있어야 함
      if (!res.can_open && isLastCjk) {
        res.can_open = true;
      }

      return res;
    }
  }

  (CjkStateInline as any).__cjkPatched = true;
  md.inline.State = CjkStateInline as any;
}
