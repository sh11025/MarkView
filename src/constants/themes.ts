/**
 * 테마 프리셋 8종 정의 및 색상 대비 계산 유틸리티.
 * 모든 테마는 CSS 변수 세트로만 정의하며, 본문 스타일 변수는 document.css,
 * 앱 UI 스타일 변수는 app.css와 1:1로 대응한다.
 */

export type PresetThemeId =
  | 'github-light'
  | 'github-dark'
  | 'dracula'
  | 'nord'
  | 'sepia'
  | 'monokai'
  | 'tokyo-night'
  | 'forest';

export type ThemeSetting = 'system' | 'light' | 'dark' | PresetThemeId;

export const REQUIRED_APP_CSS_VARS = [
  '--bg',
  '--surface',
  '--surface-2',
  '--border',
  '--text',
  '--muted',
  '--hover',
  '--accent',
  '--active-line',
  '--selection',
  '--cm-heading',
  '--cm-link',
  '--cm-code',
  '--cm-muted',
  '--cm-accent',
  '--cm-keyword',
  '--cm-string',
  '--cm-number',
  '--cm-function',
] as const;

export const REQUIRED_DOC_CSS_VARS = [
  '--doc-bg',
  '--doc-text',
  '--doc-muted',
  '--doc-border',
  '--doc-link',
  '--doc-code-bg',
  '--doc-inline-code-bg',
  '--doc-table-header',
  '--doc-mark',
  '--hl-keyword',
  '--hl-string',
  '--hl-number',
  '--hl-comment',
  '--hl-function',
  '--hl-type',
  '--hl-variable',
] as const;

export const REQUIRED_THEME_CSS_VARS = [
  ...REQUIRED_APP_CSS_VARS,
  ...REQUIRED_DOC_CSS_VARS,
] as const;

export type ThemeCssVar = (typeof REQUIRED_THEME_CSS_VARS)[number];

export interface ThemePreset {
  id: PresetThemeId;
  name: string;
  isDark: boolean;
  vars: Record<ThemeCssVar, string>;
}

export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    id: 'github-light',
    name: 'GitHub 라이트',
    isDark: false,
    vars: {
      '--bg': '#f6f7f9',
      '--surface': '#ffffff',
      '--surface-2': '#f3f4f6',
      '--border': '#e3e5e8',
      '--text': '#1f2328',
      '--muted': '#59636e',
      '--hover': 'rgba(15, 23, 42, 0.06)',
      '--accent': '#4f46e5',
      '--active-line': 'rgba(79, 70, 229, 0.05)',
      '--selection': 'rgba(79, 70, 229, 0.18)',
      '--cm-heading': '#1e1b4b',
      '--cm-link': '#2563eb',
      '--cm-code': '#b45309',
      '--cm-muted': '#6e7781',
      '--cm-accent': '#4f46e5',
      '--cm-keyword': '#a626a4',
      '--cm-string': '#50a14f',
      '--cm-number': '#986801',
      '--cm-function': '#4078f2',
      '--doc-bg': '#ffffff',
      '--doc-text': '#1f2328',
      '--doc-muted': '#59636e',
      '--doc-border': '#d1d9e0',
      '--doc-link': '#0969da',
      '--doc-code-bg': '#f6f8fa',
      '--doc-inline-code-bg': 'rgba(129, 139, 152, 0.15)',
      '--doc-table-header': '#f6f8fa',
      '--doc-mark': '#fff8c5',
      '--hl-keyword': '#cf222e',
      '--hl-string': '#0a3069',
      '--hl-number': '#0550ae',
      '--hl-comment': '#59636e',
      '--hl-function': '#8250df',
      '--hl-type': '#953800',
      '--hl-variable': '#953800',
    },
  },
  {
    id: 'github-dark',
    name: 'GitHub 다크',
    isDark: true,
    vars: {
      '--bg': '#0d1117',
      '--surface': '#161b22',
      '--surface-2': '#11161d',
      '--border': '#2b323b',
      '--text': '#e6edf3',
      '--muted': '#8b949e',
      '--hover': 'rgba(255, 255, 255, 0.07)',
      '--accent': '#818cf8',
      '--active-line': 'rgba(129, 140, 248, 0.07)',
      '--selection': 'rgba(129, 140, 248, 0.28)',
      '--cm-heading': '#c7d2fe',
      '--cm-link': '#79c0ff',
      '--cm-code': '#f0b46c',
      '--cm-muted': '#8b949e',
      '--cm-accent': '#a5b4fc',
      '--cm-keyword': '#ff7b72',
      '--cm-string': '#a5d6ff',
      '--cm-number': '#79c0ff',
      '--cm-function': '#d2a8ff',
      '--doc-bg': '#0d1117',
      '--doc-text': '#f0f6fc',
      '--doc-muted': '#9198a1',
      '--doc-border': '#3d444d',
      '--doc-link': '#2f81f7',
      '--doc-code-bg': '#151b23',
      '--doc-inline-code-bg': 'rgba(101, 108, 118, 0.3)',
      '--doc-table-header': '#151b23',
      '--doc-mark': 'rgba(187, 128, 9, 0.35)',
      '--hl-keyword': '#ff7b72',
      '--hl-string': '#a5d6ff',
      '--hl-number': '#79c0ff',
      '--hl-comment': '#9198a1',
      '--hl-function': '#d2a8ff',
      '--hl-type': '#ffa657',
      '--hl-variable': '#ffa657',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    isDark: true,
    vars: {
      '--bg': '#21222c',
      '--surface': '#282a36',
      '--surface-2': '#191a21',
      '--border': '#44475a',
      '--text': '#f8f8f2',
      '--muted': '#a9b1d6',
      '--hover': 'rgba(255, 255, 255, 0.07)',
      '--accent': '#bd93f9',
      '--active-line': 'rgba(189, 147, 249, 0.08)',
      '--selection': 'rgba(189, 147, 249, 0.28)',
      '--cm-heading': '#bd93f9',
      '--cm-link': '#8be9fd',
      '--cm-code': '#f1fa8c',
      '--cm-muted': '#9aa5ce',
      '--cm-accent': '#ff79c6',
      '--cm-keyword': '#ff79c6',
      '--cm-string': '#f1fa8c',
      '--cm-number': '#bd93f9',
      '--cm-function': '#50fa7b',
      '--doc-bg': '#21222c',
      '--doc-text': '#f8f8f2',
      '--doc-muted': '#b4befe',
      '--doc-border': '#44475a',
      '--doc-link': '#4190e2',
      '--doc-code-bg': '#1e1f29',
      '--doc-inline-code-bg': 'rgba(68, 71, 90, 0.6)',
      '--doc-table-header': '#282a36',
      '--doc-mark': 'rgba(241, 250, 140, 0.25)',
      '--hl-keyword': '#ff79c6',
      '--hl-string': '#f1fa8c',
      '--hl-number': '#bd93f9',
      '--hl-comment': '#9aa5ce',
      '--hl-function': '#50fa7b',
      '--hl-type': '#8be9fd',
      '--hl-variable': '#ffb86c',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    isDark: true,
    vars: {
      '--bg': '#242933',
      '--surface': '#2e3440',
      '--surface-2': '#3b4252',
      '--border': '#434c5e',
      '--text': '#eceff4',
      '--muted': '#b0bac9',
      '--hover': 'rgba(236, 239, 244, 0.07)',
      '--accent': '#88c0d0',
      '--active-line': 'rgba(136, 192, 208, 0.08)',
      '--selection': 'rgba(136, 192, 208, 0.28)',
      '--cm-heading': '#88c0d0',
      '--cm-link': '#81a1c1',
      '--cm-code': '#ebcb8b',
      '--cm-muted': '#a5b1c2',
      '--cm-accent': '#88c0d0',
      '--cm-keyword': '#81a1c1',
      '--cm-string': '#a3be8c',
      '--cm-number': '#b48ead',
      '--cm-function': '#88c0d0',
      '--doc-bg': '#20252e',
      '--doc-text': '#f6f8fb',
      '--doc-muted': '#b8c2d1',
      '--doc-border': '#434c5e',
      '--doc-link': '#4690d2',
      '--doc-code-bg': '#1c2029',
      '--doc-inline-code-bg': 'rgba(67, 76, 94, 0.6)',
      '--doc-table-header': '#2e3440',
      '--doc-mark': 'rgba(235, 203, 139, 0.25)',
      '--hl-keyword': '#81a1c1',
      '--hl-string': '#a3be8c',
      '--hl-number': '#b48ead',
      '--hl-comment': '#a5b1c2',
      '--hl-function': '#88c0d0',
      '--hl-type': '#8fbcbb',
      '--hl-variable': '#d8dee9',
    },
  },
  {
    id: 'sepia',
    name: 'Sepia',
    isDark: false,
    vars: {
      '--bg': '#f4ecd8',
      '--surface': '#fcf8f2',
      '--surface-2': '#efe4ce',
      '--border': '#dcd2be',
      '--text': '#382f2d',
      '--muted': '#6e5e57',
      '--hover': 'rgba(56, 47, 45, 0.06)',
      '--accent': '#8c6239',
      '--active-line': 'rgba(140, 98, 57, 0.06)',
      '--selection': 'rgba(140, 98, 57, 0.2)',
      '--cm-heading': '#5c3d2e',
      '--cm-link': '#0c69cf',
      '--cm-code': '#8c4a27',
      '--cm-muted': '#76665f',
      '--cm-accent': '#8c6239',
      '--cm-keyword': '#9c3d2b',
      '--cm-string': '#3b6e38',
      '--cm-number': '#8c5218',
      '--cm-function': '#6b428a',
      '--doc-bg': '#fcf8f2',
      '--doc-text': '#211916',
      '--doc-muted': '#6e5e57',
      '--doc-border': '#dcd2be',
      '--doc-link': '#0c69cf',
      '--doc-code-bg': '#f4ecd8',
      '--doc-inline-code-bg': 'rgba(140, 98, 57, 0.14)',
      '--doc-table-header': '#f4ecd8',
      '--doc-mark': '#f3de9a',
      '--hl-keyword': '#9c3d2b',
      '--hl-string': '#2e5e2b',
      '--hl-number': '#8c5218',
      '--hl-comment': '#6e5e57',
      '--hl-function': '#6b428a',
      '--hl-type': '#7a4b2a',
      '--hl-variable': '#7a4b2a',
    },
  },
  {
    id: 'monokai',
    name: 'Monokai',
    isDark: true,
    vars: {
      '--bg': '#1e1f1c',
      '--surface': '#272822',
      '--surface-2': '#1b1c18',
      '--border': '#3e3d32',
      '--text': '#f8f8f2',
      '--muted': '#b2b2a2',
      '--hover': 'rgba(248, 248, 242, 0.07)',
      '--accent': '#a6e22e',
      '--active-line': 'rgba(166, 226, 46, 0.07)',
      '--selection': 'rgba(166, 226, 46, 0.24)',
      '--cm-heading': '#a6e22e',
      '--cm-link': '#66d9ef',
      '--cm-code': '#e6db74',
      '--cm-muted': '#a8a897',
      '--cm-accent': '#f92672',
      '--cm-keyword': '#f92672',
      '--cm-string': '#e6db74',
      '--cm-number': '#ae81ff',
      '--cm-function': '#a6e22e',
      '--doc-bg': '#1e1f1c',
      '--doc-text': '#f8f8f2',
      '--doc-muted': '#b8b8a8',
      '--doc-border': '#3e3d32',
      '--doc-link': '#3391e8',
      '--doc-code-bg': '#181916',
      '--doc-inline-code-bg': 'rgba(62, 61, 50, 0.65)',
      '--doc-table-header': '#272822',
      '--doc-mark': 'rgba(230, 219, 116, 0.25)',
      '--hl-keyword': '#f92672',
      '--hl-string': '#e6db74',
      '--hl-number': '#ae81ff',
      '--hl-comment': '#a8a897',
      '--hl-function': '#a6e22e',
      '--hl-type': '#66d9ef',
      '--hl-variable': '#fd971f',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    isDark: true,
    vars: {
      '--bg': '#16161e',
      '--surface': '#1a1b26',
      '--surface-2': '#24283b',
      '--border': '#292e42',
      '--text': '#c0caf5',
      '--muted': '#9aa5ce',
      '--hover': 'rgba(192, 202, 245, 0.07)',
      '--accent': '#7aa2f7',
      '--active-line': 'rgba(122, 162, 247, 0.08)',
      '--selection': 'rgba(122, 162, 247, 0.26)',
      '--cm-heading': '#7aa2f7',
      '--cm-link': '#7dcfff',
      '--cm-code': '#e0af68',
      '--cm-muted': '#9aa5ce',
      '--cm-accent': '#bb9af7',
      '--cm-keyword': '#bb9af7',
      '--cm-string': '#9ece6a',
      '--cm-number': '#ff9e64',
      '--cm-function': '#7aa2f7',
      '--doc-bg': '#16161e',
      '--doc-text': '#e6ecff',
      '--doc-muted': '#9aa5ce',
      '--doc-border': '#292e42',
      '--doc-link': '#3b82f6',
      '--doc-code-bg': '#121218',
      '--doc-inline-code-bg': 'rgba(41, 46, 66, 0.7)',
      '--doc-table-header': '#24283b',
      '--doc-mark': 'rgba(224, 175, 104, 0.25)',
      '--hl-keyword': '#bb9af7',
      '--hl-string': '#9ece6a',
      '--hl-number': '#ff9e64',
      '--hl-comment': '#9aa5ce',
      '--hl-function': '#7aa2f7',
      '--hl-type': '#2ac3de',
      '--hl-variable': '#c0caf5',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    isDark: true,
    vars: {
      '--bg': '#0b120f',
      '--surface': '#0e1713',
      '--surface-2': '#15221c',
      '--border': '#1e3028',
      '--text': '#ecfdf5',
      '--muted': '#99b8a9',
      '--hover': 'rgba(236, 253, 245, 0.07)',
      '--accent': '#10b981',
      '--active-line': 'rgba(16, 185, 129, 0.08)',
      '--selection': 'rgba(16, 185, 129, 0.25)',
      '--cm-heading': '#6ee7b7',
      '--cm-link': '#34d399',
      '--cm-code': '#fcd34d',
      '--cm-muted': '#8eb0a0',
      '--cm-accent': '#10b981',
      '--cm-keyword': '#34d399',
      '--cm-string': '#a7f3d0',
      '--cm-number': '#fcd34d',
      '--cm-function': '#6ee7b7',
      '--doc-bg': '#0e1713',
      '--doc-text': '#ecfdf5',
      '--doc-muted': '#99b8a9',
      '--doc-border': '#1e3028',
      '--doc-link': '#129666',
      '--doc-code-bg': '#0b120f',
      '--doc-inline-code-bg': 'rgba(30, 48, 40, 0.7)',
      '--doc-table-header': '#15221c',
      '--doc-mark': 'rgba(252, 211, 77, 0.22)',
      '--hl-keyword': '#34d399',
      '--hl-string': '#a7f3d0',
      '--hl-number': '#fcd34d',
      '--hl-comment': '#8eb0a0',
      '--hl-function': '#6ee7b7',
      '--hl-type': '#5eead4',
      '--hl-variable': '#d1fae5',
    },
  },
] as const;

export const THEME_PRESET_MAP: Readonly<Record<PresetThemeId, ThemePreset>> = Object.fromEntries(
  THEME_PRESETS.map((t) => [t.id, t]),
) as unknown as Readonly<Record<PresetThemeId, ThemePreset>>;

/**
 * 저장된 테마 설정값과 시스템 다크 모드 여부를 받아 실제 적용할 프리셋 ID로 변환한다.
 */
export function resolveThemePresetId(setting: ThemeSetting, systemDark: boolean): PresetThemeId {
  if (setting === 'system') {
    return systemDark ? 'github-dark' : 'github-light';
  }
  if (setting === 'light') return 'github-light';
  if (setting === 'dark') return 'github-dark';
  if (setting in THEME_PRESET_MAP) return setting;
  return systemDark ? 'github-dark' : 'github-light';
}

/**
 * 프리셋 ID가 어두운 테마인지 판별한다.
 */
export function isDarkThemePreset(id: string): boolean {
  if (id === 'dark' || id === 'github-dark') return true;
  if (id === 'light' || id === 'github-light') return false;
  const preset = (THEME_PRESET_MAP as Record<string, ThemePreset | undefined>)[id];
  return preset ? preset.isDark : false;
}

/**
 * #rrggbb 또는 rgb(r, g, b) 문자열에서 RGB 값을 추출한다.
 */
export function parseColorRgb(color: string): { r: number; g: number; b: number } {
  const trimmed = color.trim();
  const rgbMatch = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    };
  }
  const hex = trimmed.replace(/^#/, '');
  if (hex.length === 3) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  }
  if (hex.length >= 6) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return { r: 0, g: 0, b: 0 };
}

/**
 * WCAG 2.1 상대 휘도(Relative Luminance) 계산
 */
export function getRelativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const [rs, gs, bs] = [rgb.r, rgb.g, rgb.b].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * 두 색상 문자열 사이의 WCAG 명도 대비율을 계산한다.
 */
export function getContrastRatio(color1: string, color2: string): number {
  const l1 = getRelativeLuminance(parseColorRgb(color1));
  const l2 = getRelativeLuminance(parseColorRgb(color2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
