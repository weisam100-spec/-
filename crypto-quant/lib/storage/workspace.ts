import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const WORKSPACE_COOKIE = "cq_workspace_id";

/**
 * 第一版尚未實作帳號系統，使用匿名工作區（以 cookie 儲存的隨機 ID）區分不同使用者的
 * 策略設定、觀察清單與模擬投資組合。未來若要加入登入功能，只需將此函式改為回傳
 * 已登入使用者的 user id，其餘程式碼（repository 層）完全不需修改。
 */
export async function getOrCreateWorkspaceId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(WORKSPACE_COOKIE)?.value;
  if (existing) return existing;

  const id = randomUUID();
  store.set(WORKSPACE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}
