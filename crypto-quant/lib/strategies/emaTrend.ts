import { ema, volumeRatio, rsi } from "@/lib/indicators";
import type { Strategy, StrategySignal } from "./types";

export interface EmaTrendParams extends Record<string, unknown> {
  shortPeriod: number;
  longPeriod: number;
  /** 以收盤價站上/跌破長均線作為突破確認 */
  confirmClose: boolean;
  /** 要求成交量高於近期均量作為確認 */
  confirmVolume: boolean;
  /** 要求 RSI 方向一致作為確認（多頭需 RSI>50，空頭需 RSI<50） */
  confirmRsi: boolean;
}

export const emaTrendDefaultParams: EmaTrendParams = {
  shortPeriod: 20,
  longPeriod: 50,
  confirmClose: true,
  confirmVolume: false,
  confirmRsi: false,
};

export const emaTrendStrategy: Strategy<EmaTrendParams> = {
  id: "ema-trend",
  name: "EMA 趨勢策略",
  description:
    "短期 EMA 向上穿越長期 EMA 形成偏多候選訊號，向下穿越形成偏空／出場候選訊號，可選擇以收盤價突破、成交量放大或 RSI 方向作為額外確認條件。",
  defaultParams: emaTrendDefaultParams,

  validateParams(params) {
    const errors: string[] = [];
    if (!Number.isFinite(params.shortPeriod) || params.shortPeriod < 2) {
      errors.push("短期 EMA 週期需為大於等於 2 的整數");
    }
    if (!Number.isFinite(params.longPeriod) || params.longPeriod < 3) {
      errors.push("長期 EMA 週期需為大於等於 3 的整數");
    }
    if (params.shortPeriod >= params.longPeriod) {
      errors.push("短期 EMA 週期必須小於長期 EMA 週期");
    }
    if (params.longPeriod > 500) {
      errors.push("長期 EMA 週期不可超過 500，避免暖機期過長導致資料不足");
    }
    return { valid: errors.length === 0, errors };
  },

  generateSignals(candles, params, ctx): StrategySignal[] {
    const closes = candles.map((c) => c.close);
    const volumes = candles.map((c) => c.volume);
    const emaShort = ema(closes, params.shortPeriod);
    const emaLong = ema(closes, params.longPeriod);
    const volRatio = params.confirmVolume ? volumeRatio(volumes, 20) : null;
    const rsiValues = params.confirmRsi ? rsi(closes, 14) : null;

    const signals: StrategySignal[] = [];

    for (let i = 1; i < candles.length; i++) {
      const s0 = emaShort[i - 1]!;
      const s1 = emaShort[i]!;
      const l0 = emaLong[i - 1]!;
      const l1 = emaLong[i]!;
      if ([s0, s1, l0, l1].some((v) => Number.isNaN(v))) continue;

      const goldenCross = s0 <= l0 && s1 > l1;
      const deathCross = s0 >= l0 && s1 < l1;
      if (!goldenCross && !deathCross) continue;

      const bullish = goldenCross;
      const close = closes[i]!;
      const confirmations: string[] = [];
      let confirmed = true;

      if (params.confirmClose) {
        const ok = bullish ? close > l1 : close < l1;
        if (ok) confirmations.push("收盤價已站上/跌破長期 EMA");
        else confirmed = false;
      }
      if (params.confirmVolume && volRatio) {
        const vr = volRatio[i]!;
        const ok = !Number.isNaN(vr) && vr > 1;
        if (ok) confirmations.push(`成交量為近 20 根均量的 ${vr.toFixed(2)} 倍`);
        else confirmed = false;
      }
      if (params.confirmRsi && rsiValues) {
        const r = rsiValues[i]!;
        const ok = !Number.isNaN(r) && (bullish ? r > 50 : r < 50);
        if (ok) confirmations.push(`RSI(${r.toFixed(1)}) 方向與訊號一致`);
        else confirmed = false;
      }

      if (!confirmed) continue;

      const spreadPct = (Math.abs(s1 - l1) / l1) * 100;
      const confidence = Math.min(95, 55 + confirmations.length * 10 + Math.min(20, spreadPct * 20));

      signals.push({
        time: candles[i]!.openTime,
        symbol: ctx.symbol,
        interval: ctx.interval,
        type: bullish ? "bullish_candidate" : "bearish_candidate",
        price: close,
        reason: bullish
          ? `短期 EMA(${params.shortPeriod}) 向上穿越長期 EMA(${params.longPeriod})，形成黃金交叉${
              confirmations.length ? "，並通過確認：" + confirmations.join("、") : ""
            }`
          : `短期 EMA(${params.shortPeriod}) 向下穿越長期 EMA(${params.longPeriod})，形成死亡交叉${
              confirmations.length ? "，並通過確認：" + confirmations.join("、") : ""
            }`,
        confidence: Math.round(confidence),
        params: { ...params },
      });
    }
    return signals;
  },
};
