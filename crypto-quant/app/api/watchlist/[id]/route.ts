import { apiError, apiOk } from "@/lib/api/response";
import { checkRateLimit, getClientIp } from "@/lib/api/rateLimit";
import { removeWatchlistItem } from "@/lib/storage/watchlistRepo";
import { getOrCreateWorkspaceId } from "@/lib/storage/workspace";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, ctx: Ctx) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`watchlist-delete:${ip}`).allowed) {
    return apiError("請求過於頻繁，請稍後再試", 429, "rate_limited");
  }
  const { id } = await ctx.params;
  const workspaceId = await getOrCreateWorkspaceId();
  const removed = removeWatchlistItem(workspaceId, id);
  if (!removed) return apiError("找不到指定的觀察清單項目", 404, "not_found");
  return apiOk({ deleted: true });
}
