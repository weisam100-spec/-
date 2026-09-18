import { rsi } from "@/lib/indicators";
import type { Strategy, StrategySignal } from "./types";

export interface RsiMeanReversionParams extends Record<string, unknown> {
  period: number;
  oversold: number;
  overbought: number;
}

export const rsiMeanReversionDefaultParams: RsiMeanReversionParams = {
  period: 14,
  oversold: 30,
  overbought: 70,
};

export const rsiMeanReversionStrategy: Strategy<RsiMeanReversionParams> = {
  id: "rsi-mean-reversion",
  name: "RSI 均值回歸策略",
  description:
    "RSI 由超賣區向上回升時形成偏多候選訊號（可能反彈），由超買區向下回落時形成偏空／出場候選訊號（可能回檔）。",
  defaultParams: rsiMeanReversionDefaultParams,

  validateParams(params) {
    const errors: string[] = [];
    if (!Number.isFinite(params.period) || params.period < 2) {
      errors.push("RSI 週期需為大於等於 2 的整數");
    }
    if (params.oversold < 0 || params.oversold > 100) {
      errors.push("超賣門檻必須介於 0 至 100 之間");
    }
    if (params.overbought < 0 || params.overbought > 100) {
      errors.push("超買門檻必須介於 0 至 100 之間");
    }
    if (params.oversold >= params.overbought) {
      errors.push("超賣門檻必須小於超買門檻");
    }
    return { valid: errors.length === 0, errors };
  },

  generateSignals(candles, params, ctx): StrategySignal[] {
    const closes = candles.map((c) => c.close);
    const rsiValues = rsi(closes, params.period);
    const signals: StrategySignal[] = [];

    for (let i = 1; i < candles.length; i++) {
      const prev = rsiValues[i - 1]!;
      const cur = rsiValues[i]!;
      if (Number.isNaN(prev) || Number.isNaN(cur)) continue;

      const crossUpFromOversold = prev <= params.oversold && cur > params.oversold;
      const crossDownFromOverbought = prev >= params.overbought && cur < params.overbought;
      if (!crossUpFromOversold && !crossDownFromOverbought) continue;

      const bullish = crossUpFromOversold;
      const distanceFromMid = Math.abs(cur - 50);
      const confidence = Math.round(Math.min(90, 50 + distanceFromMid * 0.8));

      signals.push({
        time: candles[i]!.openTime,
        symbol: ctx.symbol,
        interval: ctx.interval,
        type: bullish ? "bullish_candidate" : "bearish_candidate",
        price: closes[i]!,
        reason: bullish
          ? `RSI(${params.period}) 由超賣區（${params.oversold} 以下）回升至 ${cur.toFixed(1)}，可能出現反彈`
          : `RSI(${params.period}) 由超買區（${params.overbought} 以上）回落至 ${cur.toFixed(1)}，可能出現回檔`,
        confidence,
        params: { ...params },
      });
    }
    return signals;
  },
};
