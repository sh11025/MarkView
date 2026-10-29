import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useUi } from '../stores/ui';

const ICONS = { info: Info, success: CheckCircle2, error: AlertCircle };

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);

  return (
    <div className="no-print pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg ${
              t.kind === 'error'
                ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)]'
            }`}
          >
            <Icon className={`mt-0.5 size-4 shrink-0 ${t.kind === 'success' ? 'text-emerald-500' : t.kind === 'info' ? 'text-[var(--accent)]' : ''}`} />
            <span className="flex-1">{t.text}</span>
            {t.actions && t.actions.length > 0 ? (
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                {t.actions.map((act) => (
                  <button
                    key={act.label}
                    type="button"
                    onClick={() => {
                      act.run();
                      dismiss(t.id);
                    }}
                    className="shrink-0 font-semibold text-[var(--accent)] hover:underline"
                  >
                    {act.label}
                  </button>
                ))}
              </div>
            ) : t.action ? (
              <button
                type="button"
                onClick={() => {
                  t.action!.run();
                  dismiss(t.id);
                }}
                className="shrink-0 font-semibold text-[var(--accent)] hover:underline"
              >
                {t.action.label}
              </button>
            ) : null}
            {(t.sticky || t.action || (t.actions && t.actions.length > 0)) && (
              <button type="button" title="닫기" onClick={() => dismiss(t.id)} className="shrink-0 opacity-60 hover:opacity-100">
                <X className="size-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
