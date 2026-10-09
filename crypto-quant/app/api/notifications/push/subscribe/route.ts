import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { addPushSubscription } from "@/lib/storage/pushSubscriptionRepo";
import { updateNotificationSettings } from "@/lib/storage/notificationSettingsRepo";
import { getOrCreateWorkspaceId } from "@/lib/storage/workspace";

const requestSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
});

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
  addPushSubscription(workspaceId, {
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
  });
  updateNotificationSettings(workspaceId, { pushEnabled: true });
  return apiOk({ subscribed: true });
});
