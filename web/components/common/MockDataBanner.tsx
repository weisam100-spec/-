import { Info } from "lucide-react";

export function MockDataBanner() {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-200">
      <Info className="mt-0.5 size-4 shrink-0" />
      <span>
        目前為開發階段展示資料（Mock Data），非即時市場真實報價。正式資料源上線後將於此處移除本提示。
      </span>
    </div>
  );
}
