import { useEffect, useSyncExternalStore } from 'react';
import { useSettings } from '../stores/settings';
import { isDarkThemePreset, resolveThemePresetId, type PresetThemeId } from '../constants/themes';

const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const subscribe = (cb: () => void) => {
  mq?.addEventListener('change', cb);
  return () => mq?.removeEventListener('change', cb);
};
const getSnapshot = () => mq?.matches ?? false;

/**
 * 현재 설정과 시스템 다크 모드 여부를 바탕으로 실제 적용할 프리셋 ID(8종 중 하나)를 반환한다.
 */
export function useResolvedPresetTheme(): PresetThemeId {
  const theme = useSettings((s) => s.theme);
  const systemDark = useSyncExternalStore(subscribe, getSnapshot, () => false);
  return resolveThemePresetId(theme, systemDark);
}

/**
 * 다이어그램(Mermaid) 및 내보내기 등에서 사용하는 밝기 구분('light' | 'dark')을 반환하며,
 * <html data-theme="..."> 속성을 현재 테마 프리셋에 맞게 동기화한다.
 */
export function useResolvedTheme(): 'light' | 'dark' {
  const theme = useSettings((s) => s.theme);
  const systemDark = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const presetId = resolveThemePresetId(theme, systemDark);
  const isDark = isDarkThemePreset(presetId);

  useEffect(() => {
    let dataTheme: string = presetId;
    if (theme === 'light') dataTheme = 'light';
    else if (theme === 'dark') dataTheme = 'dark';
    else if (theme === 'system') dataTheme = systemDark ? 'dark' : 'light';
    document.documentElement.dataset.theme = dataTheme;
    document.documentElement.dataset.colorScheme = isDark ? 'dark' : 'light';
  }, [theme, presetId, systemDark, isDark]);

  return isDark ? 'dark' : 'light';
}

export function useApplyTheme(): void {
  useResolvedTheme();
}
