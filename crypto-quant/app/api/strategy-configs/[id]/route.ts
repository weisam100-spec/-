import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { checkRateLimit, getClientIp } from "@/lib/api/rateLimit";
import { backtestConfigSchema, intervalSchema, symbolSchema } from "@/lib/api/backtestSchema";
import { deleteStrategyConfig, updateStrategyConfig } from "@/lib/storage/strategyConfigRepo";
import { getOrCreateWorkspaceId } from "@/lib/storage/workspace";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  symbol: symbolSchema.optional(),
  interval: intervalSchema.optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  backtestConfig: backtestConfigSchema.optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`strategy-configs-patch:${ip}`).allowed) {
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
  const updated = updateStrategyConfig(workspaceId, id, parsed.data as never);
  if (!updated) return apiError("找不到指定的策略設定", 404, "not_found");
  return apiOk({ config: updated });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`strategy-configs-delete:${ip}`).allowed) {
    return apiError("請求過於頻繁，請稍後再試", 429, "rate_limited");
  }
  const { id } = await ctx.params;
  const workspaceId = await getOrCreateWorkspaceId();
  const deleted = deleteStrategyConfig(workspaceId, id);
  if (!deleted) return apiError("找不到指定的策略設定", 404, "not_found");
  return apiOk({ deleted: true });
}
