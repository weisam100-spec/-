import { Info } from "lucide-react";

export function MockDataBanner() {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-200">
      <Info className="mt-0.5 size-4 shrink-0" />
      <span>
        股價／K線資料來源：FinMind（整理自證交所、櫃買中心公開資訊），為最近交易日的收盤資料，非逐筆即時報價。基本面／籌碼面／融資融券目前仍為開發階段模擬資料，正式資料源上線後將於此處更新。
      </span>
    </div>
  );
}
