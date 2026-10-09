import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { getNotificationSettings } from "@/lib/storage/notificationSettingsRepo";
import { getOrCreateWorkspaceId } from "@/lib/storage/workspace";
import { sendTelegramMessage } from "@/lib/notifications/telegram";
import { sendEmail } from "@/lib/notifications/email";
import { sendPushToWorkspace } from "@/lib/notifications/push";

const requestSchema = z.object({ channel: z.enum(["telegram", "email", "push"]) });

export const POST = withRateLimit(async (request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("請求內容必須是合法的 JSON", 400, "invalid_json");
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("請求參數不合法", 400, "invalid_params");
  }

  const workspaceId = await getOrCreateWorkspaceId();
  const settings = getNotificationSettings(workspaceId);

  if (parsed.data.channel === "telegram") {
    if (!settings.telegramChatId) return apiError("請先填寫 Telegram Chat ID", 400, "missing_config");
    const result = await sendTelegramMessage(settings.telegramChatId, "✅ 這是一則來自加密貨幣量化策略分析網站的測試通知。");
    return result.ok ? apiOk({ sent: true }) : apiError(result.error ?? "發送失敗", 502, "send_failed");
  }
  if (parsed.data.channel === "email") {
    if (!settings.emailAddress) return apiError("請先填寫通知 Email", 400, "missing_config");
    const result = await sendEmail(settings.emailAddress, "測試通知", "這是一則來自加密貨幣量化策略分析網站的測試通知。");
    return result.ok ? apiOk({ sent: true }) : apiError(result.error ?? "發送失敗", 502, "send_failed");
  }
  const result = await sendPushToWorkspace(workspaceId, { title: "測試通知", body: "這是一則來自加密貨幣量化策略分析網站的測試通知。" });
  return result.ok ? apiOk({ sent: true }) : apiError(result.error ?? "發送失敗", 502, "send_failed");
});
