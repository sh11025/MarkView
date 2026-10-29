import type { MarkdownIt } from 'markdown-it';
import { stripLeadingText } from './stripLeadingText';

export interface EmojiCalloutConfig {
  /** 대표 이모지 문자 */
  emoji: string;
  /** 매칭할 변형 문자열들 (Variation Selector 포함/미포함) */
  variants: readonly string[];
  /** CSS 클래스 접미사 (emoji-callout-{kind}) */
  kind: string;
  /** 한국어 설명 이름 */
  label: string;
}

export const SUPPORTED_CALLOUT_EMOJIS: readonly EmojiCalloutConfig[] = [
  { emoji: '💡', variants: ['💡'], kind: 'tip', label: '팁' },
  { emoji: '⚠️', variants: ['⚠️', '⚠'], kind: 'warning', label: '주의' },
  { emoji: '❗', variants: ['❗', '❗️'], kind: 'important', label: '중요' },
  { emoji: '✅', variants: ['✅'], kind: 'success', label: '완료' },
  { emoji: '❌', variants: ['❌'], kind: 'danger', label: '오류' },
  { emoji: 'ℹ️', variants: ['ℹ️', 'ℹ'], kind: 'info', label: '안내' },
  { emoji: '📌', variants: ['📌'], kind: 'note', label: '참고' },
  { emoji: '🔥', variants: ['🔥'], kind: 'fire', label: '핵심' },
  { emoji: '🚨', variants: ['🚨'], kind: 'important', label: '긴급' },
  { emoji: '🛑', variants: ['🛑'], kind: 'danger', label: '경고' },
  { emoji: '📝', variants: ['📝'], kind: 'memo', label: '메모' },
  { emoji: '🎯', variants: ['🎯'], kind: 'target', label: '목표' },
] as const;

export interface MatchedCalloutEmoji {
  config: EmojiCalloutConfig;
  /** 앞쪽에서 소비한 문자열 길이 (이모지 + 뒤따르는 공백) */
  matchedLength: number;
}

/**
 * 문자열 맨 앞이 지원되는 콜아웃 이모지로 시작하는지 판별한다.
 * 이모지 바로 뒤에 공백·줄바꿈이 오거나 텍스트가 이어지는 경우 매칭한다.
 */
export function matchLeadingCalloutEmoji(text: string): MatchedCalloutEmoji | null {
  if (!text) return null;
  for (const cfg of SUPPORTED_CALLOUT_EMOJIS) {
    for (const variant of cfg.variants) {
      if (text.startsWith(variant)) {
        // 변형 선택자(\uFE0F)가 추가로 붙어 있는 경우까지 함께 소비
        let len = variant.length;
        if (text.slice(len).startsWith('\uFE0F')) {
          len += 1;
        }
        const spaceMatch = /^[ \t]*/.exec(text.slice(len));
        if (spaceMatch) {
          len += spaceMatch[0].length;
        }
        return { config: cfg, matchedLength: len };
      }
    }
  }
  return null;
}

/**
 * 이모지 콜아웃 markdown-it 플러그인.
 * 기존 GitHub 스타일 콜아웃(`> [!NOTE]`)은 건드리지 않고,
 * 인용문(`blockquote`) 첫 문단의 첫 글자가 지원 이모지일 때만 이모지별 색 상자로 렌더링한다.
 * 블록 토큰의 `map`(`data-line`)을 그대로 유지하여 편집/미리보기 동기화를 보존한다.
 */
export function emojiCalloutPlugin(md: MarkdownIt): void {
  md.core.ruler.after('github_alerts', 'emoji_callout', (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length - 2; i++) {
      if (tokens[i].type !== 'blockquote_open') continue;
      // 이미 GitHub 콜아웃(callout 클래스)으로 변환된 블록은 건너뛴다
      const existingClass = String(tokens[i].attrGet('class') ?? '');
      if (existingClass.includes('callout')) continue;

      if (tokens[i + 1].type !== 'paragraph_open' || tokens[i + 2].type !== 'inline') continue;

      const inline = tokens[i + 2];
      if (!inline.children || inline.children.length === 0) continue;

      // 첫 번째 자식 텍스트 토큰 또는 inline.content에서 지원 이모지 확인
      const firstChild = inline.children[0];
      const probeText = firstChild.type === 'text' ? firstChild.content : inline.content;
      const matched = matchLeadingCalloutEmoji(probeText);
      if (!matched) continue;

      stripLeadingText(inline.children, matched.matchedLength);

      const iconToken = new state.Token('html_inline', '', 0);
      iconToken.content = `<span class="emoji-callout-icon" aria-hidden="true">${matched.config.emoji}</span>`;
      inline.children.unshift(iconToken);

      tokens[i].attrJoin('class', `callout emoji-callout emoji-callout-${matched.config.kind}`);
      tokens[i].attrSet('data-callout-emoji', matched.config.emoji);
    }
  });
}
