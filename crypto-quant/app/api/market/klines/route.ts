import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { getKlinesCached } from "@/lib/market/providers";
import { SUPPORTED_SYMBOL_SET, SUPPORTED_INTERVALS } from "@/lib/market/symbols";

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
    return apiError("查詢參數不合法：" + parsed.error.issues.map((i) => i.message).join("；"), 400, "invalid_params");
  }

  const result = await getKlinesCached({
    symbol: parsed.data.symbol,
    interval: parsed.data.interval as (typeof SUPPORTED_INTERVALS)[number],
    startTime: parsed.data.startTime,
    endTime: parsed.data.endTime,
    limit: parsed.data.limit,
  });
  return apiOk(result);
});
