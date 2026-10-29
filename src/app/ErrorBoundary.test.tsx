// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { getRecentErrors } from '../features/diagnostics/errorCollector';

// 콘솔 에러 출력을 억제하여 테스트 로그를 깨끗하게 유지
const originalConsoleError = console.error;

describe('ErrorBoundary (오류 경계 컴포넌트)', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    console.error = vi.fn();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    console.error = originalConsoleError;
  });

  // 에러 발생을 시뮬레이션하는 테스트용 컴포넌트
  const Bomb: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
    if (shouldThrow) {
      throw new Error('테스트용 렌더링 예외 발생');
    }
    return <div>정상 렌더링 완료</div>;
  };

  it('자식 컴포넌트가 예외를 던지면 전체화면 fallback 안내 화면을 표시하고 에러를 수집한다', () => {
    act(() => {
      root!.render(
        <ErrorBoundary mode="fullscreen">
          <Bomb shouldThrow={true} />
        </ErrorBoundary>,
      );
    });

    expect(container?.textContent).toContain('문제가 발생했습니다');
    expect(container?.textContent).toContain('작성한 글은 이 브라우저에 저장되어 있습니다');
    expect(container?.querySelector('button')?.textContent).toBe('다시 시도');

    // 전역 errorCollector에 'react' 타입으로 수집되었는지 확인
    const recent = getRecentErrors();
    expect(recent.length).toBeGreaterThanOrEqual(1);
    expect(recent[recent.length - 1].type).toBe('react');
    expect(recent[recent.length - 1].message).toContain('테스트용 렌더링 예외 발생');
  });

  it('오류 발생 후 "다시 시도" 버튼을 누르면 오류 상태를 초기화하고 정상 화면을 복구한다', () => {
    const TestParent: React.FC = () => {
      const [shouldThrow, setShouldThrow] = useState(true);
      return (
        <div>
          <button id="fix-btn" onClick={() => setShouldThrow(false)}>
            문제 해결
          </button>
          <ErrorBoundary mode="fullscreen">
            <Bomb shouldThrow={shouldThrow} />
          </ErrorBoundary>
        </div>
      );
    };

    act(() => {
      root!.render(<TestParent />);
    });

    // 최초에는 에러 화면 표시
    expect(container?.textContent).toContain('문제가 발생했습니다');

    // 원인 해소 버튼 클릭
    const fixBtn = container?.querySelector('#fix-btn') as HTMLButtonElement;
    act(() => {
      fixBtn.click();
    });

    // ErrorBoundary의 "다시 시도" 버튼 클릭
    const retryBtn = Array.from(container?.querySelectorAll('button') || []).find(
      (b) => b.textContent === '다시 시도',
    );
    expect(retryBtn).toBeDefined();

    act(() => {
      retryBtn?.click();
    });

    // 정상 화면으로 복원 확인
    expect(container?.textContent).toContain('정상 렌더링 완료');
    expect(container?.textContent).not.toContain('문제가 발생했습니다');
  });

  it('모달 모드(mode="modal")에서는 작은 안내 UI와 닫기 버튼을 표시하고 onClose 콜백을 호출한다', () => {
    const handleClose = vi.fn();

    act(() => {
      root!.render(
        <ErrorBoundary mode="modal" onClose={handleClose}>
          <Bomb shouldThrow={true} />
        </ErrorBoundary>,
      );
    });

    expect(container?.textContent).toContain('편집 창에서 문제가 발생했습니다');
    expect(container?.textContent).toContain('작업 중인 메인 문서는 안전하게 유지되고 있습니다');

    const closeBtn = Array.from(container?.querySelectorAll('button') || []).find(
      (b) => b.textContent === '닫기',
    );
    expect(closeBtn).toBeDefined();

    act(() => {
      closeBtn?.click();
    });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('전체화면 오류 시 "글 백업 내려받기" 버튼은 readBackupSourceFromDatabase를 호출하고 실패 시 안내창을 띄운다', async () => {
    const backupStorage = await import('../storage/backupStorage');
    const dbBackupSpy = vi.spyOn(backupStorage, 'readBackupSourceFromDatabase').mockRejectedValueOnce(new Error('DB failure'));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    act(() => {
      root!.render(
        <ErrorBoundary mode="fullscreen">
          <Bomb shouldThrow={true} />
        </ErrorBoundary>,
      );
    });

    const backupBtn = Array.from(container?.querySelectorAll('button') || []).find(
      (b) => b.textContent?.includes('글 백업 내려받기'),
    );
    expect(backupBtn).toBeDefined();

    await act(async () => {
      backupBtn?.click();
    });

    // 독립 DB 경로를 호출했는지 확인
    expect(dbBackupSpy).toHaveBeenCalled();
    // 실패 시 사용자에게 친절한 한국어 안내를 표시했는지 확인
    expect(alertSpy).toHaveBeenCalledWith(
      "저장소에서 글을 읽을 수 없습니다. 브라우저를 새로고침한 뒤 '저장'으로 파일에 보관해 보세요.",
    );

    dbBackupSpy.mockRestore();
    alertSpy.mockRestore();
  });
});
