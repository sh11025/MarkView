import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
  triggerElement?: HTMLElement | null;
}

export function ImageLightbox({ src, alt, onClose, triggerElement }: ImageLightboxProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // 1. 열릴 때 닫기 버튼에 자동 포커스
    closeBtnRef.current?.focus();

    // 2. 배경 스크롤 잠금
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // 3. Esc 키로 닫기
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      // 4. 닫힐 때 원래 클릭했던 이미지 요소로 포커스 복귀
      if (triggerElement && typeof triggerElement.focus === 'function') {
        try {
          if (!triggerElement.hasAttribute('tabindex')) {
            triggerElement.setAttribute('tabindex', '-1');
          }
          triggerElement.focus();
        } catch {
          // 무시
        }
      }
    };
  }, [onClose, triggerElement]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="이미지 확대 보기"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none outline-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* 닫기 버튼 */}
      <button
        ref={closeBtnRef}
        type="button"
        title="닫기 (Esc)"
        aria-label="닫기"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 flex size-9 items-center justify-center rounded-full bg-neutral-900/80 text-white hover:bg-neutral-800 transition-colors border border-neutral-700 shadow-xl focus:outline-none focus:ring-2 focus:ring-white/60"
      >
        <X className="size-5" />
      </button>

      {/* 이미지 컨테이너 */}
      <div
        className="relative flex max-h-[85vh] max-w-[90vw] items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className="max-h-[85vh] max-w-[90vw] object-contain rounded shadow-2xl cursor-default"
        />
      </div>

      {/* alt 캡션 */}
      {alt && (
        <div
          className="mt-3 max-w-[80vw] truncate rounded-full bg-neutral-900/80 px-4 py-1.5 text-xs text-neutral-200 border border-neutral-700 shadow-lg pointer-events-none"
          title={alt}
        >
          {alt}
        </div>
      )}
    </div>
  );
}

export default ImageLightbox;
