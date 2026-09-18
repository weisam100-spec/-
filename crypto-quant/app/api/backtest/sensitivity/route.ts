import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { backtestConfigSchema, intervalSchema, strategyIdSchema, symbolSchema } from "@/lib/api/backtestSchema";
import { env } from "@/lib/env";
import { fetchKlinesRange } from "@/lib/market/klinesRange";
import { runSensitivityAnalysis, type SensitivityAxis } from "@/lib/backtest/sensitivity";
import type { PerformanceMetrics } from "@/lib/backtest/metrics";
import type { StrategyId } from "@/lib/strategies/registry";
import type { Interval } from "@/lib/market/symbols";

const axisSchema = z.object({
  target: z.enum(["strategy", "config"]),
  key: z.string().min(1).max(60),
  label: z.string().min(1).max(60),
  values: z.array(z.number()).min(2).max(12),
});

const requestSchema = z.object({
  symbol: symbolSchema,
  interval: intervalSchema,
  strategyId: strategyIdSchema,
  strategyParams: z.record(z.string(), z.unknown()),
  config: backtestConfigSchema,
  xAxis: axisSchema,
  yAxis: axisSchema,
  metricKey: z
    .enum(["totalReturnPct", "sharpeRatio", "maxDrawdownPct", "winRatePct", "profitFactor", "cagrPct"])
    .default("totalReturnPct"),
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
  const { symbol, interval, strategyId, strategyParams, config, xAxis, yAxis, metricKey } = parsed.data;

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
    const { cells, warnings } = runSensitivityAnalysis(
      {
        symbol,
        interval: interval as Interval,
        candles: klinesResult.candles,
        strategyId: strategyId as StrategyId,
        strategyParams,
        config,
      },
      xAxis as SensitivityAxis,
      yAxis as SensitivityAxis,
      metricKey as keyof PerformanceMetrics,
    );
    return apiOk({
      cells,
      warnings,
      xAxis,
      yAxis,
      metricKey,
      disclaimer: "敏感度分析結果僅反映該歷史區間，任何看似『最佳』的參數組合都不保證未來仍然最佳，請留意過度擬合風險。",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "敏感度分析執行失敗";
    return apiError(message, 400, "sensitivity_error");
  }
});
