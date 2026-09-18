import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { SIGNAL_TYPE_LABEL, type SignalType } from "@/lib/strategies/types";

const CONFIG: Record<SignalType, { icon: typeof TrendingUp; className: string }> = {
  bullish_candidate: { icon: TrendingUp, className: "text-[var(--color-up)] border-[var(--color-up)]/40 bg-[var(--color-up-soft)]/40" },
  bearish_candidate: { icon: TrendingDown, className: "text-[var(--color-down)] border-[var(--color-down)]/40 bg-[var(--color-down-soft)]/40" },
  watch: { icon: Minus, className: "text-[var(--color-text-muted)] border-[var(--color-border)] bg-[var(--color-surface-raised)]" },
  risk_up: { icon: AlertTriangle, className: "text-[var(--color-warn)] border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10" },
};

export function SignalBadge({ type }: { type: SignalType }) {
  const { icon: Icon, className } = CONFIG[type];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}>
      <Icon className="h-3 w-3" aria-hidden />
      {SIGNAL_TYPE_LABEL[type]}
    </span>
  );
}
