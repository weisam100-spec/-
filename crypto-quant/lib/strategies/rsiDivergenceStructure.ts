import { rsi } from "@/lib/indicators";
import { computeSwingEvents, type SwingEvent } from "./marketStructure";
import type { Strategy, StrategySignal } from "./types";

/**
 * RSI 背離＋結構確認策略。
 * 比較價格與 RSI 在兩個連續擺動低點（或高點）的走勢：
 * 若價格創更低的低點，但 RSI 卻是更高的低點，形成「RSI 底背離」，可能醞釀反轉向上；
 * 此時再等待價格之後突破近期擺動高點（結構確認，Break of Structure）才真正觸發偏多候選訊號，
 * 避免單靠背離本身雜訊過多。頂背離（高點）邏輯對稱，觸發偏空候選訊號。
 */

export interface RsiDivergenceStructureParams extends Record<string, unknown> {
  rsiPeriod: number;
  swingLookback: number;
  /** 背離出現後，必須在幾根 K 棒之內完成結構確認，否則視為失效 */
  maxConfirmBars: number;
}

export const rsiDivergenceStructureDefaultParams: RsiDivergenceStructureParams = {
  rsiPeriod: 14,
  swingLookback: 5,
  maxConfirmBars: 30,
};

interface PendingDivergence {
  type: "bullish" | "bearish";
  detectedAt: number;
  /** 用來判斷結構確認的參考擺動高點（看漲背離）或擺動低點（看跌背離）價位 */
  confirmLevel: number;
}

export const rsiDivergenceStructureStrategy: Strategy<RsiDivergenceStructureParams> = {
  id: "rsi-divergence-structure",
  name: "RSI 底背離＋結構確認策略",
  description:
    "價格創新低但 RSI 未同步創新低（底背離），待價格之後突破近期擺動高點完成結構確認時，形成偏多候選訊號；頂背離邏輯對稱，形成偏空候選訊號。",
  defaultParams: rsiDivergenceStructureDefaultParams,

  validateParams(params) {
    const errors: string[] = [];
    if (!Number.isFinite(params.rsiPeriod) || params.rsiPeriod < 2) {
      errors.push("RSI 週期需為大於等於 2 的整數");
    }
    if (!Number.isFinite(params.swingLookback) || params.swingLookback < 2 || params.swingLookback > 50) {
      errors.push("擺動點確認根數必須介於 2 至 50 之間");
    }
    if (!Number.isFinite(params.maxConfirmBars) || params.maxConfirmBars < 1 || params.maxConfirmBars > 500) {
      errors.push("結構確認有效期必須介於 1 至 500 之間");
    }
    return { valid: errors.length === 0, errors };
  },

  generateSignals(candles, params, ctx): StrategySignal[] {
    const n = candles.length;
    if (n < params.swingLookback * 2 + 2) return [];

    const closes = candles.map((c) => c.close);
    const rsiValues = rsi(closes, params.rsiPeriod);
    const events = computeSwingEvents(candles, params.swingLookback);
    const eventsByBar = new Map<number, SwingEvent[]>();
    for (const e of events) {
      const list = eventsByBar.get(e.confirmedAt);
      if (list) list.push(e);
      else eventsByBar.set(e.confirmedAt, [e]);
    }

    let prevLow: SwingEvent | null = null;
    let lastLow: SwingEvent | null = null;
    let prevHigh: SwingEvent | null = null;
    let lastHigh: SwingEvent | null = null;

    const pending: PendingDivergence[] = [];
    const signals: StrategySignal[] = [];

    for (let i = 0; i < n; i++) {
      const candle = candles[i]!;
      const newEvents = eventsByBar.get(i);
      if (newEvents) {
        for (const e of newEvents) {
          const rsiAtPivot = rsiValues[e.pivotIndex]!;
          if (Number.isNaN(rsiAtPivot)) continue;

          if (e.type === "low") {
            prevLow = lastLow;
            lastLow = e;
            if (prevLow && lastLow.price < prevLow.price) {
              const prevRsi = rsiValues[prevLow.pivotIndex]!;
              if (!Number.isNaN(prevRsi) && rsiAtPivot > prevRsi) {
                // 底背離：價格創更低低點，RSI 卻走高，等待突破最近擺動高點確認
                const confirmLevel = lastHigh?.price ?? Infinity;
                pending.push({ type: "bullish", detectedAt: i, confirmLevel });
              }
            }
          } else {
            prevHigh = lastHigh;
            lastHigh = e;
            if (prevHigh && lastHigh.price > prevHigh.price) {
              const prevRsi = rsiValues[prevHigh.pivotIndex]!;
              if (!Number.isNaN(prevRsi) && rsiAtPivot < prevRsi) {
                // 頂背離：價格創更高高點，RSI 卻走低，等待跌破最近擺動低點確認
                const confirmLevel = lastLow?.price ?? -Infinity;
                pending.push({ type: "bearish", detectedAt: i, confirmLevel });
              }
            }
          }
        }
      }

      for (let p = pending.length - 1; p >= 0; p--) {
        const d = pending[p]!;
        if (i - d.detectedAt > params.maxConfirmBars) {
          pending.splice(p, 1);
          continue;
        }
        if (i === d.detectedAt || !Number.isFinite(d.confirmLevel)) continue;

        if (d.type === "bullish" && candle.close > d.confirmLevel) {
          signals.push({
            time: candle.openTime,
            symbol: ctx.symbol,
            interval: ctx.interval,
            type: "bullish_candidate",
            price: candle.close,
            reason: `偵測到 RSI 底背離後，價格突破擺動高點 ${d.confirmLevel.toFixed(4)} 完成結構確認`,
            confidence: 70,
            params: { ...params },
          });
          pending.splice(p, 1);
        } else if (d.type === "bearish" && candle.close < d.confirmLevel) {
          signals.push({
            time: candle.openTime,
            symbol: ctx.symbol,
            interval: ctx.interval,
            type: "bearish_candidate",
            price: candle.close,
            reason: `偵測到 RSI 頂背離後，價格跌破擺動低點 ${d.confirmLevel.toFixed(4)} 完成結構確認`,
            confidence: 70,
            params: { ...params },
          });
          pending.splice(p, 1);
        }
      }
    }

    return signals;
  },
};
