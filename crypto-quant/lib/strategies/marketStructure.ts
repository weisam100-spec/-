import type { Candle } from "@/lib/market/types";

/**
 * 市場結構擺動點（Swing Point）偵測，SMC 與 SMT 策略共用。
 * 擺動點必須等左右各 lookback 根 K 棒都出現才算確認（confirmedAt = pivotIndex + lookback），
 * 因此天生不會用到未來資料。
 */
export interface SwingEvent {
  confirmedAt: number;
  pivotIndex: number;
  type: "high" | "low";
  price: number;
  /** 擺動點本身的時間戳，方便跨資產以時間比對 */
  time: number;
}

export function computeSwingEvents(candles: Candle[], lookback: number): SwingEvent[] {
  const events: SwingEvent[] = [];
  const n = candles.length;
  for (let k = lookback; k < n - lookback; k++) {
    let isHigh = true;
    let isLow = true;
    const pivotHigh = candles[k]!.high;
    const pivotLow = candles[k]!.low;
    for (let j = k - lookback; j <= k + lookback; j++) {
      if (j === k) continue;
      if (candles[j]!.high > pivotHigh) isHigh = false;
      if (candles[j]!.low < pivotLow) isLow = false;
    }
    if (isHigh) {
      events.push({ confirmedAt: k + lookback, pivotIndex: k, type: "high", price: pivotHigh, time: candles[k]!.openTime });
    }
    if (isLow) {
      events.push({ confirmedAt: k + lookback, pivotIndex: k, type: "low", price: pivotLow, time: candles[k]!.openTime });
    }
  }
  return events;
}

export function groupEventsByConfirmedBar(events: SwingEvent[]): Map<number, SwingEvent[]> {
  const map = new Map<number, SwingEvent[]>();
  for (const e of events) {
    const list = map.get(e.confirmedAt);
    if (list) list.push(e);
    else map.set(e.confirmedAt, [e]);
  }
  return map;
}
