import { apiError, apiOk } from "@/lib/api/response";
import { checkRateLimit, getClientIp } from "@/lib/api/rateLimit";
import { duplicateStrategyConfig } from "@/lib/storage/strategyConfigRepo";
import { getOrCreateWorkspaceId } from "@/lib/storage/workspace";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`strategy-configs-duplicate:${ip}`).allowed) {
    return apiError("請求過於頻繁，請稍後再試", 429, "rate_limited");
  }
  const { id } = await ctx.params;
  const workspaceId = await getOrCreateWorkspaceId();
  const duplicated = duplicateStrategyConfig(workspaceId, id);
  if (!duplicated) return apiError("找不到指定的策略設定", 404, "not_found");
  return apiOk({ config: duplicated }, 201);
}
