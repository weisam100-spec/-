import type { Candle } from "@/lib/market/types";
import { detectFvgZones, defaultFvgParams } from "@/lib/strategies/fvgDetection";

export interface DisplayFvgZone {
  type: "bullish" | "bearish";
  top: number;
  bottom: number;
  startTime: number;
  /** 延伸到最新一根 K 棒的時間，代表這個缺口到目前為止都還沒被價格回補、也還沒過期 */
  endTime: number;
}

/**
 * 回傳目前仍然有效（尚未被價格回補、也沒超過有效期）的價格失衡區（FVG），供行情頁圖表標示用。
 * 與 FVG＋供需區策略共用同一套偵測規則（@/lib/strategies/fvgDetection），
 * 純屬歷史價格結構的標示，不是訊號也不是預測。
 */
export function computeFvgZones(candles: Candle[], maxZones = 4): DisplayFvgZone[] {
  if (candles.length === 0) return [];
  const { active } = detectFvgZones(candles, defaultFvgParams);
  const lastTime = candles[candles.length - 1]!.openTime;
  return active
    // 剛好在最新一根 K 棒才形成的缺口，起訖時間會相同（尚無法畫出範圍），下一根 K 棒出現後才顯示
    .filter((z) => z.createdAtTime < lastTime)
    .slice(-maxZones)
    .map((z) => ({ type: z.type, top: z.top, bottom: z.bottom, startTime: z.createdAtTime, endTime: lastTime }));
}
