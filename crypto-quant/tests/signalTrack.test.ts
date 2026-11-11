import { describe, it, expect, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type { Candle } from "@/lib/market/types";

const tmpDbPath = path.join(os.tmpdir(), `cq-test-signaltrack-${Date.now()}.db`);
process.env.DATABASE_FILE = tmpDbPath;

// 動態 import，確保 lib/env.ts 讀取 process.env.DATABASE_FILE 時，已經是上面設定過的暫存路徑
// （靜態 import 會在模組最上層程式碼執行前就先被提升求值，若此處改用靜態 import，
// lib/alerts/trackResolver.ts 透過 signalTrackRepo -> db -> env 的匯入鏈就會在設定暫存路徑之前
// 搶先讀到尚未設定或其他測試檔案殘留的 DATABASE_FILE，導致這個測試檔案操作到錯誤的資料庫檔案）。
const { determineTrackOutcome } = await import("@/lib/alerts/trackResolver");
const { recordSignalTrack, listPendingSignalTracks, resolveSignalTrack, listSignalTracks } = await import(
  "@/lib/storage/signalTrackRepo"
);

afterAll(() => {
  if (fs.existsSync(tmpDbPath)) fs.unlinkSync(tmpDbPath);
});

const BASE_TIME = 1_700_000_000_000;
const STEP_MS = 3_600_000;

function candle(i: number, high: number, low: number, close: number): Candle {
  return { openTime: BASE_TIME + i * STEP_MS, open: close, high, low, close, volume: 1000, closed: true };
}

describe("determineTrackOutcome（純函式）", () => {
  const bullishParams = { signalType: "bullish_candidate" as const, stopPrice: 95, rr2Price: 110, rr3Price: 115, maxBars: 10 };

  it("先碰到停損", () => {
    const candles = [candle(0, 101, 99, 100), candle(1, 102, 94, 96)];
    const outcome = determineTrackOutcome(candles, bullishParams);
    expect(outcome?.status).toBe("hit_stop");
    expect(outcome?.resolvedPrice).toBe(95);
  });

  it("先達成 1:2 停利", () => {
    const candles = [candle(0, 101, 99, 100), candle(1, 111, 100, 108)];
    const outcome = determineTrackOutcome(candles, bullishParams);
    expect(outcome?.status).toBe("hit_rr2");
    expect(outcome?.resolvedPrice).toBe(110);
  });

  it("同一根內 1:2 與 1:3 都觸及時，記錄達成程度較高的 1:3", () => {
    const candles = [candle(0, 116, 100, 112)];
    const outcome = determineTrackOutcome(candles, bullishParams);
    expect(outcome?.status).toBe("hit_rr3");
  });

  it("同一根內停損與停利都可能觸及時，保守假設停損優先", () => {
    const candles = [candle(0, 116, 94, 100)];
    const outcome = determineTrackOutcome(candles, bullishParams);
    expect(outcome?.status).toBe("hit_stop");
  });

  it("空頭訊號方向相反", () => {
    const bearishParams = { signalType: "bearish_candidate" as const, stopPrice: 105, rr2Price: 90, rr3Price: 85, maxBars: 10 };
    const stopCandles = [candle(0, 106, 100, 103)];
    expect(determineTrackOutcome(stopCandles, bearishParams)?.status).toBe("hit_stop");
    const rr2Candles = [candle(0, 101, 89, 95)];
    expect(determineTrackOutcome(rr2Candles, bearishParams)?.status).toBe("hit_rr2");
  });

  it("資料不足 maxBars 根且尚未觸及任何價位時回傳 null（下次再判斷）", () => {
    const candles = [candle(0, 101, 99, 100), candle(1, 102, 98, 100)];
    const outcome = determineTrackOutcome(candles, { ...bullishParams, maxBars: 10 });
    expect(outcome).toBeNull();
  });

  it("追蹤滿 maxBars 根仍未觸及任何價位時，標記為逾時未解", () => {
    const candles = Array.from({ length: 5 }, (_, i) => candle(i, 101, 99, 100));
    const outcome = determineTrackOutcome(candles, { ...bullishParams, maxBars: 5 });
    expect(outcome?.status).toBe("no_result");
    expect(outcome?.resolvedPrice).toBe(100);
  });

  it("無未來函數：只看傳入的 K 棒序列本身，不會回頭看序列以外的資料", () => {
    const fullCandles = [candle(0, 101, 99, 100), candle(1, 111, 100, 108), candle(2, 120, 100, 118)];
    const truncated = fullCandles.slice(0, 1);
    const fullOutcome = determineTrackOutcome(fullCandles, bullishParams);
    const truncatedOutcome = determineTrackOutcome(truncated, bullishParams);
    expect(fullOutcome?.status).toBe("hit_rr2");
    expect(truncatedOutcome).toBeNull();
  });
});

describe("signalTrackRepo", () => {
  const base = {
    workspaceId: "test-ws",
    strategyConfigId: "cfg-1",
    strategyId: "fvg-supply-demand" as const,
    configName: "我的策略",
    symbol: "BTCUSDT",
    interval: "1h" as const,
    signalTime: BASE_TIME,
    signalType: "bullish_candidate" as const,
    entryPrice: 100,
    confidence: 70,
    reason: "test",
    stopPrice: 95,
    rr2Price: 110,
    rr3Price: 115,
  };

  it("可以記錄一筆待確認紀錄，並出現在 pending 與工作區列表中", () => {
    recordSignalTrack(base);
    const pending = listPendingSignalTracks();
    expect(pending.some((r) => r.strategyConfigId === "cfg-1" && r.signalTime === BASE_TIME)).toBe(true);

    const list = listSignalTracks("test-ws");
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]!.status).toBe("pending");
  });

  it("同一組設定與訊號時間重複記錄會被忽略（不會產生重複紀錄）", () => {
    const before = listSignalTracks("test-ws").length;
    recordSignalTrack(base);
    const after = listSignalTracks("test-ws").length;
    expect(after).toBe(before);
  });

  it("可以判定結果，判定後不再出現在 pending 清單", () => {
    const pendingBefore = listPendingSignalTracks().find(
      (r) => r.strategyConfigId === "cfg-1" && r.signalTime === BASE_TIME,
    )!;
    resolveSignalTrack(pendingBefore.id, "hit_rr2", BASE_TIME + STEP_MS, 110);
    const stillPending = listPendingSignalTracks().some((r) => r.id === pendingBefore.id);
    expect(stillPending).toBe(false);

    const list = listSignalTracks("test-ws");
    const updated = list.find((r) => r.id === pendingBefore.id)!;
    expect(updated.status).toBe("hit_rr2");
    expect(updated.resolvedPrice).toBe(110);
  });
});
