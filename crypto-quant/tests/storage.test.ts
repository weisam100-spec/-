import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const tmpDbPath = path.join(os.tmpdir(), `cq-test-${Date.now()}.db`);
process.env.DATABASE_FILE = tmpDbPath;

const { createStrategyConfig, listStrategyConfigs, updateStrategyConfig, deleteStrategyConfig, duplicateStrategyConfig } =
  await import("@/lib/storage/strategyConfigRepo");
const { addWatchlistItem, listWatchlist, removeWatchlistItem } = await import("@/lib/storage/watchlistRepo");
const { getPortfolio, paperBuy, paperSell, resetPortfolio } = await import("@/lib/storage/portfolioRepo");
const { defaultBacktestConfig } = await import("@/lib/backtest/types");
const { emaTrendDefaultParams } = await import("@/lib/strategies/emaTrend");

const workspaceId = "test-workspace";

describe("strategyConfigRepo", () => {
  it("可以建立、列出、更新、複製與刪除策略設定", () => {
    const created = createStrategyConfig(workspaceId, {
      strategyId: "ema-trend",
      name: "我的 EMA 策略",
      symbol: "BTCUSDT",
      interval: "1h",
      params: emaTrendDefaultParams,
      backtestConfig: defaultBacktestConfig,
    });
    expect(created.id).toBeTruthy();

    const list = listStrategyConfigs(workspaceId);
    expect(list.some((c) => c.id === created.id)).toBe(true);

    const updated = updateStrategyConfig(workspaceId, created.id, { name: "改名後" });
    expect(updated?.name).toBe("改名後");

    const duplicated = duplicateStrategyConfig(workspaceId, created.id);
    expect(duplicated?.name).toContain("複製");

    const deleted = deleteStrategyConfig(workspaceId, created.id);
    expect(deleted).toBe(true);
    expect(listStrategyConfigs(workspaceId).some((c) => c.id === created.id)).toBe(false);
  });
});

describe("watchlistRepo", () => {
  it("可以新增、列出與移除觀察清單項目", () => {
    const item = addWatchlistItem(workspaceId, "ETHUSDT", "測試備註");
    expect(item.symbol).toBe("ETHUSDT");
    expect(listWatchlist(workspaceId).some((i) => i.id === item.id)).toBe(true);
    const removed = removeWatchlistItem(workspaceId, item.id);
    expect(removed).toBe(true);
  });
});

describe("portfolioRepo", () => {
  it("模擬買進會扣減現金並增加持倉", () => {
    resetPortfolio(workspaceId, 10_000);
    const result = paperBuy(workspaceId, "BTCUSDT", 0.1, 60_000); // 0.1 * 60000 = 6000 <= 10000，應成功
    expect(result.ok).toBe(true);
  });

  it("現金不足時買進失敗", () => {
    resetPortfolio(workspaceId, 1_000);
    const result = paperBuy(workspaceId, "BTCUSDT", 1, 60_000);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("現金餘額不足");
  });

  it("正常買賣流程：買進後可賣出並取回現金", () => {
    resetPortfolio(workspaceId, 10_000);
    const buyResult = paperBuy(workspaceId, "BTCUSDT", 0.1, 20_000);
    expect(buyResult.ok).toBe(true);
    const afterBuy = getPortfolio(workspaceId);
    expect(afterBuy.cashUsdt).toBeCloseTo(8_000, 6);
    expect(afterBuy.holdings.find((h) => h.symbol === "BTCUSDT")?.quantity).toBeCloseTo(0.1, 6);

    const sellResult = paperSell(workspaceId, "BTCUSDT", 0.1, 25_000);
    expect(sellResult.ok).toBe(true);
    const afterSell = getPortfolio(workspaceId);
    expect(afterSell.cashUsdt).toBeCloseTo(10_500, 6);
    expect(afterSell.holdings.find((h) => h.symbol === "BTCUSDT")).toBeUndefined();
  });

  it("賣出超過持有數量時失敗", () => {
    resetPortfolio(workspaceId, 10_000);
    paperBuy(workspaceId, "BTCUSDT", 0.1, 20_000);
    const result = paperSell(workspaceId, "BTCUSDT", 5, 20_000);
    expect(result.ok).toBe(false);
  });
});

describe("cleanup", () => {
  it("移除測試用資料庫檔案", () => {
    if (fs.existsSync(tmpDbPath)) fs.unlinkSync(tmpDbPath);
    expect(true).toBe(true);
  });
});
