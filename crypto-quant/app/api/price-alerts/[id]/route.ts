import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { checkRateLimit, getClientIp } from "@/lib/api/rateLimit";
import { deletePriceAlertRule, setPriceAlertRuleEnabled } from "@/lib/storage/priceAlertRepo";
import { getOrCreateWorkspaceId } from "@/lib/storage/workspace";

const patchSchema = z.object({
  enabled: z.boolean(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`price-alerts-patch:${ip}`).allowed) {
    return apiError("請求過於頻繁，請稍後再試", 429, "rate_limited");
  }
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("請求內容必須是合法的 JSON", 400, "invalid_json");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("請求參數不合法：" + parsed.error.issues.map((i) => i.message).join("；"), 400, "invalid_params");
  }
  const workspaceId = await getOrCreateWorkspaceId();
  const updated = setPriceAlertRuleEnabled(workspaceId, id, parsed.data.enabled);
  if (!updated) return apiError("找不到指定的提醒規則", 404, "not_found");
  return apiOk({ updated: true });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`price-alerts-delete:${ip}`).allowed) {
    return apiError("請求過於頻繁，請稍後再試", 429, "rate_limited");
  }
  const { id } = await ctx.params;
  const workspaceId = await getOrCreateWorkspaceId();
  const deleted = deletePriceAlertRule(workspaceId, id);
  if (!deleted) return apiError("找不到指定的提醒規則", 404, "not_found");
  return apiOk({ deleted: true });
}
