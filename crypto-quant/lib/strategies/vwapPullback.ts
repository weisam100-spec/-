import { sessionVwap } from "@/lib/indicators";
import type { Strategy, StrategySignal } from "./types";

/**
 * VWAP 回踩延續策略。
 * VWAP（成交量加權平均價，依 UTC 日曆日重置）做為當日多空偏向的參考線：
 * 若最近 minBiasBars 根收盤價皆站在 VWAP 上方（偏多格局），價格回踩觸及 VWAP 後
 * 同根收盤重新站上，視為偏多候選訊號（順勢回踩延續）；偏空格局邏輯對稱。
 */

export interface VwapPullbackParams extends Record<string, unknown> {
  /** 至少連續幾根收盤在 VWAP 同一側，才視為當日偏向已經成立 */
  minBiasBars: number;
  cooldownBars: number;
}

export const vwapPullbackDefaultParams: VwapPullbackParams = {
  minBiasBars: 3,
  cooldownBars: 3,
};

export const vwapPullbackStrategy: Strategy<VwapPullbackParams> = {
  id: "vwap-pullback",
  name: "VWAP 回踩延續策略",
  description:
    "以成交量加權平均價（VWAP，依日重置）判斷當日多空偏向，價格回踩觸及 VWAP 後同根收盤站回偏向方向時，形成順勢延續的偏多／偏空候選訊號。",
  defaultParams: vwapPullbackDefaultParams,

  validateParams(params) {
    const errors: string[] = [];
    if (!Number.isFinite(params.minBiasBars) || params.minBiasBars < 1 || params.minBiasBars > 200) {
      errors.push("偏向確認根數必須介於 1 至 200 之間");
    }
    if (!Number.isFinite(params.cooldownBars) || params.cooldownBars < 0 || params.cooldownBars > 200) {
      errors.push("訊號冷卻根數必須介於 0 至 200 之間");
    }
    return { valid: errors.length === 0, errors };
  },

  generateSignals(candles, params, ctx): StrategySignal[] {
    const vwap = sessionVwap(candles);
    const n = candles.length;
    const signals: StrategySignal[] = [];
    let lastSignalBar = -Infinity;

    for (let i = params.minBiasBars; i < n; i++) {
      const v = vwap[i]!;
      if (Number.isNaN(v)) continue;
      if (i - lastSignalBar < params.cooldownBars) continue;

      const candle = candles[i]!;

      let biasUp = true;
      let biasDown = true;
      for (let j = i - params.minBiasBars; j < i; j++) {
        const vj = vwap[j]!;
        if (Number.isNaN(vj)) {
          biasUp = false;
          biasDown = false;
          break;
        }
        if (candles[j]!.close <= vj) biasUp = false;
        if (candles[j]!.close >= vj) biasDown = false;
      }

      if (biasUp && candle.low <= v && candle.close > v) {
        signals.push({
          time: candle.openTime,
          symbol: ctx.symbol,
          interval: ctx.interval,
          type: "bullish_candidate",
          price: candle.close,
          reason: `近 ${params.minBiasBars} 根收盤皆在 VWAP（${v.toFixed(4)}）上方，價格回踩觸及後收盤站回上方`,
          confidence: 60,
          params: { ...params },
        });
        lastSignalBar = i;
      } else if (biasDown && candle.high >= v && candle.close < v) {
        signals.push({
          time: candle.openTime,
          symbol: ctx.symbol,
          interval: ctx.interval,
          type: "bearish_candidate",
          price: candle.close,
          reason: `近 ${params.minBiasBars} 根收盤皆在 VWAP（${v.toFixed(4)}）下方，價格反彈觸及後收盤跌回下方`,
          confidence: 60,
          params: { ...params },
        });
        lastSignalBar = i;
      }
    }

    return signals;
  },
};
