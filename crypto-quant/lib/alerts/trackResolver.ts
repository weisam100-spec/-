import { env } from "@/lib/env";
import { fetchKlinesRange } from "@/lib/market/klinesRange";
import { INTERVAL_MS, type Interval } from "@/lib/market/symbols";
import type { Candle } from "@/lib/market/types";
import type { SignalType } from "@/lib/strategies/types";
import {
  listPendingSignalTracks,
  resolveSignalTrack,
  type SignalTrackRecord,
  type SignalTrackStatus,
} from "@/lib/storage/signalTrackRepo";

export interface TrackResolveSummary {
  checked: number;
  resolved: number;
  errors: { id: string; message: string }[];
}

export interface TrackOutcome {
  status: Exclude<SignalTrackStatus, "pending">;
  resolvedAt: number;
  resolvedPrice: number;
}

/**
 * 純函式：依「訊號時間之後」的 K 棒序列，判斷目前為止是先碰到停損、1:2 停利、還是 1:3 停利。
 * 呼叫端必須只傳入 openTime 晚於訊號時間、且已收盤的 K 棒，確保無未來函數。
 * 同一根 K 棒內若同時可能觸及停損與停利，保守假設停損優先（與回測引擎一致）；
 * 同時觸及 1:2 與 1:3 停利時，記錄達成程度較高的 1:3。
 * 追蹤超過 maxBars 根 K 棒仍未有結果，回傳「逾時未解」；資料不足 maxBars 根時回傳 null（尚待下次再判斷）。
 */
export function determineTrackOutcome(
  candlesAfterSignal: Candle[],
  params: { signalType: SignalType; stopPrice: number; rr2Price: number; rr3Price: number; maxBars: number },
): TrackOutcome | null {
  const isBullish = params.signalType === "bullish_candidate";

  for (const candle of candlesAfterSignal) {
    const stopHit = isBullish ? candle.low <= params.stopPrice : candle.high >= params.stopPrice;
    if (stopHit) return { status: "hit_stop", resolvedAt: candle.openTime, resolvedPrice: params.stopPrice };

    const rr3Hit = isBullish ? candle.high >= params.rr3Price : candle.low <= params.rr3Price;
    if (rr3Hit) return { status: "hit_rr3", resolvedAt: candle.openTime, resolvedPrice: params.rr3Price };

    const rr2Hit = isBullish ? candle.high >= params.rr2Price : candle.low <= params.rr2Price;
    if (rr2Hit) return { status: "hit_rr2", resolvedAt: candle.openTime, resolvedPrice: params.rr2Price };
  }

  if (candlesAfterSignal.length >= params.maxBars) {
    const last = candlesAfterSignal[candlesAfterSignal.length - 1]!;
    return { status: "no_result", resolvedAt: last.openTime, resolvedPrice: last.close };
  }

  return null;
}

/**
 * 掃描所有仍待確認結果的即時訊號追蹤紀錄，抓取訊號時間之後的最新資料並判定結果。
 * 資料或單筆判定失敗不會中斷整批掃描，只記錄該筆錯誤繼續處理下一筆。
 */
export async function resolvePendingSignalTracks(): Promise<TrackResolveSummary> {
  const pending = listPendingSignalTracks();
  const summary: TrackResolveSummary = { checked: 0, resolved: 0, errors: [] };

  for (const record of pending) {
    summary.checked++;
    try {
      if (record.stopPrice === null || record.rr2Price === null || record.rr3Price === null) continue;
      const resolved = await resolveOne(record);
      if (resolved) summary.resolved++;
    } catch (err) {
      summary.errors.push({ id: record.id, message: err instanceof Error ? err.message : "未知錯誤" });
    }
  }

  return summary;
}

async function resolveOne(record: SignalTrackRecord): Promise<boolean> {
  const interval = record.interval as Interval;
  const stepMs = INTERVAL_MS[interval];
  const endTime = Date.now();
  const startTime = record.signalTime + stepMs;
  if (startTime > endTime) return false;

  const result = await fetchKlinesRange({
    symbol: record.symbol,
    interval,
    startTime,
    endTime,
    maxBars: env.signalTrackMaxBars,
  });
  if (result.unavailable) return false;

  const candles = result.candles.filter((c) => c.closed && c.openTime > record.signalTime);
  if (candles.length === 0) return false;

  const outcome = determineTrackOutcome(candles, {
    signalType: record.signalType,
    stopPrice: record.stopPrice!,
    rr2Price: record.rr2Price!,
    rr3Price: record.rr3Price!,
    maxBars: env.signalTrackMaxBars,
  });
  if (!outcome) return false;

  resolveSignalTrack(record.id, outcome.status, outcome.resolvedAt, outcome.resolvedPrice);
  return true;
}
