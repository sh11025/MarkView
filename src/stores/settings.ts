import { create } from 'zustand';
import { THEME_PRESET_MAP, type ThemeSetting } from '../constants/themes';

export type { ThemeSetting };
export type Theme = ThemeSetting;
export type ContentWidth = 'narrow' | 'standard' | 'wide';
export type BodyFont = 'sans' | 'serif' | 'mono' | 'rounded';
export type TextAlign = 'left' | 'justify';
export type TocMaxLevel = 2 | 3 | 6;

export interface Settings {
  theme: Theme;
  fontSize: number;
  width: ContentWidth;
  font: BodyFont;
  lineHeight: number;
  textAlign: TextAlign;
  wordBreakKeepAll: boolean;
  codeBlockWrap: boolean;
  tocMaxLevel: TocMaxLevel;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  fontSize: 16,
  width: 'standard',
  font: 'sans',
  lineHeight: 1.75,
  textAlign: 'left',
  wordBreakKeepAll: true,
  codeBlockWrap: false,
  tocMaxLevel: 6,
};

const VALID_WIDTHS = new Set<ContentWidth>(['narrow', 'standard', 'wide']);
const VALID_FONTS = new Set<BodyFont>(['sans', 'serif', 'mono', 'rounded']);
const VALID_ALIGNS = new Set<TextAlign>(['left', 'justify']);
const VALID_TOC_LEVELS = new Set<TocMaxLevel>([2, 3, 6]);

function isValidTheme(v: unknown): v is Theme {
  if (typeof v !== 'string') return false;
  if (v === 'system' || v === 'light' || v === 'dark') return true;
  return v in THEME_PRESET_MAP;
}

/**
 * 저장소에서 읽어온 설정 객체를 검증·보정하여 안전한 Settings 객체를 반환한다.
 */
export function sanitizeSettings(raw: Partial<Settings> | Record<string, unknown> | null | undefined): Settings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }
  const r = raw as Record<string, unknown>;

  const theme: Theme = isValidTheme(r.theme) ? r.theme : DEFAULT_SETTINGS.theme;

  const rawFontSize = typeof r.fontSize === 'number' && Number.isFinite(r.fontSize) ? r.fontSize : DEFAULT_SETTINGS.fontSize;
  const fontSize = Math.min(24, Math.max(12, Math.round(rawFontSize)));

  const width: ContentWidth = VALID_WIDTHS.has(r.width as ContentWidth)
    ? (r.width as ContentWidth)
    : DEFAULT_SETTINGS.width;

  const font: BodyFont = VALID_FONTS.has(r.font as BodyFont) ? (r.font as BodyFont) : DEFAULT_SETTINGS.font;

  const rawLineHeight =
    typeof r.lineHeight === 'number' && Number.isFinite(r.lineHeight) ? r.lineHeight : DEFAULT_SETTINGS.lineHeight;
  const lineHeight = Math.round(Math.min(2.2, Math.max(1.4, rawLineHeight)) * 100) / 100;

  const textAlign: TextAlign = VALID_ALIGNS.has(r.textAlign as TextAlign)
    ? (r.textAlign as TextAlign)
    : DEFAULT_SETTINGS.textAlign;

  const wordBreakKeepAll =
    typeof r.wordBreakKeepAll === 'boolean' ? r.wordBreakKeepAll : DEFAULT_SETTINGS.wordBreakKeepAll;

  const codeBlockWrap = typeof r.codeBlockWrap === 'boolean' ? r.codeBlockWrap : DEFAULT_SETTINGS.codeBlockWrap;

  const tocMaxLevel: TocMaxLevel = VALID_TOC_LEVELS.has(r.tocMaxLevel as TocMaxLevel)
    ? (r.tocMaxLevel as TocMaxLevel)
    : DEFAULT_SETTINGS.tocMaxLevel;

  return {
    theme,
    fontSize,
    width,
    font,
    lineHeight,
    textAlign,
    wordBreakKeepAll,
    codeBlockWrap,
    tocMaxLevel,
  };
}

interface SettingsState extends Settings {
  set: (patch: Partial<Settings>) => void;
  update: (patch: Partial<Settings>) => void;
  hydrate: (s: Partial<Settings>) => void;
  reset: () => void;
}

function getInitialTheme(): Theme {
  try {
    const mirrored = typeof localStorage !== 'undefined' ? localStorage.getItem('markview-theme') : null;
    if (isValidTheme(mirrored)) return mirrored;
  } catch {
    // 무시
  }
  return DEFAULT_SETTINGS.theme;
}

export const useSettings = create<SettingsState>((set) => ({
  ...DEFAULT_SETTINGS,
  theme: getInitialTheme(),
  set: (patch) =>
    set((state) => {
      const merged = sanitizeSettings({ ...state, ...patch });
      return merged;
    }),
  update: (patch) =>
    set((state) => {
      const merged = sanitizeSettings({ ...state, ...patch });
      return merged;
    }),
  hydrate: (s) => set(() => sanitizeSettings(s)),
  reset: () => set(() => ({ ...DEFAULT_SETTINGS })),
}));

export function pickSettings(s: Settings): Settings {
  return {
    theme: s.theme,
    fontSize: s.fontSize,
    width: s.width,
    font: s.font,
    lineHeight: s.lineHeight,
    textAlign: s.textAlign,
    wordBreakKeepAll: s.wordBreakKeepAll,
    codeBlockWrap: s.codeBlockWrap,
    tocMaxLevel: s.tocMaxLevel,
  };
}
