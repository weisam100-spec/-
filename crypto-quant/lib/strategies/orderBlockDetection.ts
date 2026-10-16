import type { Candle } from "@/lib/market/types";
import { computeSwingEvents, type SwingEvent } from "./marketStructure";

/**
 * 訂單塊（Order Block）偵測邏輯，SMC 策略（訊號產生）與行情頁的「訂單塊」圖表標示
 * （純顯示用，非訊號）共用同一套規則，避免兩處邏輯各自實作而日後兜不起來。
 *
 * 規則與 SMC 策略一致：
 * 1. 擺動點需等右側 swingLookback 根 K 棒確認（無未來函數）。
 * 2. 收盤價突破前一個已確認的擺動高/低點視為結構突破（CHoCH／BOS）。
 * 3. 帶動突破的 K 棒實體須達到近期平均實體的 minDisplacementMultiple 倍以上才視為有效動能突破。
 * 4. 造成突破的那根 K 棒之前，最後一根反方向的 K 棒之高低區間即為訂單塊。
 * 5. 訂單塊超過 maxMitigationBars 根 K 棒仍未被價格回測，視為失效。
 */

export interface OrderBlockParams {
  swingLookback: number;
  orderBlockLookback: number;
  minDisplacementMultiple: number;
  maxMitigationBars: number;
}

export interface OrderBlockTouch {
  /** 回測發生的 K 棒索引 */
  index: number;
  time: number;
  price: number;
  type: "bullish" | "bearish";
  low: number;
  high: number;
  isChoch: boolean;
  displacementRatio: number;
  reason: string;
}

export interface ActiveOrderBlock {
  type: "bullish" | "bearish";
  low: number;
  high: number;
  createdAtIndex: number;
  createdAtTime: number;
  isChoch: boolean;
  displacementRatio: number;
  reason: string;
}

export interface OrderBlockDetectionResult {
  /** 掃描全部資料過程中，每一次「價格回測訂單塊」的事件（SMC 策略訊號即由此而來） */
  touches: OrderBlockTouch[];
  /** 掃描到最後一根 K 棒為止，仍未被回測、也還沒超過有效期的訂單塊（供圖表顯示用） */
  active: ActiveOrderBlock[];
}

interface PendingOrderBlock {
  type: "bullish" | "bearish";
  high: number;
  low: number;
  createdAt: number;
  reason: string;
  isChoch: boolean;
  displacementRatio: number;
}

function findBullishOrderBlock(
  candles: Candle[],
  breakIndex: number,
  lookback: number,
) {
  const from = Math.max(0, breakIndex - lookback);
  for (let j = breakIndex - 1; j >= from; j--) {
    const c = candles[j]!;
    if (c.close < c.open) return { high: c.high, low: c.low };
  }
  return null;
}

function findBearishOrderBlock(
  candles: Candle[],
  breakIndex: number,
  lookback: number,
) {
  const from = Math.max(0, breakIndex - lookback);
  for (let j = breakIndex - 1; j >= from; j--) {
    const c = candles[j]!;
    if (c.close > c.open) return { high: c.high, low: c.low };
  }
  return null;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function detectOrderBlocks(
  candles: Candle[],
  params: OrderBlockParams,
): OrderBlockDetectionResult {
  const n = candles.length;
  if (n < params.swingLookback * 2 + 2) return { touches: [], active: [] };

  const events = computeSwingEvents(candles, params.swingLookback);
  const eventsByBar = new Map<number, SwingEvent[]>();
  for (const e of events) {
    const list = eventsByBar.get(e.confirmedAt);
    if (list) list.push(e);
    else eventsByBar.set(e.confirmedAt, [e]);
  }

  const bodySizes = candles.map((c) => Math.abs(c.close - c.open));

  let lastSwingHigh: number | null = null;
  let lastSwingLow: number | null = null;
  let structure: "bullish" | "bearish" | "unknown" = "unknown";
  const pendingOBs: PendingOrderBlock[] = [];
  const touches: OrderBlockTouch[] = [];

  for (let i = 0; i < n; i++) {
    const newEvents = eventsByBar.get(i);
    if (newEvents) {
      for (const e of newEvents) {
        if (e.type === "high") lastSwingHigh = e.price;
        else lastSwingLow = e.price;
      }
    }

    const candle = candles[i]!;
    const windowStart = Math.max(0, i - 20);
    const avgBody =
      i > windowStart ? average(bodySizes.slice(windowStart, i)) : 0;
    const displacementRatio = avgBody > 0 ? bodySizes[i]! / avgBody : 0;

    if (lastSwingHigh !== null && candle.close > lastSwingHigh) {
      const isChoch = structure === "bearish";
      if (displacementRatio >= params.minDisplacementMultiple) {
        const ob = findBullishOrderBlock(candles, i, params.orderBlockLookback);
        if (ob) {
          pendingOBs.push({
            type: "bullish",
            high: ob.high,
            low: ob.low,
            createdAt: i,
            isChoch,
            displacementRatio,
            reason: isChoch
              ? `價格突破前波段高點 ${lastSwingHigh.toFixed(4)}，結構由空轉多（CHoCH）`
              : `價格延續多頭結構，突破前波段高點 ${lastSwingHigh.toFixed(4)}（BOS）`,
          });
        }
      }
      structure = "bullish";
      lastSwingHigh = null;
    }

    if (lastSwingLow !== null && candle.close < lastSwingLow) {
      const isChoch = structure === "bullish";
      if (displacementRatio >= params.minDisplacementMultiple) {
        const ob = findBearishOrderBlock(candles, i, params.orderBlockLookback);
        if (ob) {
          pendingOBs.push({
            type: "bearish",
            high: ob.high,
            low: ob.low,
            createdAt: i,
            isChoch,
            displacementRatio,
            reason: isChoch
              ? `價格跌破前波段低點 ${lastSwingLow.toFixed(4)}，結構由多轉空（CHoCH）`
              : `價格延續空頭結構，跌破前波段低點 ${lastSwingLow.toFixed(4)}（BOS）`,
          });
        }
      }
      structure = "bearish";
      lastSwingLow = null;
    }

    for (let p = pendingOBs.length - 1; p >= 0; p--) {
      const ob = pendingOBs[p]!;
      if (i - ob.createdAt > params.maxMitigationBars) {
        pendingOBs.splice(p, 1);
        continue;
      }
      if (i === ob.createdAt) continue;

      const touched = candle.low <= ob.high && candle.high >= ob.low;
      if (!touched) continue;

      touches.push({
        index: i,
        time: candle.openTime,
        price: candle.close,
        type: ob.type,
        low: ob.low,
        high: ob.high,
        isChoch: ob.isChoch,
        displacementRatio: ob.displacementRatio,
        reason: ob.reason,
      });
      pendingOBs.splice(p, 1);
    }
  }

  const active: ActiveOrderBlock[] = pendingOBs.map((ob) => ({
    type: ob.type,
    low: ob.low,
    high: ob.high,
    createdAtIndex: ob.createdAt,
    createdAtTime: candles[ob.createdAt]!.openTime,
    isChoch: ob.isChoch,
    displacementRatio: ob.displacementRatio,
    reason: ob.reason,
  }));

  return { touches, active };
}
