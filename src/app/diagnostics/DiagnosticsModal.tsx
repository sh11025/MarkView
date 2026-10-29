import React, { useState, useEffect, useRef } from 'react';
import { collectDiagnosticsData } from './collectInfo';
import { buildDiagnosticsReport } from '../../features/diagnostics/report';
import { Copy, Check, X, AlertCircle } from 'lucide-react';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({ isOpen, onClose }) => {
  const [reportText, setReportText] = useState<string>('정보를 수집하는 중…');
  const [copied, setCopied] = useState<boolean>(false);
  const [copyFailed, setCopyFailed] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setCopied(false);
    setCopyFailed(false);

    collectDiagnosticsData().then((data) => {
      if (isMounted) {
        const text = buildDiagnosticsReport(data);
        setReportText(text);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Esc 키 닫기 및 포커스 관리
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(reportText);
        setCopied(true);
        setCopyFailed(false);
        setTimeout(() => setCopied(false), 2500);
      } else {
        throw new Error('클립보드 API 미지원');
      }
    } catch {
      setCopyFailed(true);
      // 복사 실패 시 사용자가 직접 복사할 수 있도록 textarea 텍스트 선택
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
      }
    }
  };

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="문제 정보"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-5 backdrop-blur-sm outline-none"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden text-[var(--text)]">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 bg-[var(--surface-2)]">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[var(--text)]">문제 정보 복사</h2>
            <span className="text-[11px] text-[var(--muted)] font-normal hidden sm:inline">
              (개발자·AI 지원용)
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="문제 정보 창 닫기"
            className="rounded p-1 text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 안내 문구 */}
        <div className="px-4 py-2.5 bg-indigo-500/10 border-b border-[var(--border)] text-xs text-[var(--text)] flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0 text-indigo-500" />
          <span>글 내용과 파일 이름은 포함되지 않습니다. 안심하고 복사해 전달하세요.</span>
        </div>

        {/* 복사 대상 텍스트 영역 */}
        <div className="flex-1 p-4 overflow-hidden flex flex-col min-h-[220px]">
          <textarea
            ref={textareaRef}
            readOnly
            value={reportText}
            className="flex-1 w-full p-3 font-mono text-xs leading-relaxed rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] resize-none outline-none focus:ring-1 focus:ring-[var(--accent)]"
            aria-label="복사될 문제 정보 내용"
          />
        </div>

        {/* 복사 실패 안내 문구 */}
        {copyFailed && (
          <div className="px-4 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs text-center border-t border-[var(--border)]">
            클립보드 접근이 제한되었습니다. 위 상자의 내용을 직접 선택해서 복사하세요.
          </div>
        )}

        {/* 모달 하단 버튼 바 */}
        <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 bg-[var(--surface-2)] gap-2">
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            {copied && '✓ 클립보드에 복사되었습니다!'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              <span>{copied ? '복사 완료' : '복사'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
