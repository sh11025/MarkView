import { Component, type ErrorInfo, type ReactNode } from 'react';
import { recordError } from '../features/diagnostics/errorCollector';
import { readBackupSourceFromDatabase, triggerBackupDownload } from '../storage/backupStorage';
import { buildDiagnosticsReport } from '../features/diagnostics/report';
import { collectDiagnosticsData } from './diagnostics/collectInfo';

interface Props {
  children: ReactNode;
  /** 'fullscreen' (앱 전체) | 'modal' (다이어그램, 템플릿 등 서브 모달) */
  mode?: 'fullscreen' | 'modal';
  /** 모달 모드에서 닫기 버튼 클릭 시 호출할 콜백 */
  onClose?: () => void;
  /** 커스텀 폴백 컴포넌트 (선택 사항) */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
  copyFailed: boolean;
  isDownloadingBackup: boolean;
  backupSuccess: boolean;
}

/**
 * 앱 전체 및 모달의 예외를 잡아 하얀 화면(White Screen of Death)을 방지하는 오류 경계
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      copied: false,
      copyFailed: false,
      isDownloadingBackup: false,
      backupSuccess: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 1. 진단 버퍼에 리액트 렌더 에러 기록
    const errorWithStack = new Error(error.message);
    errorWithStack.stack = errorInfo.componentStack || error.stack;
    recordError(errorWithStack, 'react');
    console.error('[MarkView ErrorBoundary]', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      copied: false,
      copyFailed: false,
      backupSuccess: false,
    });
  };

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleCopyDiagnostics = async () => {
    try {
      const data = await collectDiagnosticsData();
      const reportText = buildDiagnosticsReport(data);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(reportText);
        this.setState({ copied: true, copyFailed: false });
        setTimeout(() => this.setState({ copied: false }), 3000);
      } else {
        this.setState({ copyFailed: true });
      }
    } catch (err) {
      console.warn('문제 정보 복사 실패:', err);
      this.setState({ copyFailed: true });
    }
  };

  private handleDownloadBackup = async () => {
    this.setState({ isDownloadingBackup: true, backupSuccess: false });
    try {
      const backup = await readBackupSourceFromDatabase();
      const success = await triggerBackupDownload(backup);
      if (success) {
        this.setState({ backupSuccess: true });
        setTimeout(() => this.setState({ backupSuccess: false }), 4000);
      }
    } catch {
      alert('저장소에서 글을 읽을 수 없습니다. 브라우저를 새로고침한 뒤 \'저장\'으로 파일에 보관해 보세요.');
    } finally {
      this.setState({ isDownloadingBackup: false });
    }
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    // 모달 모드 fallback (작은 알림 및 닫기 버튼)
    if (this.props.mode === 'modal') {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex flex-col items-center justify-center p-6 bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] rounded-xl shadow-xl max-w-md mx-auto my-8 gap-4"
        >
          <div className="flex items-center gap-2 text-rose-500 font-semibold text-sm">
            <svg className="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>편집 창에서 문제가 발생했습니다</span>
          </div>
          <p className="text-xs text-[var(--muted)] text-center">
            작업 중인 메인 문서는 안전하게 유지되고 있습니다.
          </p>
          <button
            type="button"
            onClick={() => {
              this.handleReset();
              this.props.onClose?.();
            }}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--hover)] border border-[var(--border)] transition-colors"
          >
            닫기
          </button>
        </div>
      );
    }

    // 기본 fullscreen 모드 fallback (앱 전체 오류 안내)
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4 bg-[var(--surface)] text-[var(--text)] select-none overflow-y-auto"
      >
        <div className="flex flex-col items-center max-w-lg w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 shadow-2xl text-center gap-5">
          {/* 아이콘 */}
          <div className="size-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          {/* 제목 및 설명 */}
          <div className="space-y-2">
            <h1 className="text-lg sm:text-xl font-bold text-[var(--text)]">문제가 발생했습니다</h1>
            <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
              작성한 글은 이 브라우저에 저장되어 있습니다. 아래 버튼으로 복구해 보세요.
            </p>
          </div>

          {/* 복사/다운로드 완료 알림 메시지 */}
          {this.state.copied && (
            <div className="text-xs text-emerald-500 font-medium">✓ 문제 정보가 클립보드에 복사되었습니다.</div>
          )}
          {this.state.backupSuccess && (
            <div className="text-xs text-emerald-500 font-medium">✓ 전체 백업 파일(.json)이 다운로드되었습니다.</div>
          )}
          {this.state.copyFailed && (
            <div className="text-xs text-amber-500 font-medium">
              클립보드 접근 권한이 없습니다. 새로고침 후 설정 메뉴의 문제 정보 창에서 복사해 주세요.
            </div>
          )}

          {/* 작업 버튼 목록 */}
          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2.5 w-full pt-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
            >
              다시 시도
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold rounded-lg bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--hover)] transition-colors"
            >
              새로고침
            </button>
            <button
              type="button"
              onClick={this.handleCopyDiagnostics}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold rounded-lg bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--hover)] transition-colors"
            >
              문제 정보 복사
            </button>
            <button
              type="button"
              disabled={this.state.isDownloadingBackup}
              onClick={this.handleDownloadBackup}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold rounded-lg bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--hover)] transition-colors disabled:opacity-50"
            >
              {this.state.isDownloadingBackup ? '백업 생성 중…' : '글 백업 내려받기'}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
