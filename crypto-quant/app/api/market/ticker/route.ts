import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { getTicker24hCached } from "@/lib/market/providers";
import { SUPPORTED_SYMBOL_SET } from "@/lib/market/symbols";

const querySchema = z.object({
  symbol: z.enum([...SUPPORTED_SYMBOL_SET] as [string, ...string[]]),
});

export const GET = withRateLimit(async (request) => {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ symbol: searchParams.get("symbol") });
  if (!parsed.success) {
    return apiError("symbol 參數不合法或未在白名單內", 400, "invalid_params");
  }

  const result = await getTicker24hCached(parsed.data.symbol);
  return apiOk(result);
});
