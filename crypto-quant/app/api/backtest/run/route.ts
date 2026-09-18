import { apiError, apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { backtestRequestSchema } from "@/lib/api/backtestSchema";
import { env } from "@/lib/env";
import { fetchKlinesRange } from "@/lib/market/klinesRange";
import { runStrategyBacktest } from "@/lib/backtest/runPipeline";
import { summarizeTradesForExport } from "@/lib/backtest/metrics";
import type { StrategyId } from "@/lib/strategies/registry";
import type { Interval } from "@/lib/market/symbols";

export const POST = withRateLimit(async (request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("請求內容必須是合法的 JSON", 400, "invalid_json");
  }

  const parsed = backtestRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("請求參數不合法：" + parsed.error.issues.map((i) => i.message).join("；"), 400, "invalid_params");
  }
  const { symbol, interval, strategyId, strategyParams, config } = parsed.data;

  const barCount = Math.round((config.endTime - config.startTime) / (1000 * 60));
  if (barCount <= 0) {
    return apiError("日期起點不得晚於或等於終點", 400, "invalid_range");
  }

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
    const startedAt = Date.now();
    const output = runStrategyBacktest({
      symbol,
      interval: interval as Interval,
      candles: klinesResult.candles,
      strategyId: strategyId as StrategyId,
      strategyParams,
      config,
    });
    const elapsedMs = Date.now() - startedAt;

    return apiOk({
      dataSource: klinesResult.source,
      freshness: klinesResult.freshness,
      elapsedMs,
      signalCount: output.signalCount,
      config: output.result.config,
      warnings: [...output.result.warnings, ...output.warnings],
      metrics: output.metrics,
      equityCurve: output.result.equityCurve,
      trades: output.result.trades,
      tradesExport: summarizeTradesForExport(output.result.trades),
      usedCandles: output.result.usedCandles,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "回測執行失敗";
    return apiError(message, 400, "backtest_error");
  }
});
