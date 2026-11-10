import type { Candle } from "@/lib/market/types";

/**
 * 價格失衡區（Fair Value Gap, FVG）偵測邏輯。
 *
 * 定義（SMC／ICT 交易法公開、明確的定義，非任何特定人士的私有規則）：
 * 連續三根 K 棒中，第 1 根的高點與第 3 根的低點之間出現沒有重疊的缺口（多頭 FVG），
 * 或第 1 根的低點與第 3 根的高點之間出現沒有重疊的缺口（空頭 FVG）。
 * 這個缺口區間代表價格快速移動、來不及在該價位雙向成交，市場效率較低的區域，
 * 常被視為日後價格可能回補（回測）的區域。
 *
 * 無未來函數：第 i 根 K 棒的缺口僅由 candles[i-2]、candles[i] 判斷即可確認，
 * 「回補」事件同樣只用當下與先前的資料判斷，不會用到尚未發生的 K 棒。
 */

export interface FvgParams {
  /** 缺口大小需達到缺口中點價格的這個百分比以上，才視為有效缺口（濾除雜訊） */
  minGapPct: number;
  /** 缺口超過這麼多根 K 棒仍未被價格回補，視為失效 */
  maxAgeBars: number;
}

export const defaultFvgParams: FvgParams = {
  minGapPct: 0.1,
  maxAgeBars: 40,
};

export interface FvgTouch {
  /** 回補發生的 K 棒索引 */
  index: number;
  time: number;
  price: number;
  type: "bullish" | "bearish";
  top: number;
  bottom: number;
  createdAtIndex: number;
  createdAtTime: number;
}

export interface ActiveFvgZone {
  type: "bullish" | "bearish";
  top: number;
  bottom: number;
  createdAtIndex: number;
  createdAtTime: number;
}

export interface FvgDetectionResult {
  /** 掃描全部資料過程中，每一次「價格回補缺口」的事件 */
  touches: FvgTouch[];
  /** 掃描到最後一根 K 棒為止，仍未被回補、也還沒超過有效期的缺口（供圖表顯示用） */
  active: ActiveFvgZone[];
}

interface PendingFvg {
  type: "bullish" | "bearish";
  top: number;
  bottom: number;
  createdAt: number;
}

export function detectFvgZones(candles: Candle[], params: FvgParams): FvgDetectionResult {
  const n = candles.length;
  const touches: FvgTouch[] = [];
  const pending: PendingFvg[] = [];
  if (n < 3) return { touches, active: [] };

  for (let i = 2; i < n; i++) {
    const left = candles[i - 2]!;
    const right = candles[i]!;

    if (left.high < right.low) {
      const mid = (right.low + left.high) / 2;
      const gapPct = mid > 0 ? ((right.low - left.high) / mid) * 100 : 0;
      if (gapPct >= params.minGapPct) {
        pending.push({ type: "bullish", top: right.low, bottom: left.high, createdAt: i });
      }
    } else if (left.low > right.high) {
      const mid = (left.low + right.high) / 2;
      const gapPct = mid > 0 ? ((left.low - right.high) / mid) * 100 : 0;
      if (gapPct >= params.minGapPct) {
        pending.push({ type: "bearish", top: left.low, bottom: right.high, createdAt: i });
      }
    }

    const candle = candles[i]!;
    for (let p = pending.length - 1; p >= 0; p--) {
      const zone = pending[p]!;
      if (i === zone.createdAt) continue;
      if (i - zone.createdAt > params.maxAgeBars) {
        pending.splice(p, 1);
        continue;
      }
      const touched = candle.low <= zone.top && candle.high >= zone.bottom;
      if (!touched) continue;

      touches.push({
        index: i,
        time: candle.openTime,
        price: candle.close,
        type: zone.type,
        top: zone.top,
        bottom: zone.bottom,
        createdAtIndex: zone.createdAt,
        createdAtTime: candles[zone.createdAt]!.openTime,
      });
      pending.splice(p, 1);
    }
  }

  const active: ActiveFvgZone[] = pending.map((z) => ({
    type: z.type,
    top: z.top,
    bottom: z.bottom,
    createdAtIndex: z.createdAt,
    createdAtTime: candles[z.createdAt]!.openTime,
  }));

  return { touches, active };
}
