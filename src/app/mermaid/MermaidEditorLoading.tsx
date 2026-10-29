import React from 'react';

/** 다이어그램 편집기 청크를 지연 로딩하는 동안 표시되는 로딩 대화 상자 */
export const MermaidEditorLoading: React.FC = () => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label="편집기를 여는 중…"
    >
      <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 shadow-xl">
        <svg
          className="size-5 animate-spin text-[var(--accent)]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="text-sm font-medium text-[var(--text)]">편집기를 여는 중…</span>
      </div>
    </div>
  );
};
