import type { Candle } from "@/lib/market/types";

/**
 * 以 UTC 日曆日為區段重置的 VWAP（成交量加權平均價）。
 * 每根 K 棒只累加「當日迄今」的典型價格（高低收平均）與成交量，
 * 换日時重新歸零，因此天生只使用當下已存在的資料，不會用到未來資料。
 * 日線週期下每根 K 棒自成一個區段，VWAP 會等於當根典型價格，屬預期內的正常行為。
 */
export function sessionVwap(candles: Candle[]): number[] {
  const out = new Array<number>(candles.length).fill(NaN);
  let cumPV = 0;
  let cumVolume = 0;
  let currentDay = "";

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]!;
    const day = new Date(c.openTime).toISOString().slice(0, 10);
    if (day !== currentDay) {
      currentDay = day;
      cumPV = 0;
      cumVolume = 0;
    }
    const typicalPrice = (c.high + c.low + c.close) / 3;
    cumPV += typicalPrice * c.volume;
    cumVolume += c.volume;
    out[i] = cumVolume > 0 ? cumPV / cumVolume : typicalPrice;
  }
  return out;
}
