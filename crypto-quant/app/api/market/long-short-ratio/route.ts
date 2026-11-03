import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { getTopTraderLongShortRatioCached } from "@/lib/market/providers";
import { SUPPORTED_SYMBOL_SET, SUPPORTED_INTERVALS } from "@/lib/market/symbols";

const querySchema = z.object({
  symbol: z.enum([...SUPPORTED_SYMBOL_SET] as [string, ...string[]]),
  period: z.enum(SUPPORTED_INTERVALS as unknown as [string, ...string[]]),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

// 大戶多空持倉比：資料來自幣安「合約（期貨）」市場公開統計 API，與驅動本站其餘
// 回測／策略的「現貨」市場不同，純粹讀取顯示統計數字作為情緒參考，
// 不代表、也不會讓本站具備合約下單或開槓桿的能力。
export const GET = withRateLimit(async (request) => {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    symbol: searchParams.get("symbol"),
    period: searchParams.get("period"),
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return apiError(
      "查詢參數不合法：" + parsed.error.issues.map((i) => i.message).join("；"),
      400,
      "invalid_params",
    );
  }

  const { symbol, period, limit } = parsed.data;
  const result = await getTopTraderLongShortRatioCached({
    symbol,
    period: period as (typeof SUPPORTED_INTERVALS)[number],
    limit,
  });
  return apiOk(result);
});
