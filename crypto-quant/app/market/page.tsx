import { MarketWorkspace } from "@/components/workspace/MarketWorkspace";
import { isSupportedSymbol } from "@/lib/market/symbols";

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string }>;
}) {
  const { symbol } = await searchParams;
  const initialSymbol = symbol && isSupportedSymbol(symbol) ? symbol : "BTCUSDT";
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-[var(--color-text)]">行情與技術圖表</h1>
      <MarketWorkspace initialSymbol={initialSymbol} />
    </div>
  );
}
