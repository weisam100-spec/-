import type { Candle } from "@/lib/market/types";
import type { KeyLevel } from "./supportResistance";

export interface LevelReactionStats {
  level: KeyLevel;
  /** 用來計算機率的歷史獨立觸及次數（連續貼著同一價位的K棒只算一次，避免灌水樣本數） */
  touchCount: number;
  upCount: number;
  downCount: number;
  /** 觸及後往後數 lookForwardBars 根，收盤價較觸及當下更高的比例；樣本數為 0 時為 null */
  upProbabilityPct: number | null;
  lookForwardBars: number;
}

/**
 * 針對每一個關鍵價位，純粹統計「歷史上」價格每次觸及該價位區間後，往後數 N 根 K 棒，
 * 收盤價是漲了還是跌了，計算出歷史上漲比例。
 *
 * 這是對既有歷史資料的事後統計，不是對未來的預測，也不保證下一次觸及會有同樣結果；
 * 樣本數（touchCount）越少，統計意義越薄弱。
 */
export function computeLevelReactionStats(
  candles: Candle[],
  levels: KeyLevel[],
  opts: {
    lookForwardBars?: number;
    tolerancePct?: number;
    cooldownBars?: number;
  } = {},
): LevelReactionStats[] {
  const lookForwardBars = opts.lookForwardBars ?? 10;
  const tolerancePct = opts.tolerancePct ?? 0.5;
  const cooldownBars = opts.cooldownBars ?? lookForwardBars;

  return levels.map((level) => {
    let upCount = 0;
    let downCount = 0;
    let lastTouchIndex = -Infinity;
    const tolerance = (level.price * tolerancePct) / 100;

    for (let i = 0; i < candles.length - lookForwardBars; i++) {
      const c = candles[i]!;
      const touched =
        c.low <= level.price + tolerance && c.high >= level.price - tolerance;
      if (!touched) continue;
      // 連續貼著同一價位的 K 棒視為同一次觸及事件，避免同一波走勢被重複計入樣本數
      if (i - lastTouchIndex < cooldownBars) continue;
      lastTouchIndex = i;

      const future = candles[i + lookForwardBars]!;
      if (future.close > c.close) upCount++;
      else if (future.close < c.close) downCount++;
      // 持平（close 完全相等）不計入漲跌任一邊，但仍視為一次有效觸及
    }

    const touchCount = upCount + downCount;
    return {
      level,
      touchCount,
      upCount,
      downCount,
      upProbabilityPct: touchCount > 0 ? (upCount / touchCount) * 100 : null,
      lookForwardBars,
    };
  });
}
