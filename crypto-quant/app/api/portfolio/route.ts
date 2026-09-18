import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { getPortfolio, resetPortfolio } from "@/lib/storage/portfolioRepo";
import { getOrCreateWorkspaceId } from "@/lib/storage/workspace";

const resetSchema = z.object({
  initialCashUsdt: z.number().positive().max(1_000_000_000).optional(),
});

export const GET = withRateLimit(async () => {
  const workspaceId = await getOrCreateWorkspaceId();
  return apiOk({ portfolio: getPortfolio(workspaceId) });
});

/** 重置模擬投資組合（清空持倉並重設現金餘額），僅影響本機紙上交易資料 */
export const POST = withRateLimit(async (request) => {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("請求參數不合法", 400, "invalid_params");
  }
  const workspaceId = await getOrCreateWorkspaceId();
  const portfolio = resetPortfolio(workspaceId, parsed.data.initialCashUsdt);
  return apiOk({ portfolio });
});
