import { bollinger, rsi } from "@/lib/indicators";
import type { Strategy, StrategySignal } from "./types";

/**
 * 布林通道＋RSI 回歸策略。
 * 價格觸及（含跌破）布林通道下軌，且 RSI 同時處於超賣區，形成偏多候選訊號；
 * 價格觸及（含突破）上軌且 RSI 處於超買區，形成偏空候選訊號。
 * 兩項條件同時成立才觸發，降低單一指標雜訊造成的假訊號。
 */

export interface BollingerRsiReversionParams extends Record<string, unknown> {
  bollingerPeriod: number;
  bollingerMultiplier: number;
  rsiPeriod: number;
  oversold: number;
  overbought: number;
}

export const bollingerRsiReversionDefaultParams: BollingerRsiReversionParams = {
  bollingerPeriod: 20,
  bollingerMultiplier: 2,
  rsiPeriod: 14,
  oversold: 30,
  overbought: 70,
};

export const bollingerRsiReversionStrategy: Strategy<BollingerRsiReversionParams> = {
  id: "bollinger-rsi-reversion",
  name: "布林通道＋RSI 回歸策略",
  description:
    "價格觸及布林通道下軌同時 RSI 處於超賣區，形成偏多候選訊號；觸及上軌同時 RSI 處於超買區，形成偏空候選訊號，兩項條件同時成立才觸發以降低雜訊。",
  defaultParams: bollingerRsiReversionDefaultParams,

  validateParams(params) {
    const errors: string[] = [];
    if (!Number.isFinite(params.bollingerPeriod) || params.bollingerPeriod < 2) {
      errors.push("布林通道週期需為大於等於 2 的整數");
    }
    if (!Number.isFinite(params.bollingerMultiplier) || params.bollingerMultiplier <= 0) {
      errors.push("布林通道標準差倍數必須大於 0");
    }
    if (!Number.isFinite(params.rsiPeriod) || params.rsiPeriod < 2) {
      errors.push("RSI 週期需為大於等於 2 的整數");
    }
    if (params.oversold < 0 || params.oversold > 100) errors.push("超賣門檻必須介於 0 至 100 之間");
    if (params.overbought < 0 || params.overbought > 100) errors.push("超買門檻必須介於 0 至 100 之間");
    if (params.oversold >= params.overbought) errors.push("超賣門檻必須小於超買門檻");
    return { valid: errors.length === 0, errors };
  },

  generateSignals(candles, params, ctx): StrategySignal[] {
    const closes = candles.map((c) => c.close);
    const { upper, lower } = bollinger(closes, params.bollingerPeriod, params.bollingerMultiplier);
    const rsiValues = rsi(closes, params.rsiPeriod);

    const signals: StrategySignal[] = [];
    let lastType: "bullish_candidate" | "bearish_candidate" | null = null;

    for (let i = 0; i < candles.length; i++) {
      const u = upper[i]!;
      const l = lower[i]!;
      const r = rsiValues[i]!;
      if (Number.isNaN(u) || Number.isNaN(l) || Number.isNaN(r)) continue;

      const candle = candles[i]!;
      const touchLower = candle.low <= l;
      const touchUpper = candle.high >= u;

      if (touchLower && r <= params.oversold) {
        if (lastType !== "bullish_candidate") {
          signals.push({
            time: candle.openTime,
            symbol: ctx.symbol,
            interval: ctx.interval,
            type: "bullish_candidate",
            price: candle.close,
            reason: `價格觸及布林通道下軌（${l.toFixed(4)}），同時 RSI(${params.rsiPeriod}) 為 ${r.toFixed(1)} 處於超賣區`,
            confidence: 65,
            params: { ...params },
          });
        }
        lastType = "bullish_candidate";
      } else if (touchUpper && r >= params.overbought) {
        if (lastType !== "bearish_candidate") {
          signals.push({
            time: candle.openTime,
            symbol: ctx.symbol,
            interval: ctx.interval,
            type: "bearish_candidate",
            price: candle.close,
            reason: `價格觸及布林通道上軌（${u.toFixed(4)}），同時 RSI(${params.rsiPeriod}) 為 ${r.toFixed(1)} 處於超買區`,
            confidence: 65,
            params: { ...params },
          });
        }
        lastType = "bearish_candidate";
      } else {
        lastType = null;
      }
    }

    return signals;
  },
};
