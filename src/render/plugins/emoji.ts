import type { MarkdownIt } from 'markdown-it';
import {
  getEmojiMap,
  isExtendedEmojiLoaded,
  loadExtendedEmojis,
} from '../../constants/emojiCore';

const EMOJI_SHORTCODE_RE = /:([a-zA-Z0-9_+-]+):/g;
const URL_LIKE_RE = /^https?:\/\/\S+$/i;

/**
 * 텍스트 안의 `:shortcode:`를 등록된 이모지 문자로 치환한다.
 * 알 수 없는 단축코드는 원문 그대로 보존하며, 확장 사전이 아직 로드되지 않았으면 비동기 로드를 요청한다.
 */
export function replaceEmojiShortcodesInText(text: string): string {
  if (!text.includes(':')) return text;
  const map = getEmojiMap();
  let needsExtended = false;

  const replaced = text.replace(EMOJI_SHORTCODE_RE, (fullMatch, rawName: string) => {
    const key = rawName.toLowerCase();
    const emoji = map[key] ?? map[rawName];
    if (emoji) return emoji;
    if (!isExtendedEmojiLoaded()) {
      needsExtended = true;
    }
    return fullMatch;
  });

  if (needsExtended) {
    void loadExtendedEmojis();
  }
  return replaced;
}

/**
 * markdown-it 이모지 단축코드 플러그인.
 * 원문 정규식 전처리 없이 inline 토큰의 text 자식 토큰만 변환하므로
 * 코드 블록(fence/code_block), 인라인 코드(code_inline), 링크 URL 속성은 절대 변환하지 않는다.
 */
export function emojiPlugin(md: MarkdownIt): void {
  md.core.ruler.before('github_alerts', 'emoji_shortcode', (state) => {
    for (const blockToken of state.tokens) {
      if (blockToken.type !== 'inline' || !blockToken.children) continue;

      let inAutoLink = 0;
      for (const child of blockToken.children) {
        if (child.type === 'link_open') {
          if (child.markup === 'linkify' || child.info === 'auto') {
            inAutoLink++;
          }
          continue;
        }
        if (child.type === 'link_close') {
          if (inAutoLink > 0) inAutoLink--;
          continue;
        }
        if (child.type !== 'text') continue;
        if (inAutoLink > 0 || URL_LIKE_RE.test(child.content.trim())) continue;

        if (child.content.includes(':')) {
          child.content = replaceEmojiShortcodesInText(child.content);
        }
      }
    }
  });
}
