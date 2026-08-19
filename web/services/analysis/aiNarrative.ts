import type {
  AIAnalysisResult,
  AIScoreBreakdown,
  FundamentalData,
  InstitutionalTrading,
  OhlcvBar,
  TechnicalAnalysisResult,
  TechnicalIndicators,
} from "@/lib/types/stock";
import type { TechnicalClassification } from "./technicalIndicators";
import type { RiskWarning } from "./aiScore";
import { computeEpsYoY } from "./aiScore";

// All strings here are produced by deterministic rules/templates, not an
// LLM call — the numbers driving them come straight from the analysis
// engines, so the wording never contradicts the data shown on screen.

function formatPercent(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function buildVolumeNarrative(indicators: TechnicalIndicators): string {
  const { today, avg20, ratioVsAvg20 } = indicators.volumeStats;
  if (avg20 <= 0) return "成交量資料尚不足以比較。";
  if (ratioVsAvg20 >= 1.5) {
    return `今日成交量 ${today.toLocaleString()} 張，為20日均量 ${avg20.toLocaleString()} 張的 ${ratioVsAvg20.toFixed(2)} 倍，市場交易熱度明顯提高。`;
  }
  if (ratioVsAvg20 >= 1.1) {
    return `今日成交量 ${today.toLocaleString()} 張，略高於20日均量 ${avg20.toLocaleString()} 張（${ratioVsAvg20.toFixed(2)} 倍），交易熱度略有提升。`;
  }
  if (ratioVsAvg20 <= 0.7) {
    return `今日成交量 ${today.toLocaleString()} 張，明顯低於20日均量 ${avg20.toLocaleString()} 張（${ratioVsAvg20.toFixed(2)} 倍），交投轉為清淡。`;
  }
  return `今日成交量 ${today.toLocaleString()} 張，與20日均量 ${avg20.toLocaleString()} 張相近（${ratioVsAvg20.toFixed(2)} 倍），量能持平。`;
}

export function buildTechnicalNarrative(
  classification: TechnicalClassification,
  indicators: TechnicalIndicators
): string {
  const parts: string[] = [];

  const aboveLabels: string[] = [];
  if (classification.aboveMa5) aboveLabels.push("5日線");
  if (classification.aboveMa20) aboveLabels.push("20日線");
  if (classification.aboveMa60) aboveLabels.push("60日線");
  if (aboveLabels.length > 0) {
    parts.push(`股價目前站上${aboveLabels.join("、")}`);
  } else {
    parts.push("股價目前尚未站回主要均線之上");
  }
  parts.push(`，短中期均線呈現${classification.trendPattern}`);

  const rsiText =
    classification.rsiZone === "overbought"
      ? `RSI(14) 為 ${indicators.rsi14}，已進入過熱區，須留意短線追價風險`
      : classification.rsiZone === "oversold"
        ? `RSI(14) 為 ${indicators.rsi14}，接近超賣區，短線或有反彈機會`
        : `RSI(14) 為 ${indicators.rsi14}，處於中性區間`;

  const macdText =
    indicators.macd.signal === "golden_cross"
      ? "MACD 出現黃金交叉，多方動能轉強"
      : indicators.macd.signal === "death_cross"
        ? "MACD 出現死亡交叉，空方動能轉強"
        : indicators.macd.signal === "bullish"
          ? "MACD 柱狀圖維持在零軸之上，多方動能延續"
          : "MACD 柱狀圖位於零軸之下，空方動能延續";

  const kdText =
    indicators.kd.signal === "golden_cross"
      ? `KD 出現黃金交叉（K=${indicators.kd.k} D=${indicators.kd.d}），短線偏多`
      : indicators.kd.signal === "death_cross"
        ? `KD 出現死亡交叉（K=${indicators.kd.k} D=${indicators.kd.d}），短線轉弱`
        : indicators.kd.signal === "overbought"
          ? `KD 值偏高（K=${indicators.kd.k} D=${indicators.kd.d}），接近超買`
          : indicators.kd.signal === "oversold"
            ? `KD 值偏低（K=${indicators.kd.k} D=${indicators.kd.d}），接近超賣`
            : `KD 值 K=${indicators.kd.k} D=${indicators.kd.d}，尚無明確訊號`;

  return `${parts.join("")}。${rsiText}；${macdText}；${kdText}。`;
}

export function buildTechnicalAnalysis(
  bars: OhlcvBar[],
  indicators: TechnicalIndicators,
  classification: TechnicalClassification
): TechnicalAnalysisResult {
  return {
    ...classification,
    narrative: buildTechnicalNarrative(classification, indicators),
    volumeNarrative: buildVolumeNarrative(indicators),
  };
}

function buildFundamentalSummary(fundamentals: FundamentalData, epsYoY: number | null): string {
  const epsText =
    epsYoY === null
      ? "近期EPS資料不足以計算年增率"
      : epsYoY > 0
        ? `近幾季EPS呈現年增成長（約 ${formatPercent(epsYoY)}）`
        : `近幾季EPS年增轉為衰退（約 ${formatPercent(epsYoY)}）`;
  const revenueText =
    fundamentals.revenueYoY > 0
      ? `營收亦維持年增（${formatPercent(fundamentals.revenueYoY)}）`
      : `營收年增轉為負成長（${formatPercent(fundamentals.revenueYoY)}）`;
  const overall =
    epsYoY !== null && epsYoY > 0 && fundamentals.revenueYoY > 0
      ? "基本面目前仍偏正向。"
      : "基本面呈現分歧或轉弱訊號，建議留意後續財報變化。";
  return `${epsText}，${revenueText}，${overall}`;
}

function buildChipSummary(institutional: InstitutionalTrading): string {
  return institutional.narrative;
}

function buildTrendSummary(
  classification: TechnicalClassification,
  score: AIScoreBreakdown
): string {
  const shortTerm =
    classification.trendPattern === "多頭排列"
      ? "短線偏多"
      : classification.trendPattern === "空頭排列"
        ? "短線偏空"
        : "短線震盪";
  const midTerm =
    score.label === "偏多" ? "中期震盪偏多" : score.label === "偏空" ? "中期震盪偏空" : "中期區間整理";
  return `${shortTerm}，${midTerm}。`;
}

export function buildAIAnalysis(
  bars: OhlcvBar[],
  indicators: TechnicalIndicators,
  classification: TechnicalClassification,
  fundamentals: FundamentalData,
  quarterlyEpsForYoY: Parameters<typeof computeEpsYoY>[0],
  institutional: InstitutionalTrading,
  score: AIScoreBreakdown,
  riskWarnings: RiskWarning[]
): AIAnalysisResult {
  const epsYoY = computeEpsYoY(quarterlyEpsForYoY);
  return {
    trendSummary: buildTrendSummary(classification, score),
    technicalSummary: buildTechnicalNarrative(classification, indicators),
    fundamentalSummary: buildFundamentalSummary(fundamentals, epsYoY),
    chipSummary: buildChipSummary(institutional),
    riskWarnings: riskWarnings.map((w) => w.label),
  };
}
