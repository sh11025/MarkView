import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** 버튼을 누르면 아래로 열리는 작은 메뉴. 바깥 클릭·Esc로 닫힌다. */
export function Popover({
  button,
  title,
  align = 'left',
  children,
}: {
  button: ReactNode;
  title: string;
  align?: 'left' | 'right';
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // 좁은 화면에서 팝오버가 화면 오른쪽/왼쪽 바깥으로 삐져나가지 않도록 위치 자동 보정
  useLayoutEffect(() => {
    if (!open || !popoverRef.current) return;
    const el = popoverRef.current;
    el.style.transform = '';
    const rect = el.getBoundingClientRect();
    const padding = 8;
    const vw = window.innerWidth;

    if (rect.right > vw - padding) {
      const overflow = rect.right - (vw - padding);
      el.style.transform = `translateX(-${overflow}px)`;
    } else if (rect.left < padding) {
      const underflow = padding - rect.left;
      el.style.transform = `translateX(${underflow}px)`;
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={title}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--hover)]"
      >
        {button}
      </button>
      {open && (
        <div
          ref={popoverRef}
          className={`absolute top-full z-30 mt-1 min-w-48 max-w-[calc(100vw-16px)] rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 shadow-xl ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  onClick,
  children,
  hint,
  disabled = false,
}: {
  onClick: () => void;
  children: ReactNode;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={`flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-sm ${
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-[var(--hover)]'
      }`}
    >
      <span className="flex flex-1 items-center gap-2">{children}</span>
      {hint && <span className="text-xs text-[var(--muted)]">{hint}</span>}
    </button>
  );
}
