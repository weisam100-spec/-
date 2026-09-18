import { AlertTriangle } from "lucide-react";

export function RiskBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 px-3 py-2 text-xs leading-relaxed text-[var(--color-text)]"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warn)]" aria-hidden />
      <p>
        <span className="font-semibold text-[var(--color-warn)]">風險聲明：</span>
        本網站僅供資料分析、策略研究與教育用途，不構成投資建議、招攬或保證獲利。加密貨幣價格波動劇烈，使用者可能損失全部本金。
        {!compact && "歷史回測結果不代表未來績效。"}
      </p>
    </div>
  );
}
