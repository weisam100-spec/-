import type { Strategy, StrategySignal } from "./types";

/**
 * 假跌破收回策略（亦稱空頭陷阱 / 假突破回落）。
 * 以過去 lookbackPeriod 根 K 棒（不含當根）的最低／最高價作為支撐／壓力；
 * 價格短暫跌破支撐（最低價低於支撐）後，於 maxReclaimBars 根 K 棒之內收盤重新站回支撐之上，
 * 視為「假跌破」（可能為誘空後反轉），形成偏多候選訊號；假突破回落邏輯對稱，形成偏空候選訊號。
 */

export interface FalseBreakoutReclaimParams extends Record<string, unknown> {
  lookbackPeriod: number;
  /** 跌破／突破後，必須在幾根 K 棒之內收盤收回，否則視為真突破失效 */
  maxReclaimBars: number;
}

export const falseBreakoutReclaimDefaultParams: FalseBreakoutReclaimParams = {
  lookbackPeriod: 20,
  maxReclaimBars: 3,
};

interface PendingSweep {
  type: "bullish" | "bearish";
  level: number;
  sweptAt: number;
}

export const falseBreakoutReclaimStrategy: Strategy<FalseBreakoutReclaimParams> = {
  id: "false-breakout-reclaim",
  name: "假跌破收回策略",
  description:
    "價格短暫跌破近期支撐後於數根 K 棒內收盤收回，視為假跌破（可能的空頭陷阱），形成偏多候選訊號；假突破回落邏輯對稱，形成偏空候選訊號。",
  defaultParams: falseBreakoutReclaimDefaultParams,

  validateParams(params) {
    const errors: string[] = [];
    if (!Number.isFinite(params.lookbackPeriod) || params.lookbackPeriod < 2 || params.lookbackPeriod > 500) {
      errors.push("支撐／壓力觀察根數必須介於 2 至 500 之間");
    }
    if (!Number.isFinite(params.maxReclaimBars) || params.maxReclaimBars < 1 || params.maxReclaimBars > 50) {
      errors.push("收回確認根數必須介於 1 至 50 之間");
    }
    return { valid: errors.length === 0, errors };
  },

  generateSignals(candles, params, ctx): StrategySignal[] {
    const n = candles.length;
    const signals: StrategySignal[] = [];
    const pending: PendingSweep[] = [];

    for (let i = params.lookbackPeriod; i < n; i++) {
      const candle = candles[i]!;
      let support = Infinity;
      let resistance = -Infinity;
      for (let j = i - params.lookbackPeriod; j < i; j++) {
        support = Math.min(support, candles[j]!.low);
        resistance = Math.max(resistance, candles[j]!.high);
      }

      // 1. 偵測新的跌破／突破（以收盤仍在關卡外側為準，避免同一次掃蕩被重複標記）
      if (candle.low < support && candle.close < support) {
        pending.push({ type: "bullish", level: support, sweptAt: i });
      }
      if (candle.high > resistance && candle.close > resistance) {
        pending.push({ type: "bearish", level: resistance, sweptAt: i });
      }

      // 2. 檢查是否收回
      for (let p = pending.length - 1; p >= 0; p--) {
        const sweep = pending[p]!;
        if (i - sweep.sweptAt > params.maxReclaimBars) {
          pending.splice(p, 1);
          continue;
        }
        if (i === sweep.sweptAt) continue;

        if (sweep.type === "bullish" && candle.close > sweep.level) {
          signals.push({
            time: candle.openTime,
            symbol: ctx.symbol,
            interval: ctx.interval,
            type: "bullish_candidate",
            price: candle.close,
            reason: `價格跌破支撐 ${sweep.level.toFixed(4)} 後於 ${i - sweep.sweptAt} 根 K 棒內收盤收回，疑似假跌破`,
            confidence: 65,
            params: { ...params },
          });
          pending.splice(p, 1);
        } else if (sweep.type === "bearish" && candle.close < sweep.level) {
          signals.push({
            time: candle.openTime,
            symbol: ctx.symbol,
            interval: ctx.interval,
            type: "bearish_candidate",
            price: candle.close,
            reason: `價格突破壓力 ${sweep.level.toFixed(4)} 後於 ${i - sweep.sweptAt} 根 K 棒內收盤回落，疑似假突破`,
            confidence: 65,
            params: { ...params },
          });
          pending.splice(p, 1);
        }
      }
    }

    return signals;
  },
};
