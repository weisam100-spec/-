import type { BacktestResult, TradeRecord } from "./types";

export interface PerformanceMetrics {
  initialCapital: number;
  finalEquity: number;
  totalReturnPct: number;
  cagrPct: number | null;
  buyHoldReturnPct: number;
  excessReturnPct: number;
  maxDrawdownPct: number;
  annualizedVolatilityPct: number | null;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  calmarRatio: number | null;
  winRatePct: number | null;
  profitFactor: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  profitLossRatio: number | null;
  tradeCount: number;
  avgHoldingMs: number | null;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  grossReturnBeforeCostPct: number;
  netReturnAfterCostPct: number;
  costDragPct: number;
  totalCostUsdt: number;
}

export interface MetricsWarning {
  code: string;
  message: string;
}

const RISK_FREE_RATE_ANNUAL = 0;

function barsPerYear(avgBarMs: number): number {
  if (avgBarMs <= 0) return 365;
  const msPerYear = 365 * 24 * 60 * 60 * 1000;
  return msPerYear / avgBarMs;
}

export function computeMetrics(
  result: BacktestResult,
): { metrics: PerformanceMetrics; warnings: MetricsWarning[] } {
  const warnings: MetricsWarning[] = [];
  const { trades, equityCurve, config } = result;
  const initialCapital = config.initialCapitalUsdt;

  if (equityCurve.length === 0) {
    warnings.push({ code: "no_data", message: "回測區間內無有效資料，無法計算績效指標" });
    return {
      metrics: emptyMetrics(initialCapital),
      warnings,
    };
  }

  const finalEquity = equityCurve[equityCurve.length - 1]!.equity;
  const totalReturnPct = ((finalEquity - initialCapital) / initialCapital) * 100;

  const firstTime = equityCurve[0]!.time;
  const lastTime = equityCurve[equityCurve.length - 1]!.time;
  const elapsedYears = Math.max((lastTime - firstTime) / (365 * 24 * 60 * 60 * 1000), 0);

  let cagrPct: number | null = null;
  if (elapsedYears >= 1 / 12 && finalEquity > 0) {
    cagrPct = (Math.pow(finalEquity / initialCapital, 1 / elapsedYears) - 1) * 100;
  } else {
    warnings.push({ code: "period_too_short", message: "回測期間過短（不足一個月），年化報酬率僅供參考" });
  }

  const finalBuyHold = equityCurve[equityCurve.length - 1]!.buyHoldEquity;
  const buyHoldReturnPct = ((finalBuyHold - initialCapital) / initialCapital) * 100;
  const excessReturnPct = totalReturnPct - buyHoldReturnPct;

  // 逐棒報酬率（用於波動度、Sharpe、Sortino）
  const barReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1]!.equity;
    const cur = equityCurve[i]!.equity;
    if (prev > 0) barReturns.push((cur - prev) / prev);
  }

  const avgBarMs =
    equityCurve.length > 1 ? (lastTime - firstTime) / (equityCurve.length - 1) : 24 * 60 * 60 * 1000;
  const bpy = barsPerYear(avgBarMs);

  let annualizedVolatilityPct: number | null = null;
  let sharpeRatio: number | null = null;
  let sortinoRatio: number | null = null;
  if (barReturns.length >= 2) {
    const mean = barReturns.reduce((a, b) => a + b, 0) / barReturns.length;
    const variance = barReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / (barReturns.length - 1);
    const stdDev = Math.sqrt(variance);
    annualizedVolatilityPct = stdDev * Math.sqrt(bpy) * 100;

    const rfPerBar = RISK_FREE_RATE_ANNUAL / bpy;
    if (stdDev > 0) {
      sharpeRatio = ((mean - rfPerBar) / stdDev) * Math.sqrt(bpy);
    }

    const downside = barReturns.filter((r) => r < rfPerBar).map((r) => (r - rfPerBar) ** 2);
    if (downside.length > 0) {
      const downsideDeviation = Math.sqrt(downside.reduce((a, b) => a + b, 0) / barReturns.length);
      if (downsideDeviation > 0) {
        sortinoRatio = ((mean - rfPerBar) / downsideDeviation) * Math.sqrt(bpy);
      }
    }
  } else {
    warnings.push({ code: "insufficient_returns", message: "有效報酬率樣本數過少，波動度／Sharpe／Sortino 無法可靠計算" });
  }

  // 最大回撤
  let peak = equityCurve[0]!.equity;
  let maxDrawdownPct = 0;
  for (const point of equityCurve) {
    if (point.equity > peak) peak = point.equity;
    if (peak > 0) {
      const drawdown = ((peak - point.equity) / peak) * 100;
      if (drawdown > maxDrawdownPct) maxDrawdownPct = drawdown;
    }
  }

  const calmarRatio = cagrPct !== null && maxDrawdownPct > 0 ? cagrPct / maxDrawdownPct : null;

  // 交易統計
  const tradeCount = trades.length;
  let winRatePct: number | null = null;
  let profitFactor: number | null = null;
  let avgWin: number | null = null;
  let avgLoss: number | null = null;
  let profitLossRatio: number | null = null;
  let avgHoldingMs: number | null = null;
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;

  if (tradeCount === 0) {
    warnings.push({ code: "no_trades", message: "回測期間內策略未產生任何成交，交易相關績效指標無法計算" });
  } else {
    const wins = trades.filter((t) => t.pnl > 0);
    const losses = trades.filter((t) => t.pnl < 0);
    winRatePct = (wins.length / tradeCount) * 100;
    const grossProfit = wins.reduce((a, t) => a + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnl, 0));
    profitFactor = grossLoss > 0 ? grossProfit / grossLoss : wins.length > 0 ? Infinity : null;
    avgWin = wins.length > 0 ? grossProfit / wins.length : null;
    avgLoss = losses.length > 0 ? grossLoss / losses.length : null;
    profitLossRatio = avgWin !== null && avgLoss !== null && avgLoss > 0 ? avgWin / avgLoss : null;
    avgHoldingMs = trades.reduce((a, t) => a + t.holdingMs, 0) / tradeCount;

    let curWinStreak = 0;
    let curLossStreak = 0;
    for (const t of trades) {
      if (t.pnl > 0) {
        curWinStreak++;
        curLossStreak = 0;
      } else if (t.pnl < 0) {
        curLossStreak++;
        curWinStreak = 0;
      } else {
        curWinStreak = 0;
        curLossStreak = 0;
      }
      maxConsecutiveWins = Math.max(maxConsecutiveWins, curWinStreak);
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, curLossStreak);
    }

    if (tradeCount < 20) {
      warnings.push({ code: "small_sample", message: `交易樣本數僅 ${tradeCount} 筆，統計意義有限，績效指標可能不穩定` });
    }
  }

  const totalCostUsdt = trades.reduce((a, t) => a + t.totalCost, 0);
  const pnlBeforeCostSum = trades.reduce((a, t) => a + t.pnlBeforeCost, 0);
  const grossReturnBeforeCostPct = (pnlBeforeCostSum / initialCapital) * 100;
  const netReturnAfterCostPct = totalReturnPct;
  const costDragPct = grossReturnBeforeCostPct - netReturnAfterCostPct;

  if (maxDrawdownPct > 40) {
    warnings.push({ code: "high_drawdown", message: `最大回撤達 ${maxDrawdownPct.toFixed(1)}%，風險偏高，請審慎評估` });
  }

  return {
    metrics: {
      initialCapital,
      finalEquity,
      totalReturnPct,
      cagrPct,
      buyHoldReturnPct,
      excessReturnPct,
      maxDrawdownPct,
      annualizedVolatilityPct,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      winRatePct,
      profitFactor,
      avgWin,
      avgLoss,
      profitLossRatio,
      tradeCount,
      avgHoldingMs,
      maxConsecutiveWins,
      maxConsecutiveLosses,
      grossReturnBeforeCostPct,
      netReturnAfterCostPct,
      costDragPct,
      totalCostUsdt,
    },
    warnings,
  };
}

function emptyMetrics(initialCapital: number): PerformanceMetrics {
  return {
    initialCapital,
    finalEquity: initialCapital,
    totalReturnPct: 0,
    cagrPct: null,
    buyHoldReturnPct: 0,
    excessReturnPct: 0,
    maxDrawdownPct: 0,
    annualizedVolatilityPct: null,
    sharpeRatio: null,
    sortinoRatio: null,
    calmarRatio: null,
    winRatePct: null,
    profitFactor: null,
    avgWin: null,
    avgLoss: null,
    profitLossRatio: null,
    tradeCount: 0,
    avgHoldingMs: null,
    maxConsecutiveWins: 0,
    maxConsecutiveLosses: 0,
    grossReturnBeforeCostPct: 0,
    netReturnAfterCostPct: 0,
    costDragPct: 0,
    totalCostUsdt: 0,
  };
}

export const METRIC_EXPLANATIONS: Record<keyof PerformanceMetrics, string> = {
  initialCapital: "回測開始時投入的模擬資金。",
  finalEquity: "回測結束時的模擬總資產（現金＋持倉市值）。",
  totalReturnPct: "期末資產相對初始資金的總報酬率。",
  cagrPct: "將總報酬率換算為年化報酬率，方便跨期間比較；期間不足一個月時不計算。",
  buyHoldReturnPct: "同期間單純買進並持有不交易的報酬率，作為策略比較基準。",
  excessReturnPct: "策略報酬率減去買進持有報酬率，代表策略是否優於單純持有。",
  maxDrawdownPct: "資產從高點回落的最大跌幅，衡量策略可能面臨的最大帳面虧損。",
  annualizedVolatilityPct: "報酬率的年化標準差，衡量資產波動的劇烈程度。",
  sharpeRatio: "超額報酬（相對無風險利率）除以總波動度，數值越高代表風險調整後報酬越好。",
  sortinoRatio: "與 Sharpe 類似，但只計算下跌波動，避免上漲波動被誤認為風險。",
  calmarRatio: "年化報酬率除以最大回撤，衡量報酬與最大虧損風險的比例。",
  winRatePct: "獲利交易筆數占總交易筆數的比例。",
  profitFactor: "總獲利金額除以總虧損金額（取絕對值），大於 1 代表整體是賺錢的。",
  avgWin: "所有獲利交易的平均獲利金額。",
  avgLoss: "所有虧損交易的平均虧損金額（取絕對值）。",
  profitLossRatio: "平均獲利除以平均虧損，代表每筆交易的賺賠比。",
  tradeCount: "回測期間內完成的交易筆數。",
  avgHoldingMs: "平均每筆交易的持倉時間。",
  maxConsecutiveWins: "歷史上最長的連續獲利交易次數。",
  maxConsecutiveLosses: "歷史上最長的連續虧損交易次數，可用來評估心理壓力與資金控管需求。",
  grossReturnBeforeCostPct: "未扣除手續費與滑價前的總報酬率。",
  netReturnAfterCostPct: "扣除手續費與滑價後的實際總報酬率。",
  costDragPct: "交易成本（手續費＋滑價）對總報酬率造成的拖累幅度。",
  totalCostUsdt: "回測期間累計支付的手續費與滑價成本（USDT）。",
};

export function summarizeTradesForExport(trades: TradeRecord[]) {
  return trades.map((t) => ({
    entryTime: t.entryTime,
    entryPrice: t.entryPrice,
    exitTime: t.exitTime,
    exitPrice: t.exitPrice,
    quantity: t.quantity,
    totalCost: t.totalCost,
    pnl: t.pnl,
    returnPct: t.returnPct,
    holdingMs: t.holdingMs,
    entryReason: t.entryReason,
    exitReason: t.exitReason,
  }));
}
