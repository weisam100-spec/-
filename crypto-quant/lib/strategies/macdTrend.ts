import { macd, volumeRatio } from "@/lib/indicators";
import type { Strategy, StrategySignal } from "./types";

export interface MacdTrendParams extends Record<string, unknown> {
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
  /** 要求交叉發生在零軸之上（多頭）或之下（空頭），過濾雜訊 */
  useZeroAxisFilter: boolean;
  /** 要求成交量高於近期均量 */
  useVolumeFilter: boolean;
}

export const macdTrendDefaultParams: MacdTrendParams = {
  fastPeriod: 12,
  slowPeriod: 26,
  signalPeriod: 9,
  useZeroAxisFilter: false,
  useVolumeFilter: false,
};

export const macdTrendStrategy: Strategy<MacdTrendParams> = {
  id: "macd-trend",
  name: "MACD 趨勢策略",
  description:
    "MACD 線向上穿越訊號線形成偏多候選訊號，向下穿越形成偏空／出場候選訊號，可搭配零軸過濾與成交量過濾降低雜訊。",
  defaultParams: macdTrendDefaultParams,

  validateParams(params) {
    const errors: string[] = [];
    if (!Number.isFinite(params.fastPeriod) || params.fastPeriod < 2) {
      errors.push("快線週期需為大於等於 2 的整數");
    }
    if (!Number.isFinite(params.slowPeriod) || params.slowPeriod < 3) {
      errors.push("慢線週期需為大於等於 3 的整數");
    }
    if (params.fastPeriod >= params.slowPeriod) {
      errors.push("快線週期必須小於慢線週期");
    }
    if (!Number.isFinite(params.signalPeriod) || params.signalPeriod < 2) {
      errors.push("訊號線週期需為大於等於 2 的整數");
    }
    return { valid: errors.length === 0, errors };
  },

  generateSignals(candles, params, ctx): StrategySignal[] {
    const closes = candles.map((c) => c.close);
    const volumes = candles.map((c) => c.volume);
    const { macd: macdLine, signal } = macd(closes, params.fastPeriod, params.slowPeriod, params.signalPeriod);
    const volRatio = params.useVolumeFilter ? volumeRatio(volumes, 20) : null;

    const signals: StrategySignal[] = [];

    for (let i = 1; i < candles.length; i++) {
      const m0 = macdLine[i - 1]!;
      const m1 = macdLine[i]!;
      const sg0 = signal[i - 1]!;
      const sg1 = signal[i]!;
      if ([m0, m1, sg0, sg1].some((v) => Number.isNaN(v))) continue;

      const goldenCross = m0 <= sg0 && m1 > sg1;
      const deathCross = m0 >= sg0 && m1 < sg1;
      if (!goldenCross && !deathCross) continue;

      const bullish = goldenCross;
      const confirmations: string[] = [];
      let confirmed = true;

      if (params.useZeroAxisFilter) {
        const ok = bullish ? m1 > 0 : m1 < 0;
        if (ok) confirmations.push(`MACD 位於零軸${bullish ? "之上" : "之下"}`);
        else confirmed = false;
      }
      if (params.useVolumeFilter && volRatio) {
        const vr = volRatio[i]!;
        const ok = !Number.isNaN(vr) && vr > 1;
        if (ok) confirmations.push(`成交量為近 20 根均量的 ${vr.toFixed(2)} 倍`);
        else confirmed = false;
      }
      if (!confirmed) continue;

      const strength = Math.abs(m1 - sg1);
      const confidence = Math.round(Math.min(90, 55 + confirmations.length * 10 + Math.min(15, strength * 50)));

      signals.push({
        time: candles[i]!.openTime,
        symbol: ctx.symbol,
        interval: ctx.interval,
        type: bullish ? "bullish_candidate" : "bearish_candidate",
        price: closes[i]!,
        reason: bullish
          ? `MACD 線向上穿越訊號線${confirmations.length ? "，並通過確認：" + confirmations.join("、") : ""}`
          : `MACD 線向下穿越訊號線${confirmations.length ? "，並通過確認：" + confirmations.join("、") : ""}`,
        confidence,
        params: { ...params },
      });
    }
    return signals;
  },
};
