import { bollinger, ema, macd, rollingVolatility, rsi, sma, volumeRatio } from "@/lib/indicators";
import type { FactorContribution, Strategy, StrategySignal } from "./types";

export interface MultiFactorWeights {
  emaTrend: number;
  rsi: number;
  macd: number;
  volume: number;
  bollinger: number;
  volatility: number;
}

export interface MultiFactorParams extends Record<string, unknown> {
  weights: MultiFactorWeights;
  emaShortPeriod: number;
  emaLongPeriod: number;
  rsiPeriod: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  bollingerPeriod: number;
  bollingerMultiplier: number;
  volatilityPeriod: number;
  /** 總分超過此門檻視為偏多候選，低於負值視為偏空候選 */
  scoreThreshold: number;
  /** 當前波動度相對中位波動度的倍數超過此值時，標示風險升高 */
  riskVolatilityMultiple: number;
}

export const multiFactorDefaultWeights: MultiFactorWeights = {
  emaTrend: 25,
  rsi: 20,
  macd: 20,
  volume: 10,
  bollinger: 15,
  volatility: 10,
};

export const multiFactorDefaultParams: MultiFactorParams = {
  weights: multiFactorDefaultWeights,
  emaShortPeriod: 20,
  emaLongPeriod: 50,
  rsiPeriod: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  bollingerPeriod: 20,
  bollingerMultiplier: 2,
  volatilityPeriod: 20,
  scoreThreshold: 40,
  riskVolatilityMultiple: 2,
};

const FACTOR_LABEL: Record<keyof MultiFactorWeights, string> = {
  emaTrend: "EMA 趨勢",
  rsi: "RSI",
  macd: "MACD",
  volume: "成交量",
  bollinger: "布林通道",
  volatility: "市場波動度",
};

export function validateWeights(weights: MultiFactorWeights): string[] {
  const errors: string[] = [];
  const keys = Object.keys(multiFactorDefaultWeights) as (keyof MultiFactorWeights)[];
  let sum = 0;
  for (const key of keys) {
    const v = weights[key] ?? NaN;
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      errors.push(`${FACTOR_LABEL[key]} 權重必須介於 0 至 100 之間`);
    }
    sum += v ?? 0;
  }
  if (Math.abs(sum - 100) > 0.5) {
    errors.push(`所有因子權重總和必須為 100（目前為 ${sum.toFixed(1)}）`);
  }
  return errors;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export const multiFactorStrategy: Strategy<MultiFactorParams> = {
  id: "multi-factor",
  name: "多因子綜合策略",
  description:
    "整合 EMA 趨勢、RSI、MACD、成交量、布林通道與市場波動度，將各項條件轉換為 -100 至 100 的透明分數並加權加總，正分偏多、負分偏空，每個因子的貢獻皆會顯示。",
  defaultParams: multiFactorDefaultParams,

  validateParams(params) {
    const errors: string[] = [...validateWeights(params.weights)];
    if (params.emaShortPeriod >= params.emaLongPeriod) {
      errors.push("EMA 短週期必須小於長週期");
    }
    if (params.macdFast >= params.macdSlow) {
      errors.push("MACD 快線週期必須小於慢線週期");
    }
    if (params.rsiPeriod < 2) errors.push("RSI 週期需大於等於 2");
    if (params.bollingerPeriod < 2) errors.push("布林通道週期需大於等於 2");
    if (params.scoreThreshold <= 0 || params.scoreThreshold > 100) {
      errors.push("訊號門檻必須介於 0（不含）至 100 之間");
    }
    if (params.riskVolatilityMultiple <= 1) {
      errors.push("風險波動度倍數必須大於 1");
    }
    return { valid: errors.length === 0, errors };
  },

  generateSignals(candles, params, ctx): StrategySignal[] {
    const closes = candles.map((c) => c.close);
    const volumes = candles.map((c) => c.volume);

    const emaShort = ema(closes, params.emaShortPeriod);
    const emaLong = ema(closes, params.emaLongPeriod);
    const rsiValues = rsi(closes, params.rsiPeriod);
    const { macd: macdLine, histogram } = macd(closes, params.macdFast, params.macdSlow, params.macdSignal);
    const volRatio = volumeRatio(volumes, 20);
    const { percentB } = bollinger(closes, params.bollingerPeriod, params.bollingerMultiplier);
    const vol = rollingVolatility(closes, params.volatilityPeriod);
    const volMedianSeries = sma(vol, Math.max(10, Math.floor(params.volatilityPeriod / 2)));

    const signals: StrategySignal[] = [];
    const w = params.weights;

    for (let i = 1; i < candles.length; i++) {
      const eS = emaShort[i]!;
      const eL = emaLong[i]!;
      const r = rsiValues[i]!;
      const mLine = macdLine[i]!;
      const hist = histogram[i]!;
      const vr = volRatio[i]!;
      const pB = percentB[i]!;
      const v = vol[i]!;
      const vMedian = volMedianSeries[i]!;
      const priceChange = closes[i]! - closes[i - 1]!;

      const ready = [eS, eL, r, mLine, hist, pB].every((x) => !Number.isNaN(x));
      if (!ready) continue;

      const contributions: FactorContribution[] = [];

      // EMA 趨勢：短長均線相對價差，正代表多頭排列
      const emaRaw = clamp(((eS - eL) / eL) * 2500, -100, 100);
      contributions.push({
        factor: FACTOR_LABEL.emaTrend,
        rawScore: Math.round(emaRaw),
        contribution: Math.round((emaRaw * w.emaTrend) / 100),
        detail: `短期 EMA ${eS.toFixed(2)} 相對長期 EMA ${eL.toFixed(2)} 的價差比例`,
      });

      // RSI：偏離 50 中軸的均值回歸方向（低 RSI 偏多、高 RSI 偏空）
      const rsiRaw = clamp((50 - r) * 4, -100, 100);
      contributions.push({
        factor: FACTOR_LABEL.rsi,
        rawScore: Math.round(rsiRaw),
        contribution: Math.round((rsiRaw * w.rsi) / 100),
        detail: `RSI(${params.rsiPeriod}) 目前為 ${r.toFixed(1)}`,
      });

      // MACD：柱狀圖相對價格的比例，正代表動能偏多
      const macdRaw = clamp((hist / closes[i]!) * 100000, -100, 100);
      contributions.push({
        factor: FACTOR_LABEL.macd,
        rawScore: Math.round(macdRaw),
        contribution: Math.round((macdRaw * w.macd) / 100),
        detail: `MACD 柱狀圖為 ${hist.toFixed(4)}`,
      });

      // 成交量：量能放大會放大既有價格方向的分數
      const volRaw = Number.isNaN(vr)
        ? 0
        : clamp(Math.sign(priceChange) * (vr - 1) * 100, -100, 100);
      contributions.push({
        factor: FACTOR_LABEL.volume,
        rawScore: Math.round(volRaw),
        contribution: Math.round((volRaw * w.volume) / 100),
        detail: Number.isNaN(vr) ? "資料不足" : `成交量為近 20 根均量的 ${vr.toFixed(2)} 倍`,
      });

      // 布林通道：接近上緣視為偏空（過熱），接近下緣視為偏多（超跌）
      const bollRaw = clamp((0.5 - pB) * 200, -100, 100);
      contributions.push({
        factor: FACTOR_LABEL.bollinger,
        rawScore: Math.round(bollRaw),
        contribution: Math.round((bollRaw * w.bollinger) / 100),
        detail: `布林通道相對位置 %B = ${pB.toFixed(2)}`,
      });

      // 市場波動度：波動度相對中位數越高，風險越高，分數為負（降低整體信心）
      const volatilityRaw =
        Number.isNaN(vMedian) || vMedian === 0 ? 0 : clamp(-((v / vMedian - 1) * 100), -100, 100);
      contributions.push({
        factor: FACTOR_LABEL.volatility,
        rawScore: Math.round(volatilityRaw),
        contribution: Math.round((volatilityRaw * w.volatility) / 100),
        detail:
          Number.isNaN(vMedian) || vMedian === 0
            ? "資料不足"
            : `目前波動度為中位波動度的 ${(v / vMedian).toFixed(2)} 倍`,
      });

      const totalScore = clamp(
        contributions.reduce((sum, c) => sum + c.contribution, 0),
        -100,
        100,
      );

      const isHighRisk = !Number.isNaN(vMedian) && vMedian > 0 && v / vMedian >= params.riskVolatilityMultiple;

      let type: StrategySignal["type"];
      if (isHighRisk) type = "risk_up";
      else if (totalScore >= params.scoreThreshold) type = "bullish_candidate";
      else if (totalScore <= -params.scoreThreshold) type = "bearish_candidate";
      else type = "watch";

      // 只在訊號類型改變時輸出，避免每一根都重複產生相同訊號
      const prevType = signals[signals.length - 1]?.type;
      if (type === "watch" && prevType !== undefined && prevType !== "watch") {
        // 由候選訊號轉為觀望，仍值得記錄一次
      } else if (type === "watch" && prevType === "watch") {
        continue;
      } else if (type === prevType) {
        continue;
      }

      signals.push({
        time: candles[i]!.openTime,
        symbol: ctx.symbol,
        interval: ctx.interval,
        type,
        price: closes[i]!,
        reason: isHighRisk
          ? `市場波動度達中位數的 ${(v / vMedian).toFixed(2)} 倍，風險升高，綜合分數 ${totalScore.toFixed(1)}`
          : `多因子綜合分數為 ${totalScore.toFixed(1)}（門檻 ±${params.scoreThreshold}）`,
        confidence: Math.round(Math.min(95, Math.abs(totalScore))),
        params: { ...params, weights: { ...params.weights } },
        contributions,
      });
    }
    return signals;
  },
};
