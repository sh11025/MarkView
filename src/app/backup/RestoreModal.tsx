import React, { useEffect, useRef } from 'react';
import type { RestorePlan } from '../../features/backup';
import { FileArchive, AlertCircle, X } from 'lucide-react';

interface RestoreModalProps {
  isOpen: boolean;
  plan: RestorePlan | null;
  onConfirm: () => void;
  onCancel: () => void;
  isRestoring?: boolean;
}

export const RestoreModal: React.FC<RestoreModalProps> = ({
  isOpen,
  plan,
  onConfirm,
  onCancel,
  isRestoring = false,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isRestoring) {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isRestoring, onCancel]);

  if (!isOpen || !plan) return null;

  const { docCount, attachmentCount } = plan.summary;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="백업 복원"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-5 backdrop-blur-sm outline-none"
      onClick={(e) => e.target === e.currentTarget && !isRestoring && onCancel()}
    >
      <div className="relative flex flex-col w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden text-[var(--text)]">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 bg-[var(--surface-2)]">
          <div className="flex items-center gap-2">
            <FileArchive className="size-4 text-[var(--accent)]" />
            <h2 className="text-sm font-bold text-[var(--text)]">백업에서 복원</h2>
          </div>
          <button
            type="button"
            disabled={isRestoring}
            onClick={onCancel}
            aria-label="닫기"
            className="rounded p-1 text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors disabled:opacity-40"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 모달 본문 */}
        <div className="p-5 space-y-4 text-xs sm:text-sm">
          <p className="leading-relaxed text-[var(--text)]">
            문서 <strong className="font-semibold text-[var(--accent)]">{docCount}개</strong>
            {attachmentCount > 0 ? (
              <>
                , 이미지 <strong className="font-semibold text-[var(--accent)]">{attachmentCount}개</strong>
              </>
            ) : null}
            를 불러옵니다. 현재 열려 있는 문서는 그대로 두고, 복원한 문서를 새 탭으로 추가합니다.
          </p>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--muted)]">
            <AlertCircle className="size-4 text-amber-500 shrink-0 mt-0.5" />
            <span>설정은 복원되지 않습니다. (현재 사용 중인 테마 및 보기 설정 유지)</span>
          </div>
        </div>

        {/* 모달 하단 액션 버튼 */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-4 py-3 bg-[var(--surface-2)]">
          <button
            type="button"
            disabled={isRestoring}
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--hover)] transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            disabled={isRestoring}
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isRestoring ? '복원 진행 중…' : '복원하기'}
          </button>
        </div>
      </div>
    </div>
  );
};
