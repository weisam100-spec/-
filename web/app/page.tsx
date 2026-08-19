import { StockSearchBar } from "@/components/search/StockSearchBar";
import { MarketOverviewCard } from "@/components/market/MarketOverviewCard";
import { HotStockList } from "@/components/market/HotStockList";
import { WatchlistPreview } from "@/components/watchlist/WatchlistPreview";
import { MockDataBanner } from "@/components/common/MockDataBanner";

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <section className="flex flex-col items-center gap-3 py-6 text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">AI 台股投資分析助手</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          輸入股票代號或公司名稱，快速掌握技術面、基本面、籌碼面與 AI 綜合分析。
        </p>
        <div className="w-full max-w-xl pt-2">
          <StockSearchBar size="lg" />
        </div>
      </section>

      <MockDataBanner />

      <MarketOverviewCard />

      <div className="grid gap-6 md:grid-cols-2">
        <HotStockList />
        <WatchlistPreview />
      </div>
    </div>
  );
}
