import type { Candle } from "@/lib/market/types";

/**
 * 固定、確定性的小型 OHLCV 測試資料（不依賴外部亂數種子以外的任何來源），
 * 供指標 / 策略 / 回測測試重複使用，確保結果可重現。
 * 走勢設計：前段緩步上升、中段回檔、後段再度上升，足以觸發均線交叉與 RSI 超買超賣。
 */
export function buildSampleCloses(): number[] {
  const closes: number[] = [];
  let price = 100;
  // 上升段：60 根
  for (let i = 0; i < 60; i++) {
    price += 0.6 + (i % 5 === 0 ? -0.3 : 0);
    closes.push(Number(price.toFixed(4)));
  }
  // 回檔段：40 根
  for (let i = 0; i < 40; i++) {
    price -= 0.9 + (i % 7 === 0 ? -0.4 : 0);
    closes.push(Number(price.toFixed(4)));
  }
  // 再上升段：50 根
  for (let i = 0; i < 50; i++) {
    price += 0.7 + (i % 6 === 0 ? -0.2 : 0);
    closes.push(Number(price.toFixed(4)));
  }
  return closes;
}

export function buildSampleCandles(startTime = 1_700_000_000_000, stepMs = 3_600_000): Candle[] {
  const closes = buildSampleCloses();
  const candles: Candle[] = [];
  let prevClose = closes[0]! - 0.5;
  for (let i = 0; i < closes.length; i++) {
    const open = prevClose;
    const close = closes[i]!;
    const high = Math.max(open, close) + 0.3;
    const low = Math.min(open, close) - 0.3;
    const volume = 1000 + ((i * 37) % 500);
    candles.push({
      openTime: startTime + i * stepMs,
      open,
      high,
      low,
      close,
      volume,
      closed: true,
    });
    prevClose = close;
  }
  return candles;
}

/** 含有缺漏（跳過一根）與重複時間戳的資料，供資料清理測試使用 */
export function buildFlawedCandles(): Candle[] {
  const base = buildSampleCandles().slice(0, 20);
  const flawed = [...base];
  // 移除一根，模擬資料缺漏
  flawed.splice(10, 1);
  // 複製一根，模擬重複 K 棒
  flawed.splice(5, 0, { ...flawed[5]! });
  return flawed;
}
