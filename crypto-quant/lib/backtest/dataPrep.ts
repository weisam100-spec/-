import type { Interval } from "@/lib/market/symbols";
import { INTERVAL_MS } from "@/lib/market/symbols";
import type { Candle } from "@/lib/market/types";
import type { BacktestWarning } from "./types";

/**
 * 回測前的資料清理：排序、去除重複 K 棒、剔除異常價格、
 * 偵測資料缺漏並回報警告、僅保留已收盤的 K 棒（避免用到未完成的最後一根）。
 */
export function prepareCandles(
  raw: Candle[],
  interval: Interval,
): { candles: Candle[]; warnings: BacktestWarning[] } {
  const warnings: BacktestWarning[] = [];
  const sorted = [...raw].sort((a, b) => a.openTime - b.openTime);

  const deduped: Candle[] = [];
  let duplicateCount = 0;
  for (const c of sorted) {
    const last = deduped[deduped.length - 1];
    if (last && last.openTime === c.openTime) {
      duplicateCount++;
      deduped[deduped.length - 1] = c; // 保留較新一次抓取的資料
      continue;
    }
    deduped.push(c);
  }
  if (duplicateCount > 0) {
    warnings.push({ code: "duplicate_candles", message: `偵測到 ${duplicateCount} 根重複時間戳的 K 棒，已自動去除重複` });
  }

  const valid: Candle[] = [];
  let invalidCount = 0;
  for (const c of deduped) {
    const ok =
      c.open > 0 &&
      c.high > 0 &&
      c.low > 0 &&
      c.close > 0 &&
      c.volume >= 0 &&
      c.high >= c.low &&
      c.high >= c.open &&
      c.high >= c.close &&
      c.low <= c.open &&
      c.low <= c.close;
    if (!ok) {
      invalidCount++;
      continue;
    }
    valid.push(c);
  }
  if (invalidCount > 0) {
    warnings.push({ code: "invalid_price", message: `偵測到 ${invalidCount} 根異常價格的 K 棒，已自動剔除` });
  }

  const stepMs = INTERVAL_MS[interval];
  let gapCount = 0;
  for (let i = 1; i < valid.length; i++) {
    const diff = valid[i]!.openTime - valid[i - 1]!.openTime;
    if (diff > stepMs * 1.5) gapCount++;
  }
  if (gapCount > 0) {
    warnings.push({ code: "data_gap", message: `偵測到 ${gapCount} 處資料缺漏（K 棒不連續），計算時將以現有資料為準` });
  }

  const closedOnly = valid.filter((c) => c.closed);
  if (closedOnly.length < valid.length) {
    warnings.push({ code: "unclosed_dropped", message: "已剔除尚未收盤的最新一根 K 棒，避免使用不完整資料" });
  }

  return { candles: closedOnly, warnings };
}
