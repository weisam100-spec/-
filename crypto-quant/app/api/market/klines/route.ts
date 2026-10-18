import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { getKlinesCached } from "@/lib/market/providers";
import { fetchKlinesRange } from "@/lib/market/klinesRange";
import { cached } from "@/lib/market/cache";
import { env } from "@/lib/env";
import {
  SUPPORTED_SYMBOL_SET,
  SUPPORTED_INTERVALS,
  INTERVAL_MS,
} from "@/lib/market/symbols";

const querySchema = z.object({
  symbol: z.enum([...SUPPORTED_SYMBOL_SET] as [string, ...string[]]),
  interval: z.enum(SUPPORTED_INTERVALS as unknown as [string, ...string[]]),
  startTime: z.coerce.number().int().positive().optional(),
  endTime: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

export const GET = withRateLimit(async (request) => {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    symbol: searchParams.get("symbol"),
    interval: searchParams.get("interval"),
    startTime: searchParams.get("startTime") ?? undefined,
    endTime: searchParams.get("endTime") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return apiError(
      "查詢參數不合法：" + parsed.error.issues.map((i) => i.message).join("；"),
      400,
      "invalid_params",
    );
  }

  const { symbol, interval, startTime, endTime, limit } = parsed.data;

  // 「歷史區間」模式（行情頁選擇較長的固定時間範圍，如近 3 個月／近 1 年）：
  // 單次 Binance API 最多只能回傳 1000 根，區間較長時需要分頁抓取，改走 fetchKlinesRange。
  if (startTime !== undefined && endTime !== undefined) {
    // fetchKlinesRange 由 startTime 往前分頁抓取，超過上限時會在「較舊」的那端被截斷；
    // 為了讓截斷時保留的是「最新」資料，若區間超過上限可涵蓋的天數，先把 startTime 往後移。
    const maxSpanMs =
      env.marketChartMaxBars *
      INTERVAL_MS[interval as (typeof SUPPORTED_INTERVALS)[number]];
    const effectiveStartTime =
      endTime - startTime > maxSpanMs ? endTime - maxSpanMs : startTime;

    const key = `klines-range:${symbol}:${interval}:${effectiveStartTime}:${endTime}:${env.marketChartMaxBars}`;
    const { value: rangeResult } = await cached(
      key,
      env.cacheTtlKlinesSeconds,
      () =>
        fetchKlinesRange({
          symbol,
          interval: interval as (typeof SUPPORTED_INTERVALS)[number],
          startTime: effectiveStartTime,
          endTime,
          maxBars: env.marketChartMaxBars,
        }),
    );
    if (rangeResult.unavailable) {
      return apiOk({
        data: [],
        source: rangeResult.source,
        freshness: rangeResult.freshness,
        fetchedAt: Date.now(),
        unavailable: rangeResult.unavailable,
      });
    }
    return apiOk({
      data: rangeResult.candles,
      source: rangeResult.source,
      freshness: rangeResult.freshness,
      fetchedAt: Date.now(),
    });
  }

  const result = await getKlinesCached({
    symbol,
    interval: interval as (typeof SUPPORTED_INTERVALS)[number],
    startTime,
    endTime,
    limit,
  });
  return apiOk(result);
});
