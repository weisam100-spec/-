import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { getNotificationSettings, updateNotificationSettings } from "@/lib/storage/notificationSettingsRepo";
import { getOrCreateWorkspaceId } from "@/lib/storage/workspace";
import { env } from "@/lib/env";

const updateSchema = z.object({
  telegramEnabled: z.boolean().optional(),
  telegramChatId: z.string().max(100).nullable().optional(),
  emailEnabled: z.boolean().optional(),
  emailAddress: z.string().email().max(200).nullable().optional(),
  pushEnabled: z.boolean().optional(),
});

export const GET = withRateLimit(async () => {
  const workspaceId = await getOrCreateWorkspaceId();
  const settings = getNotificationSettings(workspaceId);
  return apiOk({
    settings,
    // 讓前端知道伺服器端是否已設定好對應管道的憑證，未設定時 UI 應提示而非讓使用者誤以為只要在這裡填完就會動
    serverConfigured: {
      telegram: Boolean(env.telegramBotToken),
      email: Boolean(env.smtpHost),
      push: Boolean(env.vapidPublicKey && env.vapidPrivateKey),
    },
    alertsEnabled: env.alertsEnabled,
  });
});

export const PUT = withRateLimit(async (request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("請求內容必須是合法的 JSON", 400, "invalid_json");
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("請求參數不合法：" + parsed.error.issues.map((i) => i.message).join("；"), 400, "invalid_params");
  }
  const workspaceId = await getOrCreateWorkspaceId();
  const settings = updateNotificationSettings(workspaceId, parsed.data);
  return apiOk({ settings });
});
