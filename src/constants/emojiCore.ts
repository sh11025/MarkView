/**
 * 즉시 로드되는 필수 이모지 단축코드 사전 (약 110개) 및 지연 로딩(확장 사전 합산 약 310개) 관리 모듈.
 * 동기 렌더링 시에도 핵심 이모지가 즉시 표시되며, 확장 사전이 필요한 경우 비동기로 불러와 재렌더링을 트리거한다.
 */

export const CORE_EMOJIS: Readonly<Record<string, string>> = {
  // 표정 · 감정 (25)
  smile: '😄',
  grinning: '😀',
  grin: '😁',
  joy: '😂',
  rofl: '🤣',
  smiley: '😃',
  sweat_smile: '😅',
  laughing: '😆',
  wink: '😉',
  blush: '😊',
  yum: '😋',
  sunglasses: '😎',
  heart_eyes: '😍',
  kissing_heart: '😘',
  thinking: '🤔',
  neutral_face: '😐',
  expressionless: '😑',
  roll_eyes: '🙄',
  sweat: '😓',
  pensive: '😔',
  confused: '😕',
  sob: '😭',
  cry: '😢',
  angry: '😠',
  rage: '😡',

  // 손동작 · 사람 (15)
  thumbsup: '👍',
  '+1': '👍',
  thumbsdown: '👎',
  '-1': '👎',
  ok_hand: '👌',
  clap: '👏',
  pray: '🙏',
  wave: '👋',
  raised_hands: '🙌',
  muscle: '💪',
  point_right: '👉',
  point_left: '👈',
  point_up: '☝️',
  point_down: '👇',
  eyes: '👀',

  // 하트 · 기호 · 상태 (25)
  heart: '❤️',
  orange_heart: '🧡',
  yellow_heart: '💛',
  green_heart: '💚',
  blue_heart: '💙',
  purple_heart: '💜',
  broken_heart: '💔',
  sparkles: '✨',
  star: '⭐',
  star2: '🌟',
  fire: '🔥',
  zap: '⚡',
  boom: '💥',
  '100': '💯',
  check: '✅',
  white_check_mark: '✅',
  heavy_check_mark: '✔️',
  x: '❌',
  warning: '⚠️',
  exclamation: '❗',
  question: '❓',
  bulb: '💡',
  pushpin: '📌',
  pin: '📌',
  info: 'ℹ️',
  information_source: 'ℹ️',
  rotating_light: '🚨',
  stop_sign: '🛑',

  // 문서 · 업무 · 개발 (25)
  memo: '📝',
  pencil: '✏️',
  book: '📖',
  books: '📚',
  bookmark: '🔖',
  link: '🔗',
  paperclip: '📎',
  file_folder: '📁',
  open_file_folder: '📂',
  calendar: '📅',
  clock: '🕒',
  hourglass: '⏳',
  mag: '🔍',
  lock: '🔒',
  unlock: '🔓',
  key: '🔑',
  shield: '🛡️',
  bell: '🔔',
  rocket: '🚀',
  tada: '🎉',
  trophy: '🏆',
  dart: '🎯',
  bug: '🐛',
  gear: '⚙️',
  wrench: '🔧',
  package: '📦',
  computer: '💻',
  bar_chart: '📊',
  clipboard: '📋',
  coffee: '☕',
  art: '🎨',
};

let activeEmojiMap: Record<string, string> = { ...CORE_EMOJIS };
let extendedLoaded = false;
let loadingPromise: Promise<Record<string, string>> | null = null;
const listeners = new Set<() => void>();

/** 현재 메모리에 로드된 이모지 맵을 반환한다. */
export function getEmojiMap(): Readonly<Record<string, string>> {
  return activeEmojiMap;
}

/** 확장 이모지 사전이 이미 로드되었는지 여부 */
export function isExtendedEmojiLoaded(): boolean {
  return extendedLoaded;
}

/** 확장 이모지 사전 로드 완료 시 호출될 리스너 등록 */
export function onExtendedEmojiLoaded(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 확장 이모지 사전을 동적으로 불러와 병합한다. */
export function loadExtendedEmojis(): Promise<Record<string, string>> {
  if (extendedLoaded) {
    return Promise.resolve(activeEmojiMap);
  }
  if (!loadingPromise) {
    loadingPromise = import('./emojiExtended')
      .then((mod) => {
        activeEmojiMap = { ...CORE_EMOJIS, ...mod.EXTENDED_EMOJIS };
        extendedLoaded = true;
        for (const fn of listeners) {
          try {
            fn();
          } catch {
            // 개별 리스너 오류 무시
          }
        }
        return activeEmojiMap;
      })
      .catch(() => activeEmojiMap);
  }
  return loadingPromise;
}
