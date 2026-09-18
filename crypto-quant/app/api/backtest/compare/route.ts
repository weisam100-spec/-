import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { backtestConfigSchema, intervalSchema, strategyIdSchema, symbolSchema } from "@/lib/api/backtestSchema";
import { env } from "@/lib/env";
import { fetchKlinesRange } from "@/lib/market/klinesRange";
import { runStrategyBacktest } from "@/lib/backtest/runPipeline";
import type { StrategyId } from "@/lib/strategies/registry";
import type { Interval } from "@/lib/market/symbols";

const requestSchema = z.object({
  symbol: symbolSchema,
  interval: intervalSchema,
  config: backtestConfigSchema,
  strategies: z
    .array(
      z.object({
        strategyId: strategyIdSchema,
        strategyParams: z.record(z.string(), z.unknown()),
        label: z.string().max(60).optional(),
      }),
    )
    .min(1)
    .max(6),
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
  const { symbol, interval, config, strategies } = parsed.data;

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

  const comparisons = strategies.map((s) => {
    try {
      const output = runStrategyBacktest({
        symbol,
        interval: interval as Interval,
        candles: klinesResult.candles,
        strategyId: s.strategyId as StrategyId,
        strategyParams: s.strategyParams,
        config,
      });
      return {
        strategyId: s.strategyId,
        label: s.label ?? s.strategyId,
        ok: true as const,
        metrics: output.metrics,
        warnings: [...output.result.warnings, ...output.warnings],
      };
    } catch (err) {
      return {
        strategyId: s.strategyId,
        label: s.label ?? s.strategyId,
        ok: false as const,
        error: err instanceof Error ? err.message : "回測失敗",
      };
    }
  });

  return apiOk({
    dataSource: klinesResult.source,
    freshness: klinesResult.freshness,
    usedCandles: klinesResult.candles.length,
    comparisons,
    disclaimer: "歷史績效比較僅反映過去資料表現，不代表未來績效，請勿作為投資建議。",
  });
});
