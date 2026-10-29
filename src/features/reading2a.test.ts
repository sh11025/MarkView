import { describe, it, expect } from 'vitest';
import {
  findTextMatches,
  stepMatchIndex,
  formatMatchCount,
} from './search/previewSearch';
import { filterTocItems } from './toc/tocFilter';
import { resolveSaveStatus, formatSaveTime } from './storage/saveStatus';
import {
  THEME_PRESETS,
  REQUIRED_THEME_CSS_VARS,
  REQUIRED_APP_CSS_VARS,
  REQUIRED_DOC_CSS_VARS,
  getContrastRatio,
  resolveThemePresetId,
  isDarkThemePreset,
} from '../constants/themes';
import {
  DEFAULT_SETTINGS,
  sanitizeSettings,
  pickSettings,
  useSettings,
} from '../stores/settings';
import type { TocItem } from '../render/plugins/headings';

describe('읽기 편의 복원 2차-A 단위 테스트', () => {
  describe('1. 미리보기 검색 일치 계산 (한글 부분 일치 · 대소문자 무시)', () => {
    it('한글 부분 문자열 일치를 정확히 찾는다', () => {
      const text = 'MarkView는 마크다운 문서 편집기와 마크다운 뷰어를 결합한 앱입니다.';
      const matches = findTextMatches(text, '마크다운');
      expect(matches).toHaveLength(2);
      expect(text.slice(matches[0].start, matches[0].end)).toBe('마크다운');
      expect(text.slice(matches[1].start, matches[1].end)).toBe('마크다운');
    });

    it('영문 대소문자를 구분하지 않고 찾는다', () => {
      const text = 'MarkView markview MARKVIEW Markview';
      const matches = findTextMatches(text, 'markView');
      expect(matches).toHaveLength(4);
      expect(matches.map((m) => text.slice(m.start, m.end))).toEqual([
        'MarkView',
        'markview',
        'MARKVIEW',
        'Markview',
      ]);
    });

    it('검색어가 비어 있거나 본문이 비어 있으면 빈 배열을 반환한다', () => {
      expect(findTextMatches('안녕하세요', '')).toEqual([]);
      expect(findTextMatches('', '안녕')).toEqual([]);
    });

    it('이전/다음 순환 인덱스(stepMatchIndex)와 개수 문자열(formatMatchCount)을 정확히 계산한다', () => {
      expect(stepMatchIndex(0, 5, 1)).toBe(1);
      expect(stepMatchIndex(4, 5, 1)).toBe(0);
      expect(stepMatchIndex(0, 5, -1)).toBe(4);
      expect(stepMatchIndex(0, 0, 1)).toBe(0);

      expect(formatMatchCount(2, 12)).toBe('3 / 12');
      expect(formatMatchCount(0, 1)).toBe('1 / 1');
      expect(formatMatchCount(0, 0)).toBe('0 / 0');
    });
  });

  describe('2. 목차 필터 · 검색 · 접기 로직', () => {
    const sampleToc: TocItem[] = [
      { id: 'h1-intro', text: '1. 프로젝트 소개', level: 1, line: 0 },
      { id: 'h2-bg', text: '1.1 배경 및 목적', level: 2, line: 5 },
      { id: 'h3-detail', text: '세부 요구사항', level: 3, line: 10 },
      { id: 'h4-deep', text: '심화 참고', level: 4, line: 15 },
      { id: 'h2-arch', text: '1.2 아키텍처 설계', level: 2, line: 20 },
      { id: 'h3- front', text: '프론트엔드 구조', level: 3, line: 25 },
    ];

    it('깊이 필터(전체 / H2까지 / H3까지)에 따라 제목을 필터링한다', () => {
      const all = filterTocItems(sampleToc, { maxLevel: 6, query: '', collapsedIds: [] });
      expect(all.map((i) => i.id)).toEqual([
        'h1-intro',
        'h2-bg',
        'h3-detail',
        'h4-deep',
        'h2-arch',
        'h3- front',
      ]);

      const h2Only = filterTocItems(sampleToc, { maxLevel: 2, query: '', collapsedIds: [] });
      expect(h2Only.map((i) => i.id)).toEqual(['h1-intro', 'h2-bg', 'h2-arch']);
      expect(h2Only[0].hasChildren).toBe(true);
      expect(h2Only[1].hasChildren).toBe(false); // H2까지만 볼 때는 H3가 제외되므로 하위 항목 없음

      const h3Only = filterTocItems(sampleToc, { maxLevel: 3, query: '', collapsedIds: [] });
      expect(h3Only.map((i) => i.id)).toEqual([
        'h1-intro',
        'h2-bg',
        'h3-detail',
        'h2-arch',
        'h3- front',
      ]);
    });

    it('상위 제목을 접으면 그 아래 하위 제목들만 숨기고 다음 형제 제목은 유지한다', () => {
      const collapsedH2 = filterTocItems(sampleToc, {
        maxLevel: 6,
        query: '',
        collapsedIds: ['h2-bg'],
      });
      // h2-bg 아래의 h3-detail, h4-deep은 숨겨지고 h2-arch부터 다시 표시됨
      expect(collapsedH2.map((i) => i.id)).toEqual([
        'h1-intro',
        'h2-bg',
        'h2-arch',
        'h3- front',
      ]);
      expect(collapsedH2.find((i) => i.id === 'h2-bg')?.isCollapsed).toBe(true);

      const collapsedH1 = filterTocItems(sampleToc, {
        maxLevel: 6,
        query: '',
        collapsedIds: ['h1-intro'],
      });
      expect(collapsedH1.map((i) => i.id)).toEqual(['h1-intro']);
    });

    it('목차 검색어 입력 시 접기 상태와 무관하게 한글 부분 일치 항목만 반환한다', () => {
      const searched = filterTocItems(sampleToc, {
        maxLevel: 6,
        query: '구조',
        collapsedIds: ['h1-intro', 'h2-arch'],
      });
      expect(searched.map((i) => i.text)).toEqual(['프론트엔드 구조']);
    });
  });

  describe('3. 저장 상태 결정 순수 함수 (resolveSaveStatus)', () => {
    const fixedTime = new Date(2026, 9, 28, 14, 32, 0).getTime();

    it('임시(메모리) 모드일 때 최우선으로 임시 모드 문구를 반환한다', () => {
      const status = resolveSaveStatus({
        isEphemeral: true,
        persistencePhase: 'saved',
        lastAutosavedAt: fixedTime,
        hasFileHandle: false,
        isDocDirty: true,
      });
      expect(status.kind).toBe('ephemeral');
      expect(status.label).toBe('이 컴퓨터에 저장되지 않는 임시 모드');
    });

    it('저장 오류 상태일 때 "저장 실패 — 다시 시도"와 canRetry=true를 반환한다', () => {
      const status = resolveSaveStatus({
        isEphemeral: false,
        persistencePhase: 'error',
        lastAutosavedAt: fixedTime,
        hasFileHandle: false,
        isDocDirty: true,
      });
      expect(status.kind).toBe('error');
      expect(status.label).toBe('저장 실패 — 다시 시도');
      expect(status.canRetry).toBe(true);
    });

    it('저장 진행 중일 때 "저장 중…"을 반환한다', () => {
      const status = resolveSaveStatus({
        isEphemeral: false,
        persistencePhase: 'saving',
        lastAutosavedAt: null,
        hasFileHandle: false,
        isDocDirty: true,
      });
      expect(status.kind).toBe('saving');
      expect(status.label).toBe('저장 중…');
    });

    it('일반 문서 편집 후 브라우저 자동 저장이 완료되면 "자동 저장됨 HH:MM"을 반환한다', () => {
      expect(formatSaveTime(fixedTime)).toBe('14:32');
      const status = resolveSaveStatus({
        isEphemeral: false,
        persistencePhase: 'saved',
        lastAutosavedAt: fixedTime,
        hasFileHandle: false,
        isDocDirty: true,
      });
      expect(status.kind).toBe('autosaved');
      expect(status.label).toBe('자동 저장됨 14:32');
    });

    it('파일 핸들이 있는 문서에 저장 안 된 변경이 있으면 "저장 안 된 변경 있음"을 반환한다', () => {
      const status = resolveSaveStatus({
        isEphemeral: false,
        persistencePhase: 'saved',
        lastAutosavedAt: fixedTime,
        hasFileHandle: true,
        isDocDirty: true,
      });
      expect(status.kind).toBe('unsaved-changes');
      expect(status.label).toBe('저장 안 된 변경 있음');
    });

    it('파일에 저장했거나 변경 사항이 없으면 "파일로 저장됨"을 반환한다', () => {
      const status = resolveSaveStatus({
        isEphemeral: false,
        persistencePhase: 'saved',
        lastAutosavedAt: fixedTime,
        hasFileHandle: true,
        isDocDirty: false,
      });
      expect(status.kind).toBe('file-saved');
      expect(status.label).toBe('파일로 저장됨');
    });
  });

  describe('4. 테마 프리셋 8종 필수 CSS 변수 및 명도 대비 검증', () => {
    it('8종 테마 프리셋이 모두 존재하고 각각 35개 필수 CSS 변수를 빠짐없이 가진다', () => {
      expect(THEME_PRESETS.map((t) => t.id)).toEqual([
        'github-light',
        'github-dark',
        'dracula',
        'nord',
        'sepia',
        'monokai',
        'tokyo-night',
        'forest',
      ]);

      for (const preset of THEME_PRESETS) {
        for (const cssVar of REQUIRED_THEME_CSS_VARS) {
          expect(
            preset.vars[cssVar],
            `테마 '${preset.id}'에 필수 변수 '${cssVar}'가 정의되어 있어야 함`,
          ).toBeTruthy();
        }
      }
    });

    it('8종 테마 프리셋 모두 본문 배경(--doc-bg) 대비 본문 글자(--doc-text) 및 UI 대비가 4.5:1 이상이다', () => {
      for (const preset of THEME_PRESETS) {
        const docContrast = getContrastRatio(preset.vars['--doc-bg'], preset.vars['--doc-text']);
        expect(
          docContrast,
          `[${preset.name}] 본문 대비(${docContrast.toFixed(2)})가 4.5 이상이어야 함`,
        ).toBeGreaterThanOrEqual(4.5);

        const uiContrast = getContrastRatio(preset.vars['--surface'], preset.vars['--text']);
        expect(
          uiContrast,
          `[${preset.name}] 앱 패널 대비(${uiContrast.toFixed(2)})가 4.5 이상이어야 함`,
        ).toBeGreaterThanOrEqual(4.5);

        const linkTextContrast = getContrastRatio(preset.vars['--doc-link'], preset.vars['--doc-text']);
        expect(
          linkTextContrast,
          `[${preset.name}] 링크(--doc-link)와 본문 글자(--doc-text) 대비(${linkTextContrast.toFixed(2)})가 3.0 이상이어야 함`,
        ).toBeGreaterThanOrEqual(3.0);

        const linkBgContrast = getContrastRatio(preset.vars['--doc-link'], preset.vars['--doc-bg']);
        expect(
          linkBgContrast,
          `[${preset.name}] 링크(--doc-link)와 본문 배경(--doc-bg) 대비(${linkBgContrast.toFixed(2)})가 4.5 이상이어야 함`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('app.css와 document.css에도 모든 테마 셀렉터와 필수 변수가 정의되어 있다', async () => {
      const fsMod = (await import(/* @vite-ignore */ 'node:' + 'fs')) as {
        readFileSync: (url: URL, encoding: string) => string;
      };
      const appCss = fsMod.readFileSync(new URL('../styles/app.css', import.meta.url), 'utf-8');
      const docCss = fsMod.readFileSync(new URL('../styles/document.css', import.meta.url), 'utf-8');

      for (const preset of THEME_PRESETS) {
        expect(appCss).toContain(`[data-theme='${preset.id}']`);
        expect(docCss).toContain(`[data-theme='${preset.id}']`);
      }
      for (const v of REQUIRED_APP_CSS_VARS) {
        expect(appCss).toContain(`${v}:`);
      }
      for (const v of REQUIRED_DOC_CSS_VARS) {
        expect(docCss).toContain(`${v}:`);
      }
    });

    it('resolveThemePresetId와 isDarkThemePreset이 시스템·레거시·프리셋 테마를 올바르게 판별한다', () => {
      expect(resolveThemePresetId('system', false)).toBe('github-light');
      expect(resolveThemePresetId('system', true)).toBe('github-dark');
      expect(resolveThemePresetId('light', true)).toBe('github-light');
      expect(resolveThemePresetId('dark', false)).toBe('github-dark');
      expect(resolveThemePresetId('dracula', false)).toBe('dracula');

      expect(isDarkThemePreset('github-light')).toBe(false);
      expect(isDarkThemePreset('sepia')).toBe(false);
      expect(isDarkThemePreset('github-dark')).toBe(true);
      expect(isDarkThemePreset('dracula')).toBe(true);
      expect(isDarkThemePreset('nord')).toBe(true);
      expect(isDarkThemePreset('monokai')).toBe(true);
      expect(isDarkThemePreset('tokyo-night')).toBe(true);
      expect(isDarkThemePreset('forest')).toBe(true);
    });
  });

  describe('5. 읽기 설정 직렬화 · 복원 · 초기화 검증', () => {
    it('설정을 직렬화(pickSettings)하고 복원(sanitizeSettings)하면 모든 필드가 보존된다', () => {
      useSettings.getState().set({
        theme: 'nord',
        fontSize: 19,
        width: 'wide',
        font: 'rounded',
        lineHeight: 1.95,
        textAlign: 'justify',
        wordBreakKeepAll: false,
        codeBlockWrap: true,
        tocMaxLevel: 3,
      });

      const serialized = JSON.parse(JSON.stringify(pickSettings(useSettings.getState())));
      const restored = sanitizeSettings(serialized);

      expect(restored).toEqual({
        theme: 'nord',
        fontSize: 19,
        width: 'wide',
        font: 'rounded',
        lineHeight: 1.95,
        textAlign: 'justify',
        wordBreakKeepAll: false,
        codeBlockWrap: true,
        tocMaxLevel: 3,
      });

      // 초기화(reset) 검증
      useSettings.getState().reset();
      expect(pickSettings(useSettings.getState())).toEqual(DEFAULT_SETTINGS);
    });

    it('범위를 벗어나거나 잘못된 설정값은 안전하게 보정된다', () => {
      const sanitized = sanitizeSettings({
        theme: 'unknown-theme' as never,
        fontSize: 99,
        lineHeight: 0.5,
        font: 'invalid-font' as never,
        textAlign: 'center' as never,
        tocMaxLevel: 99 as never,
      });
      expect(sanitized.theme).toBe('system');
      expect(sanitized.fontSize).toBe(24);
      expect(sanitized.lineHeight).toBe(1.4);
      expect(sanitized.font).toBe('sans');
      expect(sanitized.textAlign).toBe('left');
      expect(sanitized.tocMaxLevel).toBe(6);
    });
  });
});
