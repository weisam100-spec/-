import { RiskBanner } from "@/components/common/RiskBanner";
import { MarketSummaryGrid } from "@/components/market/MarketSummaryGrid";
import { MarketWorkspace } from "@/components/workspace/MarketWorkspace";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-5">
      <RiskBanner />

      <section>
        <h1 className="mb-3 text-lg font-bold text-[var(--color-text)]">市場行情摘要</h1>
        <MarketSummaryGrid />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--color-text)]">策略分析工作區</h2>
          <a href="/market" className="text-xs text-[var(--color-accent)] hover:underline">
            前往完整行情與技術圖表頁 →
          </a>
        </div>
        <MarketWorkspace compact />
      </section>
    </div>
  );
}
