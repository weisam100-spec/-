import type {
  AIScoreBreakdown,
  FundamentalData,
  InstitutionalTrading,
  MarginTrading,
  OhlcvBar,
  QuarterlyEps,
  TechnicalIndicators,
} from "@/lib/types/stock";

export interface RiskWarning {
  code: string;
  label: string;
}

export interface AIScoreInputs {
  bars: OhlcvBar[];
  indicators: TechnicalIndicators;
  fundamentals: FundamentalData;
  quarterlyEps: QuarterlyEps[];
  institutional: InstitutionalTrading;
  margin: MarginTrading;
}

export function computeEpsYoY(quarterlyEps: QuarterlyEps[]): number | null {
  if (quarterlyEps.length < 5) return null;
  const last = quarterlyEps[quarterlyEps.length - 1].eps;
  const yearAgo = quarterlyEps[quarterlyEps.length - 5].eps;
  if (yearAgo === 0) return null;
  return ((last - yearAgo) / yearAgo) * 100;
}

/** Rule-based risk flags — same list feeds the score's risk deduction and
 * the "主要風險" section shown to the user (section 14 of the spec). */
export function detectRiskWarnings(inputs: AIScoreInputs): RiskWarning[] {
  const { bars, indicators, fundamentals, quarterlyEps, institutional } = inputs;
  const price = bars[bars.length - 1].close;
  const warnings: RiskWarning[] = [];

  if (indicators.rsi14 > 75) {
    warnings.push({ code: "rsi_overheat", label: "短線過熱（RSI > 75）" });
  }
  if (indicators.ma.ma20 !== null) {
    const deviation = ((price - indicators.ma.ma20) / indicators.ma.ma20) * 100;
    if (deviation > 15) {
      warnings.push({ code: "ma20_deviation", label: "股價乖離偏高（高於月線逾15%）" });
    }
  }
  if (indicators.volumeStats.ratioVsAvg20 > 2) {
    warnings.push({ code: "volume_spike", label: "成交量異常放大（逾20日均量2倍）" });
  }
  const epsYoY = computeEpsYoY(quarterlyEps);
  if (epsYoY !== null && epsYoY < 0) {
    warnings.push({ code: "eps_decline", label: "獲利成長放緩（EPS年減）" });
  }
  if (institutional.foreign.last5d < 0 && institutional.trust.last5d < 0) {
    warnings.push({ code: "institutional_selling", label: "法人籌碼轉弱（外資投信連續賣超）" });
  }
  if (fundamentals.revenueYoY < 0) {
    warnings.push({ code: "revenue_decline", label: "營收年增轉負" });
  }

  return warnings;
}

function scoreTechnical(bars: OhlcvBar[], indicators: TechnicalIndicators): number {
  const price = bars[bars.length - 1].close;
  let score = 0;
  if (indicators.ma.ma20 !== null && price > indicators.ma.ma20) score += 5;
  if (indicators.ma.ma60 !== null && price > indicators.ma.ma60) score += 5;
  if (
    indicators.ma.ma20 !== null &&
    indicators.ma.ma60 !== null &&
    indicators.ma.ma20 > indicators.ma.ma60
  )
    score += 5;
  if (indicators.macd.signal === "golden_cross") score += 5;
  if (indicators.rsi14 >= 50 && indicators.rsi14 <= 65) score += 5;
  if (indicators.volumeStats.ratioVsAvg20 > 1) score += 5;
  return score;
}

function scoreFundamental(fundamentals: FundamentalData, epsYoY: number | null): number {
  let score = 0;
  if (epsYoY !== null && epsYoY > 20) score += 10;
  if (fundamentals.revenueYoY > 15) score += 10;
  if (fundamentals.roe > 15) score += 5;
  if (fundamentals.grossMarginTrend === "up") score += 5;
  return score;
}

function scoreChip(institutional: InstitutionalTrading, margin: MarginTrading): number {
  let score = 0;
  if (institutional.foreign.last5d > 0) score += 8;
  if (institutional.trust.last5d > 0) score += 8;
  if (margin.marginChange < 0) score += 4;
  return score;
}

function scoreMomentum(bars: OhlcvBar[]): number {
  let score = 0;
  const n = bars.length;
  if (n > 6 && bars[n - 6].close > 0) {
    const roc5 = (bars[n - 1].close - bars[n - 6].close) / bars[n - 6].close;
    if (roc5 > 0) score += 5;
  }
  if (n > 21 && bars[n - 21].close > 0) {
    const roc20 = (bars[n - 1].close - bars[n - 21].close) / bars[n - 21].close;
    if (roc20 > 0) score += 5;
  }
  return score;
}

export function computeAIScore(inputs: AIScoreInputs): {
  breakdown: AIScoreBreakdown;
  riskWarnings: RiskWarning[];
} {
  const { bars, indicators, fundamentals, quarterlyEps, institutional, margin } = inputs;
  const epsYoY = computeEpsYoY(quarterlyEps);
  const riskWarnings = detectRiskWarnings(inputs);

  const technical = scoreTechnical(bars, indicators);
  const fundamental = scoreFundamental(fundamentals, epsYoY);
  const chip = scoreChip(institutional, margin);
  const momentum = scoreMomentum(bars);
  const risk = Math.max(0, 10 - riskWarnings.length * 2);

  const total = technical + fundamental + chip + momentum + risk;
  const label: AIScoreBreakdown["label"] = total >= 65 ? "偏多" : total <= 40 ? "偏空" : "中性";

  return {
    breakdown: { technical, fundamental, chip, momentum, risk, total, label },
    riskWarnings,
  };
}
