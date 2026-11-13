import type { Interval } from "@/lib/market/symbols";
import type { Candle } from "@/lib/market/types";
import { computeSwingEvents, type SwingEvent } from "./marketStructure";

/**
 * 給定主要交易週期，回傳用來判斷大趨勢方向、供低週期策略做「順勢過濾」用的高一層週期。
 * 1 日線已經是支援的最高週期，沒有更高層可用。
 */
export const HIGHER_TIMEFRAME: Record<Interval, Interval | null> = {
  "5m": "1h",
  "15m": "4h",
  "1h": "4h",
  "4h": "1d",
  "1d": null,
};

export interface StructureSnapshot {
  /** 該高週期 K 棒的開盤時間 */
  openTime: number;
  /** 該高週期 K 棒收盤當下的市場結構狀態；尚未出現任何結構突破前為 unknown */
  structure: "bullish" | "bearish" | "unknown";
}

/**
 * 計算高週期每一根 K 棒收盤當下的市場結構狀態（多頭／空頭）。
 * 判斷邏輯與供需區偵測共用同一套概念：收盤價突破前一個已確認的擺動高點視為轉為多頭結構，
 * 跌破已確認的擺動低點視為轉為空頭結構。單一正向掃描，無未來函數。
 */
export function computeStructureTrend(candles: Candle[], swingLookback: number): StructureSnapshot[] {
  const n = candles.length;
  const snapshots: StructureSnapshot[] = [];
  if (n === 0) return snapshots;

  const events = computeSwingEvents(candles, swingLookback);
  const eventsByBar = new Map<number, SwingEvent[]>();
  for (const e of events) {
    const list = eventsByBar.get(e.confirmedAt);
    if (list) list.push(e);
    else eventsByBar.set(e.confirmedAt, [e]);
  }

  let lastSwingHigh: number | null = null;
  let lastSwingLow: number | null = null;
  let structure: "bullish" | "bearish" | "unknown" = "unknown";

  for (let i = 0; i < n; i++) {
    const newEvents = eventsByBar.get(i);
    if (newEvents) {
      for (const e of newEvents) {
        if (e.type === "high") lastSwingHigh = e.price;
        else lastSwingLow = e.price;
      }
    }
    const candle = candles[i]!;
    if (lastSwingHigh !== null && candle.close > lastSwingHigh) {
      structure = "bullish";
      lastSwingHigh = null;
    }
    if (lastSwingLow !== null && candle.close < lastSwingLow) {
      structure = "bearish";
      lastSwingLow = null;
    }
    snapshots.push({ openTime: candle.openTime, structure });
  }
  return snapshots;
}

/**
 * 在高週期結構快照中，找出在 asOfTime（低週期訊號時間）當下「已經確定收盤」的最新一筆高週期結構。
 * 只採用 openTime + 該週期長度 <= asOfTime 的高週期 K 棒，確保不會用到相對 asOfTime 而言尚未收盤的資料。
 */
export function structureAsOf(
  snapshots: StructureSnapshot[],
  asOfTime: number,
  higherIntervalMs: number,
): "bullish" | "bearish" | "unknown" {
  let result: "bullish" | "bearish" | "unknown" = "unknown";
  for (const snap of snapshots) {
    if (snap.openTime + higherIntervalMs > asOfTime) break;
    result = snap.structure;
  }
  return result;
}
