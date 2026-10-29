import React, { useState } from 'react';
import { getEnvironmentNotice, isBannerDismissed, dismissBanner } from '../features/environment/banner';
import { Info, X } from 'lucide-react';

interface EnvironmentBannerProps {
  isInMemoryMode: boolean;
}

export const EnvironmentBanner: React.FC<EnvironmentBannerProps> = ({ isInMemoryMode }) => {
  const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
  const notice = getEnvironmentNotice({ isFileProtocol, isInMemoryMode });

  // file: 단독 배너의 경우 닫기 기억 가능, 임시 모드는 중요한 경고이므로 세션마다 닫을 수만 있음
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (!isInMemoryMode && isFileProtocol) {
      return isBannerDismissed();
    }
    return false;
  });

  if (!notice || dismissed) return null;

  const handleClose = () => {
    setDismissed(true);
    if (!isInMemoryMode && isFileProtocol) {
      dismissBanner();
    }
  };

  return (
    <aside
      className="no-print relative z-30 flex items-center justify-between gap-3 border-b border-warning/30 bg-warning/15 px-4 py-2 text-xs text-warning-text dark:text-warning"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <Info className="size-4 shrink-0" />
        <span>{notice}</span>
      </div>
      <button
        type="button"
        className="rounded p-1 text-[var(--muted)] hover:bg-black/10 hover:text-[var(--text)] dark:hover:bg-white/10"
        onClick={handleClose}
        title="배너 닫기"
        aria-label="배너 닫기"
      >
        <X className="size-3.5" />
      </button>
    </aside>
  );
};
