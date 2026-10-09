import webpush from "web-push";
import { env } from "@/lib/env";
import { listPushSubscriptions, removePushSubscriptionByEndpoint } from "@/lib/storage/pushSubscriptionRepo";
import type { SendResult } from "./telegram";

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  if (env.vapidPublicKey && env.vapidPrivateKey) {
    webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
    vapidConfigured = true;
  }
}

/**
 * 透過 Web Push 發送瀏覽器推播通知給該工作區所有已訂閱的瀏覽器。
 * 需要先在 .env.local 設定 VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
 * （可執行 `npx web-push generate-vapid-keys` 產生專屬金鑰對，不可共用他人金鑰）。
 * 推播目標（已過期或已取消訂閱）失敗時會自動清除該筆訂閱紀錄。
 */
export async function sendPushToWorkspace(
  workspaceId: string,
  payload: { title: string; body: string; url?: string },
): Promise<SendResult> {
  if (!env.vapidPublicKey || !env.vapidPrivateKey) {
    return { ok: false, error: "尚未設定 VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY，請於 .env.local 設定後重新啟動伺服器" };
  }
  ensureVapid();

  const subscriptions = listPushSubscriptions(workspaceId);
  if (subscriptions.length === 0) {
    return { ok: false, error: "尚未在瀏覽器啟用推播訂閱" };
  }

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      ),
    ),
  );

  let successCount = 0;
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      successCount++;
    } else {
      const statusCode = (result.reason as { statusCode?: number } | undefined)?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        removePushSubscriptionByEndpoint(subscriptions[i]!.endpoint);
      }
    }
  });

  if (successCount === 0) {
    return { ok: false, error: "所有推播訂閱皆發送失敗（可能已過期，請重新於瀏覽器啟用推播）" };
  }
  return { ok: true };
}
