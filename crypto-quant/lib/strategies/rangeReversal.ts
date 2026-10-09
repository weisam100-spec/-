import { isBearishReversalCandle, isBullishReversalCandle } from "./candlePatterns";
import type { Strategy, StrategySignal } from "./types";

/**
 * 區間支撐／壓力＋反轉K線策略。
 * 以過去 rangePeriod 根 K 棒（不含當根）的最低／最高價作為區間支撐／壓力；
 * 價格觸及支撐（或壓力）附近，且當根（或搭配前一根）K 棒形成槌子線／吞噬等反轉型態時，
 * 形成偏多（或偏空）候選訊號。
 */

export interface RangeReversalParams extends Record<string, unknown> {
  rangePeriod: number;
  /** 價格與支撐／壓力的最大相對距離（百分比）才算「觸及」 */
  touchTolerancePct: number;
}

export const rangeReversalDefaultParams: RangeReversalParams = {
  rangePeriod: 20,
  touchTolerancePct: 0.5,
};

export const rangeReversalStrategy: Strategy<RangeReversalParams> = {
  id: "range-reversal",
  name: "區間支撐＋反轉K線策略",
  description:
    "以過去區間最低／最高價作為支撐／壓力，當價格觸及支撐並出現槌子線或多頭吞噬等反轉型態時形成偏多候選訊號；觸及壓力並出現流星線或空頭吞噬時形成偏空候選訊號。",
  defaultParams: rangeReversalDefaultParams,

  validateParams(params) {
    const errors: string[] = [];
    if (!Number.isFinite(params.rangePeriod) || params.rangePeriod < 2 || params.rangePeriod > 500) {
      errors.push("區間觀察根數必須介於 2 至 500 之間");
    }
    if (!Number.isFinite(params.touchTolerancePct) || params.touchTolerancePct <= 0 || params.touchTolerancePct > 10) {
      errors.push("觸及容許距離必須介於 0（不含）至 10% 之間");
    }
    return { valid: errors.length === 0, errors };
  },

  generateSignals(candles, params, ctx): StrategySignal[] {
    const n = candles.length;
    const signals: StrategySignal[] = [];

    for (let i = params.rangePeriod; i < n; i++) {
      const candle = candles[i]!;
      const prev = candles[i - 1]!;
      let support = Infinity;
      let resistance = -Infinity;
      for (let j = i - params.rangePeriod; j < i; j++) {
        support = Math.min(support, candles[j]!.low);
        resistance = Math.max(resistance, candles[j]!.high);
      }

      const nearSupport = candle.low <= support * (1 + params.touchTolerancePct / 100);
      const nearResistance = candle.high >= resistance * (1 - params.touchTolerancePct / 100);

      if (nearSupport) {
        const { matched, pattern } = isBullishReversalCandle(prev, candle);
        if (matched) {
          signals.push({
            time: candle.openTime,
            symbol: ctx.symbol,
            interval: ctx.interval,
            type: "bullish_candidate",
            price: candle.close,
            reason: `價格觸及區間支撐 ${support.toFixed(4)} 附近，並出現${pattern}反轉型態`,
            confidence: 60,
            params: { ...params },
          });
          continue;
        }
      }
      if (nearResistance) {
        const { matched, pattern } = isBearishReversalCandle(prev, candle);
        if (matched) {
          signals.push({
            time: candle.openTime,
            symbol: ctx.symbol,
            interval: ctx.interval,
            type: "bearish_candidate",
            price: candle.close,
            reason: `價格觸及區間壓力 ${resistance.toFixed(4)} 附近，並出現${pattern}反轉型態`,
            confidence: 60,
            params: { ...params },
          });
        }
      }
    }

    return signals;
  },
};
