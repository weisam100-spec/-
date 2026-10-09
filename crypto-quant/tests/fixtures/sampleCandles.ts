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

/**
 * 專為 SMC（Smart Money Concepts）策略設計的小型情境資料：
 * 先形成「較低高點、較低低點」的空頭結構，接著出現一根強力突破 K 棒收盤越過前波高點
 * （形成 CHoCH），其前一根下跌 K 棒即為訂單塊；隨後價格回測該訂單塊區間，
 * 應觸發一個偏多候選訊號。使用 swingLookback=2 等較敏感的參數以便在小筆資料內成立。
 * 回傳的 candles 中，索引 25 為突破 K 棒，索引 28 為回測進場訊號觸發的 K 棒。
 */
export function buildSmcScenarioCandles(startTime = 1_700_000_000_000, stepMs = 3_600_000): Candle[] {
  const seq: number[] = [
    102, 103, 104, 103, 102, // 上升至波段高點 P1=104.1（idx2）
    101, 100, 99, 98, 97, // 下跌至波段低點 T1=96.9（idx9）
    98, 99, 100, 99, 98, // 反彈至波段高點 P2=100.1（idx12，低於 P1，較低高點）
    97, 96, 95, 94, 93, // 下跌至波段低點 T2=92.9（idx19，低於 T1，較低低點，確認空頭結構）
    94, 95, 94, 93, 92, // 小反彈後再度下跌，最後一根下跌 K 棒（idx24）即為訂單塊
    100, // 強力突破 K 棒，收盤大幅突破前波高點（idx25，形成 CHoCH）
    98, 97, 96, 94, 92.5, // 回測訂單塊區間（約 91.9~93.1），於 idx28 觸發進場訊號
    93, 94, 95, // 訊號觸發後的後續 K 棒，供無未來函數測試使用
  ];
  const candles: Candle[] = [];
  let prevClose = seq[0]! + 1;
  let t = startTime;
  for (const close of seq) {
    const open = prevClose;
    const high = Math.max(open, close) + 0.1;
    const low = Math.min(open, close) - 0.1;
    candles.push({ openTime: t, open, high, low, close, volume: 1000, closed: true });
    prevClose = close;
    t += stepMs;
  }
  return candles;
}

function buildCandlesFromCloses(closes: number[], startTime: number, stepMs: number): Candle[] {
  const candles: Candle[] = [];
  let prevClose = closes[0]! + 1;
  let t = startTime;
  for (const close of closes) {
    const open = prevClose;
    const high = Math.max(open, close) + 0.1;
    const low = Math.min(open, close) - 0.1;
    candles.push({ openTime: t, open, high, low, close, volume: 1000, closed: true });
    prevClose = close;
    t += stepMs;
  }
  return candles;
}

/**
 * 專為 SMT（跨資產背離）策略設計的一對情境資料：兩條序列時間戳完全對齊（同一 startTime/stepMs）。
 * 主要資產（模擬 BTC）兩次波段高點皆持續創高（符合多頭動能延續）；
 * 比較資產（模擬 ETH）第一次波段高點同步創高，但第二次高點卻低於第一次（未同步創高），
 * 構成 SMT 頂背離，應在主要資產序列的第二個高點處（idx12）觸發一個偏空候選訊號。
 * 使用 swingLookback=2 以便在小筆資料內即可成立。
 */
export function buildSmtScenarioCandles(
  startTime = 1_700_000_000_000,
  stepMs = 3_600_000,
): { primary: Candle[]; correlated: Candle[] } {
  const primaryCloses = [
    100, 101, 102, 101, 100, // 波段高點 1 = 102（idx2）
    99, 98, 97, 98, 99, // 波段低點（idx7）
    100, 101, 103, 102, 101, // 波段高點 2 = 103（idx12，高於高點 1，延續創高）
    100, 99, 98, // 收尾
  ];
  const correlatedCloses = [
    50, 51, 52, 51, 50, // 波段高點 1 = 52（idx2，與主要資產同步創高）
    49, 48, 47, 48, 49, // 波段低點（idx7）
    50, 50.8, 51.5, 51, 50.3, // 波段高點 2 = 51.5（idx12，低於高點 1，未同步創高 -> 背離）
    50, 49.5, 49, // 收尾
  ];
  return {
    primary: buildCandlesFromCloses(primaryCloses, startTime, stepMs),
    correlated: buildCandlesFromCloses(correlatedCloses, startTime, stepMs),
  };
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
