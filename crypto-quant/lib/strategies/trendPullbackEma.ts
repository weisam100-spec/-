import { ema } from "@/lib/indicators";
import type { Strategy, StrategySignal } from "./types";

/**
 * 趨勢回踩＋EMA 策略。
 * 以短長期 EMA 排列判斷主趨勢方向，趨勢成立時等待價格回踩至指定 EMA（碰到但未跌破/突破太多），
 * 並於同一根 K 棒收盤重新站回 EMA 上（或下）方時，視為順勢回踩進場的候選訊號。
 */

export interface TrendPullbackEmaParams extends Record<string, unknown> {
  emaShortPeriod: number;
  emaLongPeriod: number;
  /** 用哪一條 EMA 作為回踩觸碰線："short" 或 "long" */
  pullbackLine: "short" | "long";
  /** 兩次訊號之間至少間隔幾根 K 棒，避免價格貼著 EMA 來回時連續觸發 */
  cooldownBars: number;
}

export const trendPullbackEmaDefaultParams: TrendPullbackEmaParams = {
  emaShortPeriod: 20,
  emaLongPeriod: 50,
  pullbackLine: "short",
  cooldownBars: 3,
};

export const trendPullbackEmaStrategy: Strategy<TrendPullbackEmaParams> = {
  id: "trend-pullback-ema",
  name: "趨勢回踩＋EMA 策略",
  description:
    "以短長期 EMA 排列判斷多頭／空頭主趨勢，趨勢成立時等待價格回踩觸及指定 EMA 後同根收盤站回趨勢方向，形成順勢回踩的偏多／偏空候選訊號。",
  defaultParams: trendPullbackEmaDefaultParams,

  validateParams(params) {
    const errors: string[] = [];
    if (!Number.isFinite(params.emaShortPeriod) || params.emaShortPeriod < 2) {
      errors.push("短期 EMA 週期需為大於等於 2 的整數");
    }
    if (!Number.isFinite(params.emaLongPeriod) || params.emaLongPeriod < 3) {
      errors.push("長期 EMA 週期需為大於等於 3 的整數");
    }
    if (params.emaShortPeriod >= params.emaLongPeriod) {
      errors.push("短期 EMA 週期必須小於長期 EMA 週期");
    }
    if (params.pullbackLine !== "short" && params.pullbackLine !== "long") {
      errors.push("回踩觸碰線必須是 short 或 long");
    }
    if (!Number.isFinite(params.cooldownBars) || params.cooldownBars < 0 || params.cooldownBars > 200) {
      errors.push("訊號冷卻根數必須介於 0 至 200 之間");
    }
    return { valid: errors.length === 0, errors };
  },

  generateSignals(candles, params, ctx): StrategySignal[] {
    const closes = candles.map((c) => c.close);
    const emaShort = ema(closes, params.emaShortPeriod);
    const emaLong = ema(closes, params.emaLongPeriod);
    const line = params.pullbackLine === "short" ? emaShort : emaLong;

    const signals: StrategySignal[] = [];
    let lastSignalBar = -Infinity;

    for (let i = 0; i < candles.length; i++) {
      const s = emaShort[i]!;
      const l = emaLong[i]!;
      const touchLine = line[i]!;
      if (Number.isNaN(s) || Number.isNaN(l) || Number.isNaN(touchLine)) continue;
      if (i - lastSignalBar < params.cooldownBars) continue;

      const candle = candles[i]!;
      const trendUp = s > l;
      const trendDown = s < l;

      if (trendUp && candle.low <= touchLine && candle.close > touchLine) {
        signals.push({
          time: candle.openTime,
          symbol: ctx.symbol,
          interval: ctx.interval,
          type: "bullish_candidate",
          price: candle.close,
          reason: `多頭排列（EMA${params.emaShortPeriod} > EMA${params.emaLongPeriod}）下，價格回踩至 ${params.pullbackLine === "short" ? "短期" : "長期"} EMA（${touchLine.toFixed(4)}）後收盤站回上方`,
          confidence: 65,
          params: { ...params },
        });
        lastSignalBar = i;
      } else if (trendDown && candle.high >= touchLine && candle.close < touchLine) {
        signals.push({
          time: candle.openTime,
          symbol: ctx.symbol,
          interval: ctx.interval,
          type: "bearish_candidate",
          price: candle.close,
          reason: `空頭排列（EMA${params.emaShortPeriod} < EMA${params.emaLongPeriod}）下，價格反彈至 ${params.pullbackLine === "short" ? "短期" : "長期"} EMA（${touchLine.toFixed(4)}）後收盤跌回下方`,
          confidence: 65,
          params: { ...params },
        });
        lastSignalBar = i;
      }
    }

    return signals;
  },
};
