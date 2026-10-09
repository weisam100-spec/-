import { getNotificationSettings } from "@/lib/storage/notificationSettingsRepo";
import { sendTelegramMessage } from "./telegram";
import { sendEmail } from "./email";
import { sendPushToWorkspace } from "./push";

export interface DispatchResult {
  channel: "telegram" | "email" | "push";
  ok: boolean;
  error?: string;
}

/** 依該工作區已啟用的通知管道發送同一則訊息，個別管道失敗不影響其他管道 */
export async function dispatchToWorkspace(
  workspaceId: string,
  message: { title: string; text: string; url?: string },
): Promise<DispatchResult[]> {
  const settings = getNotificationSettings(workspaceId);
  const results: DispatchResult[] = [];

  if (settings.telegramEnabled && settings.telegramChatId) {
    const r = await sendTelegramMessage(settings.telegramChatId, `<b>${escapeHtml(message.title)}</b>\n${escapeHtml(message.text)}`);
    results.push({ channel: "telegram", ok: r.ok, error: r.error });
  }
  if (settings.emailEnabled && settings.emailAddress) {
    const r = await sendEmail(settings.emailAddress, message.title, message.text);
    results.push({ channel: "email", ok: r.ok, error: r.error });
  }
  if (settings.pushEnabled) {
    const r = await sendPushToWorkspace(workspaceId, { title: message.title, body: message.text, url: message.url });
    results.push({ channel: "push", ok: r.ok, error: r.error });
  }

  return results;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
