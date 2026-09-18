import { env } from "@/lib/env";

export interface FxRate {
  usdtTwd: number;
  source: "fixed" | "external";
  fetchedAt: number;
}

/**
 * USDT/新臺幣匯率。第一版使用固定備援匯率（可由環境變數調整），
 * 保留 external 模式的介面以便未來串接真實匯率 API。
 */
export async function getUsdtTwdRate(): Promise<FxRate> {
  return {
    usdtTwd: env.fxUsdtTwdFallback,
    source: "fixed",
    fetchedAt: Date.now(),
  };
}

export function usdtToTwd(usdt: number, rate: number): number {
  return usdt * rate;
}
