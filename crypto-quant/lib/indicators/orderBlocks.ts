import type { Candle } from "@/lib/market/types";
import { detectOrderBlocks } from "@/lib/strategies/orderBlockDetection";
import { smcDefaultParams } from "@/lib/strategies/smc";

export interface DisplayOrderBlock {
  type: "bullish" | "bearish";
  low: number;
  high: number;
  startTime: number;
  /** 延伸到最新一根 K 棒的時間，代表這個訂單塊到目前為止都還沒被價格回測、也還沒過期 */
  endTime: number;
  isChoch: boolean;
}

/**
 * 回傳目前仍然有效（尚未被價格回測、也沒超過有效期）的訂單塊，供行情頁圖表標示用。
 * 與 SMC 策略共用同一套偵測規則（@/lib/strategies/orderBlockDetection），
 * 純屬歷史價格結構的標示，不是訊號也不是預測。
 */
export function computeOrderBlocks(
  candles: Candle[],
  maxBlocks = 4,
): DisplayOrderBlock[] {
  if (candles.length === 0) return [];
  const { active } = detectOrderBlocks(candles, smcDefaultParams);
  const lastTime = candles[candles.length - 1]!.openTime;
  return (
    active
      // 剛好在最新一根 K 棒才建立的訂單塊，起訖時間會相同（尚無法畫出範圍），下一根 K 棒出現後才顯示
      .filter((ob) => ob.createdAtTime < lastTime)
      .slice(-maxBlocks)
      .map((ob) => ({
        type: ob.type,
        low: ob.low,
        high: ob.high,
        startTime: ob.createdAtTime,
        endTime: lastTime,
        isChoch: ob.isChoch,
      }))
  );
}
