import { env } from "@/lib/env";

export interface SendResult {
  ok: boolean;
  error?: string;
}

/**
 * 透過 Telegram Bot API 發送訊息。需要先在 .env.local 設定 TELEGRAM_BOT_TOKEN
 * （向 @BotFather 申請），並由使用者提供自己的 chat id。
 */
export async function sendTelegramMessage(chatId: string, text: string): Promise<SendResult> {
  if (!env.telegramBotToken) {
    return { ok: false, error: "尚未設定 TELEGRAM_BOT_TOKEN，請於 .env.local 設定後重新啟動伺服器" };
  }
  if (!chatId) {
    return { ok: false, error: "尚未設定 Telegram Chat ID" };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Telegram API 回應錯誤（HTTP ${res.status}）：${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Telegram 發送失敗" };
  }
}
