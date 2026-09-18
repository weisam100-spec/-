import { apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { env } from "@/lib/env";

/**
 * 真實交易功能第一版尚未開放。此端點僅回報功能狀態，
 * 不會、也不應該接受任何交易所 API 金鑰或下單請求。
 */
export const GET = withRateLimit(async () => {
  return apiOk({
    enabled: env.enableLiveTrading,
    message: "真實交易功能尚未開放，目前僅支援本機模擬（紙上）交易。",
  });
});
