import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { symbolSchema, intervalSchema, strategyIdSchema } from "@/lib/api/backtestSchema";
import { env } from "@/lib/env";
import { fetchKlinesRange } from "@/lib/market/klinesRange";
import { requiresCorrelatedAsset, type StrategyId } from "@/lib/strategies/registry";
import { runPortfolioBacktest, MAX_PORTFOLIO_LEGS, type PortfolioLegInput } from "@/lib/backtest/portfolio";
import type { Interval } from "@/lib/market/symbols";

const legSchema = z.object({
  label: z.string().min(1).max(60),
  symbol: symbolSchema,
  interval: intervalSchema,
  strategyId: strategyIdSchema,
  strategyParams: z.record(z.string(), z.unknown()),
  capitalUsdt: z.number().positive().max(1_000_000_000),
});

const requestSchema = z.object({
  startTime: z.number().int().positive(),
  endTime: z.number().int().positive(),
  feeRatePct: z.number().min(0).max(5),
  slippageRatePct: z.number().min(0).max(5),
  positionSizePct: z.number().positive().max(100),
  stopLossPct: z.number().positive().max(99).nullable(),
  takeProfitPct: z.number().positive().nullable(),
  trailingStopPct: z.number().positive().max(99).nullable(),
  legs: z.array(legSchema).min(1).max(MAX_PORTFOLIO_LEGS),
});

export const POST = withRateLimit(async (request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("請求內容必須是合法的 JSON", 400, "invalid_json");
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("請求參數不合法：" + parsed.error.issues.map((i) => i.message).join("；"), 400, "invalid_params");
  }
  const { startTime, endTime, legs, ...sharedCost } = parsed.data;
  if (endTime <= startTime) {
    return apiError("結束日期必須晚於開始日期", 400, "invalid_date_range");
  }

  for (const leg of legs) {
    if (requiresCorrelatedAsset(leg.strategyId as StrategyId)) {
      return apiError(`「${leg.label}」使用的策略需要額外選擇比較交易對，組合回測目前尚不支援此類跨資產策略`, 400, "unsupported_strategy");
    }
  }

  const legInputs: PortfolioLegInput[] = [];
  for (const leg of legs) {
    const klinesResult = await fetchKlinesRange({
      symbol: leg.symbol,
      interval: leg.interval as Interval,
      startTime,
      endTime,
      maxBars: env.backtestMaxBars,
    });
    if (klinesResult.unavailable) {
      return apiError(`目前無法取得 ${leg.symbol} 資料：${klinesResult.unavailable.reason}`, 502, "data_unavailable");
    }
    if (klinesResult.candles.length === 0) {
      return apiError(`「${leg.label}」（${leg.symbol}）在所選日期區間內查無資料，請調整日期範圍`, 404, "no_data");
    }
    legInputs.push({
      label: leg.label,
      symbol: leg.symbol,
      interval: leg.interval as Interval,
      strategyId: leg.strategyId as StrategyId,
      strategyParams: leg.strategyParams,
      candles: klinesResult.candles,
      capitalUsdt: leg.capitalUsdt,
      backtestConfig: {
        initialCapitalUsdt: leg.capitalUsdt,
        positionSizePct: sharedCost.positionSizePct,
        feeRatePct: sharedCost.feeRatePct,
        slippageRatePct: sharedCost.slippageRatePct,
        stopLossPct: sharedCost.stopLossPct,
        takeProfitPct: sharedCost.takeProfitPct,
        trailingStopPct: sharedCost.trailingStopPct,
        maxConcurrentPositions: 1,
        direction: "long_only",
        startTime,
        endTime,
      },
    });
  }

  try {
    const result = runPortfolioBacktest(legInputs);
    return apiOk({
      ...result,
      disclaimer:
        "組合回測是把每個成分各自分配獨立資金、分開模擬後再加總資產曲線，並非真正共用資金池、再平衡或槓桿／保證金管理；不同週期的資料以日曆日對齊，缺資料的日期會延續前一天的資產值。此結果僅反映歷史資料，不代表未來績效，不構成投資建議。",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "組合回測執行失敗";
    return apiError(message, 400, "portfolio_backtest_error");
  }
});
