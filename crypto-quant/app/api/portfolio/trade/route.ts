import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { symbolSchema } from "@/lib/api/backtestSchema";
import { paperBuy, paperSell } from "@/lib/storage/portfolioRepo";
import { getOrCreateWorkspaceId } from "@/lib/storage/workspace";

const tradeSchema = z.object({
  symbol: symbolSchema,
  side: z.enum(["buy", "sell"]),
  quantity: z.number().positive().max(1_000_000),
  priceUsdt: z.number().positive().max(100_000_000),
});

/**
 * 模擬（紙上）交易下單。僅操作本機資料庫中的模擬持倉與現金，
 * 不會連接任何真實交易所，也不會下真實訂單。
 */
export const POST = withRateLimit(async (request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("請求內容必須是合法的 JSON", 400, "invalid_json");
  }
  const parsed = tradeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("請求參數不合法：" + parsed.error.issues.map((i) => i.message).join("；"), 400, "invalid_params");
  }
  const workspaceId = await getOrCreateWorkspaceId();
  const { symbol, side, quantity, priceUsdt } = parsed.data;
  const result =
    side === "buy"
      ? paperBuy(workspaceId, symbol, quantity, priceUsdt)
      : paperSell(workspaceId, symbol, quantity, priceUsdt);

  if (!result.ok) {
    return apiError(result.error ?? "模擬交易失敗", 400, "trade_failed");
  }
  return apiOk({ portfolio: result.portfolio });
});
