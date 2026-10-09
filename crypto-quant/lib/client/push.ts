// 瀏覽器端 Web Push 訂閱輔助函式：註冊 service worker、要求通知權限、向伺服器取得 VAPID 公鑰並建立訂閱。

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

export async function subscribeBrowserPush(): Promise<{ ok: boolean; error?: string }> {
  if (!isPushSupported()) return { ok: false, error: "此瀏覽器不支援推播通知" };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, error: "尚未允許通知權限" };

    const keyRes = await fetch("/api/notifications/push/vapid-public-key");
    const keyBody = await keyRes.json();
    const publicKey: string | null = keyBody?.data?.publicKey ?? null;
    if (!publicKey) return { ok: false, error: "伺服器尚未設定 VAPID_PUBLIC_KEY，請先完成伺服器端設定" };

    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    const json = subscription.toJSON();
    const res = await fetch("/api/notifications/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
    const body = await res.json();
    if (!body.ok) return { ok: false, error: body.error?.message ?? "訂閱失敗" };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "訂閱失敗" };
  }
}

export async function unsubscribeBrowserPush(): Promise<{ ok: boolean; error?: string }> {
  if (!isPushSupported()) return { ok: false, error: "此瀏覽器不支援推播通知" };
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await fetch("/api/notifications/push/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "取消訂閱失敗" };
  }
}
