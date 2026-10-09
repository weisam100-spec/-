import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { removePushSubscription } from "@/lib/storage/pushSubscriptionRepo";
import { getOrCreateWorkspaceId } from "@/lib/storage/workspace";

const requestSchema = z.object({ endpoint: z.string().url().max(2000) });

export const POST = withRateLimit(async (request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("請求內容必須是合法的 JSON", 400, "invalid_json");
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("請求參數不合法：" + parsed.error.issues.map((i) => i.message).join("；"), 400, "invalid_params");
  }

  const workspaceId = await getOrCreateWorkspaceId();
  removePushSubscription(workspaceId, parsed.data.endpoint);
  return apiOk({ unsubscribed: true });
});
