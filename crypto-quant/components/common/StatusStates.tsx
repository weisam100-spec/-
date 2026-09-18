import { AlertCircle, Inbox, Loader2 } from "lucide-react";

export function LoadingState({ label = "資料載入中…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-[var(--color-text-muted)]">
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-[var(--color-down)]/30 bg-[var(--color-down-soft)]/40 py-10 text-center">
      <AlertCircle className="h-6 w-6 text-[var(--color-down)]" aria-hidden />
      <p className="max-w-sm text-sm text-[var(--color-text)]">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 rounded-md border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          重新嘗試
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-[var(--color-text-muted)]">
      <Inbox className="h-6 w-6" aria-hidden />
      <p className="text-sm">{message}</p>
      {hint && <p className="text-xs">{hint}</p>}
    </div>
  );
}
