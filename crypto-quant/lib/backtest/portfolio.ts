import type { Interval } from "@/lib/market/symbols";
import type { Candle } from "@/lib/market/types";
import { runStrategyBacktest } from "./runPipeline";
import type { BacktestConfig, EquityPoint } from "./types";
import type { PerformanceMetrics } from "./metrics";
import type { StrategyId } from "@/lib/strategies/registry";

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_PORTFOLIO_LEGS = 6;

export interface PortfolioLegInput {
  label: string;
  symbol: string;
  interval: Interval;
  strategyId: StrategyId;
  strategyParams: Record<string, unknown>;
  candles: Candle[];
  capitalUsdt: number;
  backtestConfig: BacktestConfig;
}

export interface PortfolioLegOutput {
  label: string;
  symbol: string;
  strategyId: StrategyId;
  capitalUsdt: number;
  ok: boolean;
  error?: string;
  metrics?: PerformanceMetrics;
}

export interface PortfolioCombinedMetrics {
  initialCapital: number;
  finalEquity: number;
  totalReturnPct: number;
  buyHoldReturnPct: number;
  cagrPct: number | null;
  maxDrawdownPct: number;
  annualizedVolatilityPct: number | null;
  sharpeRatio: number | null;
}

export interface CorrelationEntry {
  legA: string;
  legB: string;
  correlation: number | null;
}

export interface PortfolioDayPoint {
  time: number;
  equity: number;
  buyHoldEquity: number;
}

export interface PortfolioResult {
  legs: PortfolioLegOutput[];
  combinedEquityCurve: PortfolioDayPoint[];
  combinedMetrics: PortfolioCombinedMetrics;
  correlations: CorrelationEntry[];
  warnings: string[];
}

function toDailySeries(points: EquityPoint[]): Map<number, { equity: number; buyHoldEquity: number }> {
  const map = new Map<number, { equity: number; buyHoldEquity: number }>();
  for (const p of points) {
    const dayKey = Math.floor(p.time / DAY_MS) * DAY_MS;
    // points 依時間遞增，同一天內後面的點會覆蓋前面的，最終保留當天最後一筆（即該日收盤時的資產）
    map.set(dayKey, { equity: p.equity, buyHoldEquity: p.buyHoldEquity });
  }
  return map;
}

function dailyReturns(equity: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    const prev = equity[i - 1]!;
    if (prev > 0) out.push((equity[i]! - prev) / prev);
  }
  return out;
}

function pearsonCorrelation(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 5) return null;
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < n; i++) {
    meanA += a[i]!;
    meanB += b[i]!;
  }
  meanA /= n;
  meanB /= n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i]! - meanA;
    const db = b[i]! - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA === 0 || varB === 0) return null;
  return cov / Math.sqrt(varA * varB);
}

function computeCombinedMetrics(points: PortfolioDayPoint[], initialCapital: number): PortfolioCombinedMetrics {
  if (points.length === 0 || initialCapital <= 0) {
    return {
      initialCapital,
      finalEquity: initialCapital,
      totalReturnPct: 0,
      buyHoldReturnPct: 0,
      cagrPct: null,
      maxDrawdownPct: 0,
      annualizedVolatilityPct: null,
      sharpeRatio: null,
    };
  }

  const finalEquity = points[points.length - 1]!.equity;
  const totalReturnPct = ((finalEquity - initialCapital) / initialCapital) * 100;
  const finalBuyHold = points[points.length - 1]!.buyHoldEquity;
  const buyHoldReturnPct = ((finalBuyHold - initialCapital) / initialCapital) * 100;

  const elapsedYears = Math.max((points[points.length - 1]!.time - points[0]!.time) / (365 * DAY_MS), 0);
  const cagrPct =
    elapsedYears >= 1 / 12 && finalEquity > 0 ? (Math.pow(finalEquity / initialCapital, 1 / elapsedYears) - 1) * 100 : null;

  let peak = points[0]!.equity;
  let maxDrawdownPct = 0;
  for (const p of points) {
    if (p.equity > peak) peak = p.equity;
    if (peak > 0) {
      const dd = ((peak - p.equity) / peak) * 100;
      if (dd > maxDrawdownPct) maxDrawdownPct = dd;
    }
  }

  const returns = dailyReturns(points.map((p) => p.equity));
  let annualizedVolatilityPct: number | null = null;
  let sharpeRatio: number | null = null;
  if (returns.length >= 2) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);
    annualizedVolatilityPct = stdDev * Math.sqrt(365) * 100;
    if (stdDev > 0) sharpeRatio = (mean / stdDev) * Math.sqrt(365);
  }

  return { initialCapital, finalEquity, totalReturnPct, buyHoldReturnPct, cagrPct, maxDrawdownPct, annualizedVolatilityPct, sharpeRatio };
}

/**
 * 組合回測：將多個「策略＋交易對」各自分配一筆獨立資金分開跑回測，
 * 再以日線為單位加總各成分的資產曲線，得到組合整體的績效與回撤，
 * 並計算各成分之間報酬率的相關係數，協助觀察分散配置的效果。
 *
 * 重要限制：這是把每個成分「各自獨立模擬」的資產曲線相加，並非真正的
 * 共用資金池、再平衡或槓桿／保證金管理；不同週期的資料以「日曆日最後一筆」
 * 對齊，沒有資料的日期會延續前一天的資產值（forward-fill），僅供分析研究參考。
 */
export function runPortfolioBacktest(legsInput: PortfolioLegInput[]): PortfolioResult {
  if (legsInput.length === 0) throw new Error("請至少加入一個組合成分");
  if (legsInput.length > MAX_PORTFOLIO_LEGS) throw new Error(`組合成分過多（上限 ${MAX_PORTFOLIO_LEGS} 個）`);

  const warnings: string[] = [];
  const legs: PortfolioLegOutput[] = [];
  const succeeded: { label: string; capitalUsdt: number; series: Map<number, { equity: number; buyHoldEquity: number }> }[] = [];

  for (const leg of legsInput) {
    try {
      const output = runStrategyBacktest({
        symbol: leg.symbol,
        interval: leg.interval,
        candles: leg.candles,
        strategyId: leg.strategyId,
        strategyParams: leg.strategyParams,
        config: leg.backtestConfig,
      });
      legs.push({
        label: leg.label,
        symbol: leg.symbol,
        strategyId: leg.strategyId,
        capitalUsdt: leg.capitalUsdt,
        ok: true,
        metrics: output.metrics,
      });
      succeeded.push({ label: leg.label, capitalUsdt: leg.capitalUsdt, series: toDailySeries(output.result.equityCurve) });
    } catch (err) {
      legs.push({
        label: leg.label,
        symbol: leg.symbol,
        strategyId: leg.strategyId,
        capitalUsdt: leg.capitalUsdt,
        ok: false,
        error: err instanceof Error ? err.message : "回測失敗",
      });
    }
  }

  if (succeeded.length === 0) {
    throw new Error("所有組合成分皆執行失敗，無法計算組合績效");
  }
  if (succeeded.length < legsInput.length) {
    warnings.push(`有 ${legsInput.length - succeeded.length} 個組合成分執行失敗，組合績效僅反映其餘成功的成分`);
  }

  const allDayKeys = new Set<number>();
  for (const s of succeeded) for (const k of s.series.keys()) allDayKeys.add(k);
  const sortedDays = [...allDayKeys].sort((a, b) => a - b);

  if (sortedDays.length < 5) {
    warnings.push("組合回測的有效天數過少，結果可能不具統計意義");
  }

  const filledByLeg = succeeded.map((s) => {
    let lastEquity = s.capitalUsdt;
    let lastBuyHold = s.capitalUsdt;
    const equity: number[] = [];
    const buyHold: number[] = [];
    for (const day of sortedDays) {
      const point = s.series.get(day);
      if (point) {
        lastEquity = point.equity;
        lastBuyHold = point.buyHoldEquity;
      }
      equity.push(lastEquity);
      buyHold.push(lastBuyHold);
    }
    return { label: s.label, capitalUsdt: s.capitalUsdt, equity, buyHold };
  });

  const combinedEquityCurve: PortfolioDayPoint[] = sortedDays.map((time, i) => ({
    time,
    equity: filledByLeg.reduce((a, l) => a + l.equity[i]!, 0),
    buyHoldEquity: filledByLeg.reduce((a, l) => a + l.buyHold[i]!, 0),
  }));

  const initialCapital = filledByLeg.reduce((a, l) => a + l.capitalUsdt, 0);
  const combinedMetrics = computeCombinedMetrics(combinedEquityCurve, initialCapital);

  const correlations: CorrelationEntry[] = [];
  for (let i = 0; i < filledByLeg.length; i++) {
    for (let j = i + 1; j < filledByLeg.length; j++) {
      correlations.push({
        legA: filledByLeg[i]!.label,
        legB: filledByLeg[j]!.label,
        correlation: pearsonCorrelation(dailyReturns(filledByLeg[i]!.equity), dailyReturns(filledByLeg[j]!.equity)),
      });
    }
  }

  return { legs, combinedEquityCurve, combinedMetrics, correlations, warnings };
}
