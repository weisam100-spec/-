"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MockDataBanner } from "@/components/common/MockDataBanner";
import { AddHoldingForm } from "@/components/portfolio/AddHoldingForm";
import { PortfolioSummaryCards } from "@/components/portfolio/PortfolioSummaryCards";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { CumulativeReturnChart } from "@/components/portfolio/CumulativeReturnChart";
import { usePortfolio } from "@/hooks/usePortfolio";
import { usePortfolioReturnSeries } from "@/hooks/usePortfolioReturnSeries";
import { useStockQuotes } from "@/hooks/useStockQuotes";
import { computeHoldingMetrics, computePortfolioSummary } from "@/services/analysis/portfolio";
import type { HoldingMetrics, StockQuote } from "@/lib/types/stock";

export default function PortfolioPage() {
  const { items: holdings, hydrated, remove } = usePortfolio();
  const symbols = holdings.map((h) => h.symbol);
  const { data: quotes, isLoading: quotesLoading } = useStockQuotes(symbols);
  const { series, isLoading: seriesLoading } = usePortfolioReturnSeries(holdings);

  const quoteBySymbol: Record<string, StockQuote> = {};
  (quotes ?? []).forEach((q) => {
    quoteBySymbol[q.symbol] = q;
  });

  const metricsBySymbol: Record<string, HoldingMetrics> = {};
  holdings.forEach((h) => {
    const quote = quoteBySymbol[h.symbol];
    if (quote) metricsBySymbol[h.symbol] = computeHoldingMetrics(h, quote.price);
  });
  const summary = computePortfolioSummary(Object.values(metricsBySymbol));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-xl font-bold">💼 我的持股</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          記錄你的持股成本，追蹤未實現損益與累積報酬曲線。
        </p>
      </div>

      <MockDataBanner />

      <AddHoldingForm />

      {!hydrated || (symbols.length > 0 && quotesLoading) ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      ) : holdings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-12 text-center text-sm text-muted-foreground">
            尚未新增任何持股，請用上方表單新增。
            <Link href="/" className="font-medium text-foreground underline underline-offset-2">
              回首頁搜尋股票
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <PortfolioSummaryCards summary={summary} />

          <Card>
            <CardHeader>
              <CardTitle>📈 累積報酬曲線</CardTitle>
            </CardHeader>
            <CardContent>
              {seriesLoading ? (
                <div className="h-[280px] animate-pulse rounded-xl bg-muted" />
              ) : (
                <CumulativeReturnChart points={series} />
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                曲線依各持股「買入日期」（未填則預設近 90 天）與該股票的歷史收盤價試算組合市值變化，僅供參考，非帳戶實際對帳數字。
              </p>
            </CardContent>
          </Card>

          <HoldingsTable
            holdings={holdings}
            quoteBySymbol={quoteBySymbol}
            metricsBySymbol={metricsBySymbol}
            onRemove={remove}
          />
        </>
      )}
    </div>
  );
}
