"use client";

import { useState } from "react";
import { RiskBanner } from "@/components/common/RiskBanner";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { ErrorState, LoadingState, EmptyState } from "@/components/common/StatusStates";
import { usePortfolio, useResetPortfolio, useSymbols, useTicker, usePaperTrade } from "@/lib/client/hooks";
import { formatPercent, formatUsdt, signClass } from "@/lib/format";
import type { Holding } from "@/lib/storage/portfolioRepo";

function HoldingRow({ holding }: { holding: Holding }) {
  const { data: ticker } = useTicker(holding.symbol);
  const currentPrice = ticker && !ticker.unavailable ? ticker.data.price : null;
  const marketValue = currentPrice !== null ? currentPrice * holding.quantity : null;
  const costValue = holding.avgCostUsdt * holding.quantity;
  const unrealizedPnl = marketValue !== null ? marketValue - costValue : null;
  const unrealizedPct = marketValue !== null && costValue > 0 ? (unrealizedPnl! / costValue) * 100 : null;

  return (
    <tr className="border-t border-[var(--color-border)]">
      <td className="p-2 font-medium text-[var(--color-text)]">{holding.symbol}</td>
      <td className="p-2 text-right">{holding.quantity.toFixed(6)}</td>
      <td className="p-2 text-right">{formatUsdt(holding.avgCostUsdt)}</td>
      <td className="p-2 text-right">{currentPrice === null ? "目前無法取得資料" : formatUsdt(currentPrice)}</td>
      <td className="p-2 text-right">{marketValue === null ? "—" : formatUsdt(marketValue)}</td>
      <td className={`p-2 text-right ${unrealizedPnl === null ? "" : signClass(unrealizedPnl)}`}>
        {unrealizedPnl === null ? "—" : `${formatUsdt(unrealizedPnl)}（${formatPercent(unrealizedPct!)}）`}
      </td>
    </tr>
  );
}

export default function PortfolioPage() {
  const { data, isLoading, isError, error, refetch } = usePortfolio();
  const { data: symbolsData } = useSymbols();
  const resetMutation = useResetPortfolio();
  const tradeMutation = usePaperTrade();

  const [symbol, setSymbol] = useState("BTCUSDT");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState(0.01);
  const { data: ticker } = useTicker(symbol);
  const [confirmReset, setConfirmReset] = useState(false);

  const price = ticker && !ticker.unavailable ? ticker.data.price : null;

  const handleTrade = () => {
    if (price === null) return;
    tradeMutation.mutate({ symbol, side, quantity, priceUsdt: price });
  };

  if (isLoading) return <LoadingState label="載入模擬投資組合…" />;
  if (isError || !data) return <ErrorState message={error instanceof Error ? error.message : "載入失敗"} onRetry={() => refetch()} />;

  const portfolio = data.portfolio;

  return (
    <div className="flex flex-col gap-4">
      <RiskBanner />
      <h1 className="text-lg font-bold text-[var(--color-text)]">模擬投資組合</h1>
      <p className="text-xs text-[var(--color-text-muted)]">
        本頁僅為本機紙上模擬交易，不會連接任何真實交易所帳戶，也不會下真實訂單。「真實交易」功能尚未開放，詳見系統說明頁。
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-[var(--color-text-muted)]">現金餘額</p>
          <p className="mt-1 text-lg font-bold text-[var(--color-text)]">{formatUsdt(portfolio.cashUsdt)}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--color-text-muted)]">已實現損益</p>
          <p className={`mt-1 text-lg font-bold ${signClass(portfolio.totalRealizedPnlUsdt)}`}>{formatUsdt(portfolio.totalRealizedPnlUsdt)}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--color-text-muted)]">持倉檔數</p>
          <p className="mt-1 text-lg font-bold text-[var(--color-text)]">{portfolio.holdings.length}</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>持倉明細</CardTitle>
        </CardHeader>
        {portfolio.holdings.length === 0 ? (
          <EmptyState message="目前尚無模擬持倉" hint="於下方下單區買進即可建立持倉" />
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="text-[var(--color-text-muted)]">
                <tr>
                  <th className="p-2 text-left">交易對</th>
                  <th className="p-2 text-right">數量</th>
                  <th className="p-2 text-right">平均成本</th>
                  <th className="p-2 text-right">目前價格</th>
                  <th className="p-2 text-right">市值</th>
                  <th className="p-2 text-right">未實現損益</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.holdings.map((h) => (
                  <HoldingRow key={h.id} holding={h} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>模擬下單</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="交易對">
            <Select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {(symbolsData?.symbols ?? []).map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.displayName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="方向">
            <Select value={side} onChange={(e) => setSide(e.target.value as "buy" | "sell")}>
              <option value="buy">買進</option>
              <option value="sell">賣出</option>
            </Select>
          </Field>
          <Field label="數量">
            <TextInput type="number" min={0.000001} step={0.000001} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          </Field>
          <Field label="目前市價">
            <TextInput readOnly value={price === null ? "目前無法取得資料" : formatUsdt(price)} />
          </Field>
        </div>
        {tradeMutation.isError && <ErrorState message={tradeMutation.error instanceof Error ? tradeMutation.error.message : "下單失敗"} />}
        <Button className="mt-3" onClick={handleTrade} disabled={price === null || tradeMutation.isPending}>
          {tradeMutation.isPending ? "處理中…" : `確認模擬${side === "buy" ? "買進" : "賣出"}`}
        </Button>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>重置模擬投資組合</CardTitle>
        </CardHeader>
        <p className="mb-2 text-xs text-[var(--color-text-muted)]">將清空所有模擬持倉與交易紀錄，並重設現金餘額為 100,000 USDT。</p>
        {confirmReset ? (
          <div className="flex gap-2">
            <Button
              variant="danger"
              onClick={() => {
                resetMutation.mutate(undefined);
                setConfirmReset(false);
              }}
            >
              確定重置？
            </Button>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              取消
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirmReset(true)}>
            重置投資組合
          </Button>
        )}
      </Card>
    </div>
  );
}
