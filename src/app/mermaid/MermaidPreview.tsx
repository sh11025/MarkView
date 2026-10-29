import React, { useEffect, useState } from 'react';
import { renderMermaid, type DiagramTheme } from '../../render/mermaid';

interface MermaidPreviewProps {
  code: string;
}

export const MermaidPreview: React.FC<MermaidPreviewProps> = ({ code }) => {
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const timer = window.setTimeout(async () => {
      const isDark = document.documentElement.dataset.theme === 'dark';
      const theme: DiagramTheme = isDark ? 'dark' : 'light';

      try {
        const result = await renderMermaid(code, theme);
        if (cancelled) return;
        if ('svg' in result) {
          setSvgHtml(result.svg);
          setErrorMessage(null);
        } else {
          setErrorMessage(result.error);
        }
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [code]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">실시간 미리보기</h4>
        {isLoading && <span className="text-[11px] text-[var(--muted)]">렌더링 중…</span>}
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4 min-h-[220px]">
        {errorMessage ? (
          <div className="w-full text-xs text-error">
            <p className="font-semibold">문법에 오류가 있어 미리보기를 표시할 수 없습니다.</p>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-error/10 p-2 font-mono text-[11px]">
              {errorMessage}
            </pre>
          </div>
        ) : svgHtml ? (
          <div
            className="flex w-full items-center justify-center [&>svg]:max-w-full [&>svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
        ) : (
          <div className="text-xs text-[var(--muted)]">다이어그램을 준비하는 중입니다…</div>
        )}
      </div>
    </div>
  );
};
