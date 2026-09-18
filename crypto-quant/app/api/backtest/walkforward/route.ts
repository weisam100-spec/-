import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { backtestConfigSchema, intervalSchema, strategyIdSchema, symbolSchema } from "@/lib/api/backtestSchema";
import { env } from "@/lib/env";
import { fetchKlinesRange } from "@/lib/market/klinesRange";
import { runWalkForward } from "@/lib/backtest/walkforward";
import type { PerformanceMetrics } from "@/lib/backtest/metrics";
import type { StrategyId } from "@/lib/strategies/registry";
import type { Interval } from "@/lib/market/symbols";

const requestSchema = z.object({
  symbol: symbolSchema,
  interval: intervalSchema,
  strategyId: strategyIdSchema,
  strategyParams: z.record(z.string(), z.unknown()),
  config: backtestConfigSchema,
  paramGrid: z.record(z.string(), z.array(z.number()).min(1).max(6)),
  metricKey: z
    .enum(["totalReturnPct", "sharpeRatio", "maxDrawdownPct", "winRatePct", "profitFactor", "cagrPct"])
    .default("sharpeRatio"),
  folds: z.number().int().min(1).max(8).default(4),
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
  const { symbol, interval, strategyId, strategyParams, config, paramGrid, metricKey, folds } = parsed.data;

  const klinesResult = await fetchKlinesRange({
    symbol,
    interval: interval as Interval,
    startTime: config.startTime,
    endTime: config.endTime,
    maxBars: env.backtestMaxBars,
  });
  if (klinesResult.unavailable) {
    return apiError(`目前無法取得 ${symbol} 資料：${klinesResult.unavailable.reason}`, 502, "data_unavailable");
  }
  if (klinesResult.candles.length === 0) {
    return apiError("所選日期區間內查無資料，請調整日期範圍", 404, "no_data");
  }

  try {
    const result = runWalkForward(
      {
        symbol,
        interval: interval as Interval,
        candles: klinesResult.candles,
        strategyId: strategyId as StrategyId,
        strategyParams,
        config,
      },
      paramGrid,
      metricKey as keyof PerformanceMetrics,
      folds,
    );
    return apiOk({
      ...result,
      disclaimer:
        "各區塊挑選出的『最佳參數』僅代表該訓練區間內的歷史表現最佳，並非未來仍然有效的保證，測試期（樣本外）表現才是較貼近真實情況的參考。",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "walk-forward 分析執行失敗";
    return apiError(message, 400, "walkforward_error");
  }
});
