import { SUPPORTED_SYMBOLS } from "@/lib/market/symbols";
import { computeSwingEvents, type SwingEvent } from "./marketStructure";
import type { Strategy, StrategySignal } from "./types";

/**
 * SMT 背離（Smart Money Technique / SMT Divergence）策略。
 *
 * 核心邏輯：同時觀察「主要交易對」與使用者指定的「比較交易對」（例如 BTC/USDT vs ETH/USDT），
 * 比較兩者的擺動高低點（Swing Point，定義與 SMC 策略相同）：
 * - 兩邊幾乎同時出現新的擺動高點時，若主要交易對創了更高的高點，但比較交易對卻沒有同步創高
 *   （反而是較低的高點），代表走勢背離、上漲動能可能不足，形成偏空候選訊號。
 * - 對稱地，若主要交易對創更低的低點，但比較交易對沒有同步創低，形成偏多候選訊號。
 *
 * 為避免未來函數，比對時只會使用「截至當下已確認」的比較交易對擺動點（確認時間 <= 當下時間），
 * 並限制比對時間差必須在 maxMatchBars 根 K 棒之內，避免拿明顯不同步的擺動點硬湊背離。
 */

export interface SmtParams extends Record<string, unknown> {
  /** 用來比較是否背離的交易對，必須與使用者選擇的主要交易對不同 */
  correlatedSymbol: string;
  /** 擺動點左右各需要幾根 K 棒才能確認 */
  swingLookback: number;
  /** 兩個交易對的擺動點時間差在幾根 K 棒之內才視為「同步」可比較 */
  maxMatchBars: number;
}

export const smtDefaultParams: SmtParams = {
  correlatedSymbol: SUPPORTED_SYMBOLS.find((s) => s.symbol === "ETHUSDT")?.symbol ?? SUPPORTED_SYMBOLS[1]!.symbol,
  swingLookback: 5,
  maxMatchBars: 3,
};

interface TrackedSwing {
  prev: SwingEvent | null;
  last: SwingEvent | null;
}

/** 在「截至 confirmedAt 為止」已確認的擺動點中，尋找時間最接近 targetTime 的同類型擺動點 */
function findNearestPastSwing(
  events: SwingEvent[],
  type: "high" | "low",
  asOfConfirmedAt: number,
  targetTime: number,
  toleranceMs: number,
): SwingEvent | null {
  let best: SwingEvent | null = null;
  let bestDiff = Infinity;
  for (const e of events) {
    if (e.type !== type) continue;
    if (e.confirmedAt > asOfConfirmedAt) continue; // 不可使用尚未確認（未來）的擺動點
    const diff = Math.abs(e.time - targetTime);
    if (diff > toleranceMs) continue;
    if (diff < bestDiff) {
      bestDiff = diff;
      best = e;
    }
  }
  return best;
}

export const smtStrategy: Strategy<SmtParams> = {
  id: "smt",
  name: "SMT 背離策略（跨資產）",
  description:
    "比較主要交易對與另一個指定交易對（例如 BTC/USDT vs ETH/USDT）的擺動高低點是否同步：若主要資產創新高／新低，但比較資產沒有同步創高／創低，視為走勢背離，形成偏空／偏多候選訊號。",
  defaultParams: smtDefaultParams,
  requiresCorrelatedAsset: true,

  validateParams(params) {
    const errors: string[] = [];
    const validSymbol = SUPPORTED_SYMBOLS.some((s) => s.symbol === params.correlatedSymbol);
    if (!params.correlatedSymbol || !validSymbol) {
      errors.push("比較交易對必須是支援清單中的交易對");
    }
    if (!Number.isFinite(params.swingLookback) || params.swingLookback < 2 || params.swingLookback > 50) {
      errors.push("擺動點確認根數必須介於 2 至 50 之間");
    }
    if (!Number.isFinite(params.maxMatchBars) || params.maxMatchBars < 0 || params.maxMatchBars > 50) {
      errors.push("擺動點同步容許根數必須介於 0 至 50 之間");
    }
    return { valid: errors.length === 0, errors };
  },

  generateSignals(candles, params, ctx): StrategySignal[] {
    if (!ctx.correlatedCandles || ctx.correlatedCandles.length === 0) {
      // 缺少比較交易對資料時不可偽造訊號，直接回傳空陣列（呼叫端應在取得資料階段就明確告知使用者原因）
      return [];
    }
    if (ctx.symbol === params.correlatedSymbol) {
      return [];
    }

    const n = candles.length;
    if (n < params.swingLookback * 2 + 2) return [];

    const stepMs = n >= 2 ? candles[1]!.openTime - candles[0]!.openTime : 0;
    const toleranceMs = stepMs * params.maxMatchBars;

    const primaryEvents = computeSwingEvents(candles, params.swingLookback);
    const correlatedEvents = computeSwingEvents(ctx.correlatedCandles, params.swingLookback);

    const primaryEventsByBar = new Map<number, SwingEvent[]>();
    for (const e of primaryEvents) {
      const list = primaryEventsByBar.get(e.confirmedAt);
      if (list) list.push(e);
      else primaryEventsByBar.set(e.confirmedAt, [e]);
    }

    // 比較交易對的擺動點以「確認時間」為準，用來推算「截至主要交易對第 i 根 K 棒時，
    // 比較交易對已確認到的擺動點」——以比較交易對自身的 confirmedAt 對應到同一時間軸上最近的 index。
    const correlatedConfirmedAtByTime = (asOfTime: number) => {
      // 找出比較交易對中，openTime <= asOfTime 的最後一根 K 棒的 index + swingLookback，
      // 近似「截至 asOfTime 當下，比較交易對的擺動點確認進度」。
      let idx = -1;
      for (let j = 0; j < ctx.correlatedCandles!.length; j++) {
        if (ctx.correlatedCandles![j]!.openTime <= asOfTime) idx = j;
        else break;
      }
      return idx;
    };

    const primaryTrack: Record<"high" | "low", TrackedSwing> = {
      high: { prev: null, last: null },
      low: { prev: null, last: null },
    };
    const correlatedTrack: Record<"high" | "low", TrackedSwing> = {
      high: { prev: null, last: null },
      low: { prev: null, last: null },
    };

    const signals: StrategySignal[] = [];

    for (let i = 0; i < n; i++) {
      const newEvents = primaryEventsByBar.get(i);
      if (!newEvents) continue;

      const correlatedAsOfIndex = correlatedConfirmedAtByTime(candles[i]!.openTime);

      for (const e of newEvents) {
        const track = primaryTrack[e.type];
        track.prev = track.last;
        track.last = e;

        // 無論主要資產是否已有前一個擺動點可比較，都要嘗試記錄比較資產當下對應的擺動點，
        // 否則比較資產的追蹤會比主要資產晚一拍才開始，導致第一次真正能比較時反而漏掉。
        const correlatedMatch = findNearestPastSwing(correlatedEvents, e.type, correlatedAsOfIndex, e.time, toleranceMs);
        const correlatedTrackForType = correlatedTrack[e.type];
        if (correlatedMatch && correlatedTrackForType.last?.pivotIndex !== correlatedMatch.pivotIndex) {
          correlatedTrackForType.prev = correlatedTrackForType.last;
          correlatedTrackForType.last = correlatedMatch;
        }

        if (!track.prev || !correlatedMatch || !correlatedTrackForType.prev) continue;

        const primaryMadeHigherHigh = e.type === "high" && track.last!.price > track.prev.price;
        const primaryMadeLowerLow = e.type === "low" && track.last!.price < track.prev.price;
        const correlatedFailedHigherHigh = e.type === "high" && correlatedMatch.price <= correlatedTrackForType.prev.price;
        const correlatedFailedLowerLow = e.type === "low" && correlatedMatch.price >= correlatedTrackForType.prev.price;

        if (e.type === "high" && primaryMadeHigherHigh && correlatedFailedHigherHigh) {
          signals.push({
            time: candles[i]!.openTime,
            symbol: ctx.symbol,
            interval: ctx.interval,
            type: "bearish_candidate",
            price: candles[i]!.close,
            reason: `${ctx.symbol} 創新高（${track.prev.price.toFixed(4)} → ${track.last!.price.toFixed(4)}），但 ${params.correlatedSymbol} 同期未同步創高（${correlatedTrackForType.prev.price.toFixed(4)} → ${correlatedMatch.price.toFixed(4)}），形成 SMT 頂背離`,
            confidence: 70,
            params: { ...params },
          });
        } else if (e.type === "low" && primaryMadeLowerLow && correlatedFailedLowerLow) {
          signals.push({
            time: candles[i]!.openTime,
            symbol: ctx.symbol,
            interval: ctx.interval,
            type: "bullish_candidate",
            price: candles[i]!.close,
            reason: `${ctx.symbol} 創新低（${track.prev.price.toFixed(4)} → ${track.last!.price.toFixed(4)}），但 ${params.correlatedSymbol} 同期未同步創低（${correlatedTrackForType.prev.price.toFixed(4)} → ${correlatedMatch.price.toFixed(4)}），形成 SMT 底背離`,
            confidence: 70,
            params: { ...params },
          });
        }
      }
    }

    return signals;
  },
};
