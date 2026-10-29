import type { Token } from 'markdown-it';

/** inline 토큰의 children 앞쪽 텍스트에서 `count`글자를 지운다. 여러 text 토큰에 걸쳐 있어도 처리한다. */
export function stripLeadingText(children: Token[], count: number): void {
  let remaining = count;
  while (remaining > 0 && children.length > 0) {
    const first = children[0];
    if (first.type !== 'text') break;
    if (first.content.length <= remaining) {
      remaining -= first.content.length;
      children.shift();
    } else {
      first.content = first.content.slice(remaining);
      remaining = 0;
    }
  }
}
