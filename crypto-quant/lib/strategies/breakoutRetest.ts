import type { Strategy, StrategySignal } from "./types";

/**
 * 突破後回測策略。
 * 以過去 channelPeriod 根 K 棒（不含當根）的最高／最低價作為區間上下緣；
 * 收盤價突破區間後，標記該突破水準為待回測關卡；
 * 後續價格回測該關卡（價格重新靠近但未大幅跌破／突破）且收盤仍在突破方向，
 * 形成順勢回測進場的候選訊號；關卡超過 maxRetestBars 根 K 棒仍未被回測則失效。
 */

export interface BreakoutRetestParams extends Record<string, unknown> {
  channelPeriod: number;
  /** 回測容許價格與關卡的最大相對距離（百分比），例如 0.3 代表 0.3% */
  retestTolerancePct: number;
  maxRetestBars: number;
}

export const breakoutRetestDefaultParams: BreakoutRetestParams = {
  channelPeriod: 20,
  retestTolerancePct: 0.3,
  maxRetestBars: 20,
};

interface PendingLevel {
  type: "bullish" | "bearish";
  level: number;
  createdAt: number;
}

export const breakoutRetestStrategy: Strategy<BreakoutRetestParams> = {
  id: "breakout-retest",
  name: "突破後回測策略",
  description:
    "以過去區間高低點判斷突破，記錄突破關卡；待價格回測該關卡且收盤仍站在突破方向時，形成偏多／偏空候選訊號；關卡逾期未被回測則失效。",
  defaultParams: breakoutRetestDefaultParams,

  validateParams(params) {
    const errors: string[] = [];
    if (!Number.isFinite(params.channelPeriod) || params.channelPeriod < 2 || params.channelPeriod > 500) {
      errors.push("區間觀察根數必須介於 2 至 500 之間");
    }
    if (!Number.isFinite(params.retestTolerancePct) || params.retestTolerancePct <= 0 || params.retestTolerancePct > 10) {
      errors.push("回測容許距離必須介於 0（不含）至 10% 之間");
    }
    if (!Number.isFinite(params.maxRetestBars) || params.maxRetestBars < 1 || params.maxRetestBars > 500) {
      errors.push("關卡有效期（K 棒數）必須介於 1 至 500 之間");
    }
    return { valid: errors.length === 0, errors };
  },

  generateSignals(candles, params, ctx): StrategySignal[] {
    const n = candles.length;
    const signals: StrategySignal[] = [];
    const pending: PendingLevel[] = [];
    let lastBreakoutType: "bullish" | "bearish" | null = null;

    for (let i = params.channelPeriod; i < n; i++) {
      const candle = candles[i]!;
      let channelHigh = -Infinity;
      let channelLow = Infinity;
      for (let j = i - params.channelPeriod; j < i; j++) {
        channelHigh = Math.max(channelHigh, candles[j]!.high);
        channelLow = Math.min(channelLow, candles[j]!.low);
      }

      // 1. 偵測新的突破，標記待回測關卡（同方向連續突破只標記第一次，避免重複關卡堆積）
      if (candle.close > channelHigh && lastBreakoutType !== "bullish") {
        pending.push({ type: "bullish", level: channelHigh, createdAt: i });
        lastBreakoutType = "bullish";
      } else if (candle.close < channelLow && lastBreakoutType !== "bearish") {
        pending.push({ type: "bearish", level: channelLow, createdAt: i });
        lastBreakoutType = "bearish";
      } else if (candle.close <= channelHigh && candle.close >= channelLow) {
        lastBreakoutType = null;
      }

      // 2. 檢查待回測關卡
      for (let p = pending.length - 1; p >= 0; p--) {
        const lvl = pending[p]!;
        if (i - lvl.createdAt > params.maxRetestBars) {
          pending.splice(p, 1);
          continue;
        }
        if (i === lvl.createdAt) continue;

        const distancePct = (Math.abs(candle.close - lvl.level) / lvl.level) * 100;
        if (lvl.type === "bullish") {
          const touched = candle.low <= lvl.level * (1 + params.retestTolerancePct / 100);
          if (touched && candle.close > lvl.level) {
            signals.push({
              time: candle.openTime,
              symbol: ctx.symbol,
              interval: ctx.interval,
              type: "bullish_candidate",
              price: candle.close,
              reason: `價格突破 ${params.channelPeriod} 根區間高點 ${lvl.level.toFixed(4)} 後回測該關卡（距離 ${distancePct.toFixed(2)}%）並收盤站穩上方`,
              confidence: 65,
              params: { ...params },
            });
            pending.splice(p, 1);
          }
        } else {
          const touched = candle.high >= lvl.level * (1 - params.retestTolerancePct / 100);
          if (touched && candle.close < lvl.level) {
            signals.push({
              time: candle.openTime,
              symbol: ctx.symbol,
              interval: ctx.interval,
              type: "bearish_candidate",
              price: candle.close,
              reason: `價格跌破 ${params.channelPeriod} 根區間低點 ${lvl.level.toFixed(4)} 後回測該關卡（距離 ${distancePct.toFixed(2)}%）並收盤站穩下方`,
              confidence: 65,
              params: { ...params },
            });
            pending.splice(p, 1);
          }
        }
      }
    }

    return signals;
  },
};
