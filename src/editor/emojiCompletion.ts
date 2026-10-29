/**
 * 에디터에서 `:sm`처럼 콜론(`:`) 뒤 두 글자 이상 입력했을 때 뜨는 이모지 자동완성 (CodeMirror Autocomplete).
 */
import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import {
  getEmojiMap,
  isExtendedEmojiLoaded,
  loadExtendedEmojis,
} from '../constants/emojiCore';

export function emojiCompletions(context: CompletionContext): CompletionResult | null {
  // 명시적 트리거(startCompletion 등)일 때는 ':' 단독이어도 전체/자주 쓰는 목록을 표시하고, 자동 트리거일 때는 2글자 이상 요구
  const pattern = context.explicit ? /:([a-zA-Z0-9_+-]*)$/ : /:([a-zA-Z0-9_+-]{2,})$/;
  const match = context.matchBefore(pattern);
  if (!match) return null;

  const line = context.state.doc.lineAt(match.from);
  const offsetInLine = match.from - line.from;
  // URL(http://...)이나 시각(12:30) 중간의 콜론에서는 열리지 않도록 앞 글자 검사
  if (offsetInLine > 0) {
    const prevChar = line.text[offsetInLine - 1];
    if (/[a-zA-Z0-9/\\]/.test(prevChar)) return null;
  }

  // 확장 이모지 사전이 아직 로드되지 않았다면 백그라운드에서 불러온다
  if (!isExtendedEmojiLoaded()) {
    void loadExtendedEmojis();
  }

  const query = match.text.slice(1).toLowerCase();
  const map = getEmojiMap();

  const startsWithMatches: { name: string; emoji: string }[] = [];
  const includesMatches: { name: string; emoji: string }[] = [];

  for (const [name, emoji] of Object.entries(map)) {
    const lower = name.toLowerCase();
    if (lower.startsWith(query)) {
      startsWithMatches.push({ name, emoji });
    } else if (lower.includes(query)) {
      includesMatches.push({ name, emoji });
    }
  }

  startsWithMatches.sort((a, b) => a.name.localeCompare(b.name));
  includesMatches.sort((a, b) => a.name.localeCompare(b.name));

  const combined = [...startsWithMatches, ...includesMatches].slice(0, 24);
  if (combined.length === 0) return null;

  const options = combined.map(({ name, emoji }) => ({
    label: `:${name}:`,
    displayLabel: `${emoji} :${name}:`,
    section: '이모지',
    apply: `${emoji}`,
  }));

  return {
    from: match.from,
    to: match.to,
    options,
    filter: false,
  };
}
