import {
  ChevronDown,
  Columns2,
  Download,
  Eye,
  FileArchive,
  FileCode,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  HelpCircle,
  LayoutTemplate,
  Monitor,
  MonitorDown,
  Moon,
  PanelLeft,
  PenLine,
  Printer,
  RotateCcw,
  Save,
  Settings,
  Sun,
} from 'lucide-react';
import { useRef } from 'react';
import { useUi, type ViewMode } from '../stores/ui';
import {
  useSettings,
  type BodyFont,
  type ContentWidth,
  type TextAlign,
  type ThemeSetting,
} from '../stores/settings';
import { THEME_PRESETS, isDarkThemePreset } from '../constants/themes';
import { useResolvedTheme } from './theme';
import { useInstallPrompt } from './pwa';
import { Popover, MenuItem } from './Popover';
import {
  downloadFullBackup,
  downloadMarkdown,
  exportHtml,
  newDocument,
  openFolderFromDisk,
  openFromDisk,
  printDocument,
  saveActive,
} from './fileActions';
import { canUseFolderPicker } from '../storage/folder';
import { useDocuments } from '../stores/documents';
import { getDb } from '../storage/db';

const VIEW_MODES: [ViewMode, typeof Eye, string][] = [
  ['editor', PenLine, '편집'],
  ['split', Columns2, '분할'],
  ['preview', Eye, '미리보기'],
];

function IconButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--hover)]"
    >
      {children}
    </button>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-md border border-[var(--border)] p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`flex-1 whitespace-nowrap rounded px-1.5 py-1 text-xs font-medium ${
            value === v ? 'bg-[var(--accent)] text-[var(--accent-fg,#fff)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const settings = useSettings();
  const activeThemeId: ThemeSetting =
    settings.theme === 'light'
      ? 'github-light'
      : settings.theme === 'dark'
        ? 'github-dark'
        : settings.theme;

  const themeOptions: [ThemeSetting, string, string?][] = [
    ['system', '시스템'],
    ...THEME_PRESETS.map((p): [ThemeSetting, string, string] => [p.id, p.name, p.vars['--doc-bg']]),
  ];

  return (
    <div className="w-80 max-w-[calc(100vw-24px)] space-y-2.5 p-2.5 text-sm">
      <div className="space-y-1">
        <span className="text-xs font-semibold text-[var(--muted)]">테마 프리셋</span>
        <div className="grid grid-cols-3 gap-1" role="group" aria-label="테마 프리셋">
          {themeOptions.map(([id, label, swatchBg]) => {
            const isSelected = activeThemeId === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => settings.update({ theme: id })}
                className={`flex items-center justify-center gap-1 whitespace-nowrap rounded border px-1 py-1 text-[11px] transition-colors ${
                  isSelected
                    ? 'border-[var(--accent)] bg-[var(--accent)] font-semibold text-[var(--accent-fg,#fff)]'
                    : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--hover)]'
                }`}
              >
                {swatchBg && (
                  <span
                    className="size-2.5 shrink-0 rounded-full border border-black/20 dark:border-white/25"
                    style={{ backgroundColor: swatchBg }}
                    aria-hidden="true"
                  />
                )}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="block space-y-1">
          <span className="flex justify-between text-xs font-semibold text-[var(--muted)]">
            글자 크기 <span>{settings.fontSize}px</span>
          </span>
          <input
            type="range"
            aria-label="글자 크기"
            min={13}
            max={22}
            value={settings.fontSize}
            onChange={(e) => settings.update({ fontSize: Number(e.target.value) })}
            className="w-full accent-[var(--accent)]"
          />
        </label>
        <label className="block space-y-1">
          <span className="flex justify-between text-xs font-semibold text-[var(--muted)]">
            줄 간격 <span>{settings.lineHeight.toFixed(2).replace(/\.?0+$/, '')}</span>
          </span>
          <input
            type="range"
            aria-label="줄 간격"
            min={1.4}
            max={2.2}
            step={0.05}
            value={settings.lineHeight}
            onChange={(e) => settings.update({ lineHeight: Number(e.target.value) })}
            className="w-full accent-[var(--accent)]"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="block text-xs font-semibold text-[var(--muted)]">본문 폭</span>
          <Segmented<ContentWidth>
            value={settings.width}
            options={[
              ['narrow', '좁게'],
              ['standard', '보통'],
              ['wide', '넓게'],
            ]}
            onChange={(width) => settings.update({ width })}
          />
        </div>
        <div className="space-y-1">
          <span className="block text-xs font-semibold text-[var(--muted)]">본문 정렬</span>
          <Segmented<TextAlign>
            value={settings.textAlign}
            options={[
              ['left', '왼쪽'],
              ['justify', '양쪽'],
            ]}
            onChange={(textAlign) => settings.update({ textAlign })}
          />
        </div>
      </div>

      <div className="space-y-1">
        <span className="block text-xs font-semibold text-[var(--muted)]">본문 글꼴</span>
        <Segmented<BodyFont>
          value={settings.font}
          options={[
            ['sans', '고딕'],
            ['serif', '명조'],
            ['mono', '고정폭'],
            ['rounded', '둥근 고딕'],
          ]}
          onChange={(font) => settings.update({ font })}
        />
      </div>

      <div className="space-y-1.5 pt-0.5">
        <label className="flex cursor-pointer items-center justify-between text-xs text-[var(--text)]">
          <span>한글 단어 단위 줄바꿈</span>
          <input
            type="checkbox"
            checked={settings.wordBreakKeepAll}
            onChange={(e) => settings.update({ wordBreakKeepAll: e.target.checked })}
            className="size-3.5 accent-[var(--accent)]"
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between text-xs text-[var(--text)]">
          <span>코드블록 줄바꿈</span>
          <input
            type="checkbox"
            checked={settings.codeBlockWrap}
            onChange={(e) => settings.update({ codeBlockWrap: e.target.checked })}
            className="size-3.5 accent-[var(--accent)]"
          />
        </label>
      </div>

      {/* 설정 초기화 및 문제 보고 섹션 */}
      <div className="flex items-center gap-1.5 border-t border-[var(--border)] pt-2.5 mt-1">
        <button
          type="button"
          onClick={() => settings.reset()}
          className="flex items-center justify-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
        >
          <RotateCcw className="size-3 text-[var(--muted)]" />
          <span>설정 초기화</span>
        </button>
        <button
          type="button"
          onClick={() => {
            onClose();
            useUi.getState().openDiagnostics();
          }}
          className="flex-1 flex items-center justify-between px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
        >
          <span>문제 정보 복사…</span>
          <HelpCircle className="size-3.5 text-[var(--muted)]" />
        </button>
      </div>
    </div>
  );
}

export function Header() {
  const viewMode = useUi((s) => s.viewMode);
  const setViewMode = useUi((s) => s.setViewMode);
  const toggleToc = useUi((s) => s.toggleToc);
  const themeSetting = useSettings((s) => s.theme);
  const theme = useResolvedTheme();
  const install = useInstallPrompt();
  const ThemeIcon =
    themeSetting === 'system' ? Monitor : isDarkThemePreset(themeSetting) ? Moon : Sun;
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const handleRestoreFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const { validateBackupJson, planRestore } = await import('../features/backup');
      const val = validateBackupJson(text, file.size);
      if (!val.ok) {
        useUi.getState().pushToast({ text: val.error, kind: 'error' });
        return;
      }

      const existingNames = Object.values(useDocuments.getState().docs).map((d) => d.name);
      let existingAttIds = new Set<string>();
      try {
        const db = await getDb();
        const storedAtts = await db.getAll('attachments');
        existingAttIds = new Set(storedAtts.map((a) => a.id));
      } catch {
        // 임시 모드 또는 IndexedDB 접근 불가 환경에서는 빈 Set으로 안전하게 계속 진행
      }

      const plan = planRestore({
        backup: val.data,
        existingDocNames: existingNames,
        existingAttachmentIds: existingAttIds,
      });

      useUi.getState().openRestoreModal(plan);
    } catch {
      useUi.getState().pushToast({
        text: '백업 파일을 읽을 수 없습니다. 다른 파일을 선택해 주세요.',
        kind: 'error',
      });
    }
  };

  return (
    <header className="no-print flex shrink-0 flex-wrap items-center gap-1 border-b border-[var(--border)] bg-[var(--surface)] px-2 py-1">
      <IconButton title="목차" onClick={toggleToc}>
        <PanelLeft className="size-4" />
      </IconButton>
      <span className="mr-2 hidden px-1 text-sm font-bold tracking-tight sm:inline">MarkView</span>

      <IconButton title="새 문서" onClick={newDocument}>
        <FilePlus className="size-4" />
        <span className="hidden md:inline">새 문서</span>
      </IconButton>
      <IconButton title="템플릿" onClick={useUi.getState().openTemplateGallery}>
        <LayoutTemplate className="size-4" />
        <span className="hidden md:inline">템플릿</span>
      </IconButton>
      <Popover
        title="열기"
        button={
          <>
            <FolderOpen className="size-4" />
            <span className="hidden md:inline">열기</span>
            <ChevronDown className="size-3" />
          </>
        }
      >
        {(close) => (
          <>
            <MenuItem
              onClick={() => {
                close();
                void openFromDisk();
              }}
            >
              <FolderOpen className="size-4" />
              <span>파일 열기</span>
            </MenuItem>
            <MenuItem
              onClick={() => {
                if (!canUseFolderPicker) return;
                close();
                void openFolderFromDisk();
              }}
              disabled={!canUseFolderPicker}
            >
              <Folder className="size-4" />
              <div className="flex flex-col text-left">
                <span>폴더 열기</span>
                {!canUseFolderPicker && (
                  <span className="text-[10px] text-[var(--muted)]">이 브라우저에서는 폴더 열기를 지원하지 않습니다</span>
                )}
              </div>
            </MenuItem>
            <MenuItem
              onClick={() => {
                close();
                restoreInputRef.current?.click();
              }}
            >
              <FileArchive className="size-4" />
              <span>백업에서 복원…</span>
            </MenuItem>
          </>
        )}
      </Popover>
      <Popover
        title="저장"
        button={
          <>
            <Save className="size-4" />
            <span className="hidden md:inline">저장</span>
            <ChevronDown className="size-3" />
          </>
        }
      >
        {(close) => (
          <>
            <MenuItem hint="Ctrl+S" onClick={() => { close(); void saveActive(); }}>
              <Save className="size-4" /> 저장
            </MenuItem>
            <MenuItem onClick={() => { close(); void saveActive(true); }}>
              <Save className="size-4" /> 다른 이름으로 저장
            </MenuItem>
          </>
        )}
      </Popover>
      <Popover
        title="내보내기"
        button={
          <>
            <Download className="size-4" />
            <span className="hidden md:inline">내보내기</span>
            <ChevronDown className="size-3" />
          </>
        }
      >
        {(close) => (
          <>
            <MenuItem onClick={() => { close(); void exportHtml(theme); }}>
              <FileCode className="size-4" /> HTML 파일 (오프라인용)
            </MenuItem>
            <MenuItem onClick={() => { close(); downloadMarkdown(); }}>
              <FileText className="size-4" /> 마크다운 파일 (.md)
            </MenuItem>
            <MenuItem onClick={() => { close(); printDocument(); }}>
              <Printer className="size-4" /> 인쇄 / PDF로 저장
            </MenuItem>
            <MenuItem onClick={() => { close(); void downloadFullBackup(); }}>
              <FileArchive className="size-4" /> 전체 백업 내려받기
            </MenuItem>
          </>
        )}
      </Popover>

      <div className="flex-1" />

      <div className="flex rounded-lg border border-[var(--border)] p-0.5" role="group" aria-label="보기 방식">
        {VIEW_MODES.map(([mode, Icon, label]) => (
          <button
            key={mode}
            type="button"
            title={label}
            aria-pressed={viewMode === mode}
            onClick={() => setViewMode(mode)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
              viewMode === mode ? 'bg-[var(--accent)] text-[var(--accent-fg,#fff)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <Icon className="size-3.5" />
            <span className="hidden lg:inline">{label}</span>
          </button>
        ))}
      </div>

      {install && (
        <IconButton title="앱으로 설치" onClick={install}>
          <MonitorDown className="size-4" />
          <span className="hidden md:inline">설치</span>
        </IconButton>
      )}

      <Popover title="보기 설정" align="right" button={<><ThemeIcon className="size-4" /><Settings className="size-4" /></>}>
        {(close) => <SettingsPanel onClose={close} />}
      </Popover>

      {/* 숨겨진 백업 복원용 파일 인풋 */}
      <input
        ref={restoreInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-hidden="true"
        onChange={handleRestoreFileChange}
      />
    </header>
  );
}
