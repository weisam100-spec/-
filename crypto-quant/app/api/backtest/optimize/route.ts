import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { backtestConfigSchema, intervalSchema, strategyIdSchema, symbolSchema } from "@/lib/api/backtestSchema";
import { env } from "@/lib/env";
import { fetchStrategyCandles } from "@/lib/market/strategyData";
import { runParameterOptimization } from "@/lib/backtest/optimize";
import type { PerformanceMetrics } from "@/lib/backtest/metrics";
import type { StrategyId } from "@/lib/strategies/registry";
import type { Interval } from "@/lib/market/symbols";

const requestSchema = z.object({
  symbol: symbolSchema,
  interval: intervalSchema,
  strategyId: strategyIdSchema,
  strategyParams: z.record(z.string(), z.unknown()),
  config: backtestConfigSchema,
  paramGrid: z.record(z.string(), z.array(z.number()).min(1).max(10)),
  metricKey: z
    .enum(["totalReturnPct", "sharpeRatio", "sortinoRatio", "calmarRatio", "maxDrawdownPct", "winRatePct", "profitFactor", "cagrPct"])
    .default("sharpeRatio"),
  topN: z.number().int().min(1).max(50).default(10),
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
  const { symbol, interval, strategyId, strategyParams, config, paramGrid, metricKey, topN } = parsed.data;

  const { primary, correlated } = await fetchStrategyCandles({
    strategyId: strategyId as StrategyId,
    symbol,
    interval: interval as Interval,
    strategyParams,
    startTime: config.startTime,
    endTime: config.endTime,
    maxBars: env.backtestMaxBars,
  });
  if (primary.unavailable) {
    return apiError(`目前無法取得 ${symbol} 資料：${primary.unavailable.reason}`, 502, "data_unavailable");
  }
  if (primary.candles.length === 0) {
    return apiError("所選日期區間內查無資料，請調整日期範圍", 404, "no_data");
  }
  if (correlated?.unavailable) {
    return apiError(`目前無法取得比較交易對資料：${correlated.unavailable.reason}`, 502, "correlated_data_unavailable");
  }

  try {
    const result = runParameterOptimization(
      {
        symbol,
        interval: interval as Interval,
        candles: primary.candles,
        strategyId: strategyId as StrategyId,
        strategyParams,
        config,
        correlatedCandles: correlated?.candles,
      },
      paramGrid,
      metricKey as keyof PerformanceMetrics,
      topN,
    );
    return apiOk({
      ...result,
      disclaimer:
        "參數自動優化只是在這段歷史資料內窮舉組合、挑出事後表現最好的參數，組合數越多、歷史資料越短，就越容易挑到只是『運氣好』而非真正穩健的參數（過度擬合）。排名結果不是投資建議，也不保證未來仍然有效，請務必搭配 Walk-forward 分析觀察樣本外（未參與挑選）的表現後再決定是否採用。",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "參數自動優化執行失敗";
    return apiError(message, 400, "optimize_error");
  }
});
