import { describe, it, expect } from "vitest";
import { DemoProvider } from "@/lib/market/providers/demoProvider";

const provider = new DemoProvider();

describe("DemoProvider.getTopTraderLongShortRatio", () => {
  it("回傳指定數量的資料點，且多倉／空倉占比合計為 100%", async () => {
    const result = await provider.getTopTraderLongShortRatio({
      symbol: "BTCUSDT",
      period: "1h",
      limit: 20,
    });
    expect(result.unavailable).toBeUndefined();
    expect(result.freshness).toBe("demo");
    expect(result.data.length).toBe(20);
    for (const p of result.data) {
      expect(p.longAccountPct + p.shortAccountPct).toBeCloseTo(100, 5);
      expect(p.longAccountPct).toBeGreaterThanOrEqual(20);
      expect(p.longAccountPct).toBeLessThanOrEqual(80);
      expect(p.longShortRatio).toBeCloseTo(
        p.longAccountPct / p.shortAccountPct,
        5,
      );
    }
  });

  it("資料點時間嚴格遞增", async () => {
    const result = await provider.getTopTraderLongShortRatio({
      symbol: "ETHUSDT",
      period: "4h",
      limit: 10,
    });
    for (let i = 1; i < result.data.length; i++) {
      expect(result.data[i]!.time).toBeGreaterThan(result.data[i - 1]!.time);
    }
  });

  it("相同參數在不同呼叫時間下，多倉占比序列仍然一致（確定性亂數，與 endTime 無關）", async () => {
    const a = await provider.getTopTraderLongShortRatio({
      symbol: "SOLUSDT",
      period: "15m",
      limit: 15,
    });
    await new Promise((r) => setTimeout(r, 5));
    const b = await provider.getTopTraderLongShortRatio({
      symbol: "SOLUSDT",
      period: "15m",
      limit: 15,
    });
    expect(a.data.map((p) => p.longAccountPct)).toEqual(
      b.data.map((p) => p.longAccountPct),
    );
  });

  it("不支援的交易對會回傳 unavailable，而非假資料", async () => {
    const result = await provider.getTopTraderLongShortRatio({
      symbol: "DOGEUSDT",
      period: "1h",
      limit: 10,
    });
    expect(result.unavailable).toBeDefined();
    expect(result.data).toEqual([]);
  });

  it("limit 超過上限時會被限制在 500 以內", async () => {
    const result = await provider.getTopTraderLongShortRatio({
      symbol: "BTCUSDT",
      period: "1d",
      limit: 10000,
    });
    expect(result.data.length).toBe(500);
  });
});
