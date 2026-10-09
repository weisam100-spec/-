import type { Candle } from "@/lib/market/types";
import { computeSwingEvents, type SwingEvent } from "./marketStructure";
import type { Strategy, StrategySignal } from "./types";

/**
 * SMC（Smart Money Concepts，聰明錢概念）策略。
 *
 * 核心邏輯（皆為業界通用的明確規則，非黑箱）：
 * 1. 擺動點（Swing Point）：某根 K 棒的高點／低點在前後 swingLookback 根範圍內為最高／最低，
 *    即視為擺動高點／擺動低點。擺動點必須等「右側」swingLookback 根 K 棒都出現後才算確認，
 *    因此在回測時完全不會用到未來資料（確認時間點 = 樞紐位置 + swingLookback）。
 * 2. 結構突破：收盤價突破前一個已確認的擺動高點，稱為向上突破；若當下結構原本是空頭，
 *    則稱為 CHoCH（Change of Character，結構轉變，可能反轉向上）；若原本已是多頭，
 *    則稱為 BOS（Break of Structure，延續原有多頭趨勢）。向下突破同理。
 * 3. 訂單塊（Order Block）：造成突破的那根帶動 K 棒（判斷其實體大小相對近期平均是否夠大，
 *    避免雜訊）之前，最後一根反方向的 K 棒，其高低區間視為訂單塊。
 * 4. 進場候選訊號：價格在突破之後回測（mitigate）訂單塊區間時，形成偏多／偏空候選訊號；
 *    訂單塊超過 maxMitigationBars 根 K 棒仍未被回測則視為失效，不再觸發。
 */

export interface SmcParams extends Record<string, unknown> {
  /** 擺動點左右各需要幾根 K 棒才能確認，數值越大代表抓取的結構轉折越重要但越慢確認 */
  swingLookback: number;
  /** 往前搜尋訂單塊候選 K 棒的範圍 */
  orderBlockLookback: number;
  /** 帶動突破的 K 棒實體大小，需達到近期平均實體的幾倍才視為有效的動能突破 */
  minDisplacementMultiple: number;
  /** 訂單塊若超過這麼多根 K 棒仍未被價格回測，視為失效 */
  maxMitigationBars: number;
}

export const smcDefaultParams: SmcParams = {
  swingLookback: 5,
  orderBlockLookback: 15,
  minDisplacementMultiple: 1.5,
  maxMitigationBars: 50,
};

/** 由突破點往前尋找最後一根反方向（下跌）K 棒，作為多頭訂單塊 */
function findBullishOrderBlock(candles: Candle[], breakIndex: number, lookback: number) {
  const from = Math.max(0, breakIndex - lookback);
  for (let j = breakIndex - 1; j >= from; j--) {
    const c = candles[j]!;
    if (c.close < c.open) return { high: c.high, low: c.low };
  }
  return null;
}

/** 由突破點往前尋找最後一根反方向（上漲）K 棒，作為空頭訂單塊 */
function findBearishOrderBlock(candles: Candle[], breakIndex: number, lookback: number) {
  const from = Math.max(0, breakIndex - lookback);
  for (let j = breakIndex - 1; j >= from; j--) {
    const c = candles[j]!;
    if (c.close > c.open) return { high: c.high, low: c.low };
  }
  return null;
}

interface PendingOrderBlock {
  type: "bullish" | "bearish";
  high: number;
  low: number;
  createdAt: number;
  reason: string;
  isChoch: boolean;
  displacementRatio: number;
}

export const smcStrategy: Strategy<SmcParams> = {
  id: "smc",
  name: "SMC 聰明錢概念策略",
  description:
    "基於市場結構轉變（CHoCH）、結構延續突破（BOS）與訂單塊（Order Block）回測的價格行為策略：結構突破後標記造成突破的訂單塊，待價格回測該區間時形成偏多／偏空候選訊號。",
  defaultParams: smcDefaultParams,

  validateParams(params) {
    const errors: string[] = [];
    if (!Number.isFinite(params.swingLookback) || params.swingLookback < 2 || params.swingLookback > 50) {
      errors.push("擺動點確認根數必須介於 2 至 50 之間");
    }
    if (!Number.isFinite(params.orderBlockLookback) || params.orderBlockLookback < 1 || params.orderBlockLookback > 100) {
      errors.push("訂單塊搜尋範圍必須介於 1 至 100 之間");
    }
    if (!Number.isFinite(params.minDisplacementMultiple) || params.minDisplacementMultiple <= 0) {
      errors.push("突破動能倍數必須大於 0");
    }
    if (!Number.isFinite(params.maxMitigationBars) || params.maxMitigationBars < 1 || params.maxMitigationBars > 500) {
      errors.push("訂單塊有效期（K 棒數）必須介於 1 至 500 之間");
    }
    return { valid: errors.length === 0, errors };
  },

  generateSignals(candles, params, ctx): StrategySignal[] {
    const n = candles.length;
    if (n < params.swingLookback * 2 + 2) return [];

    const events = computeSwingEvents(candles, params.swingLookback);
    const eventsByBar = new Map<number, SwingEvent[]>();
    for (const e of events) {
      const list = eventsByBar.get(e.confirmedAt);
      if (list) list.push(e);
      else eventsByBar.set(e.confirmedAt, [e]);
    }

    const bodySizes = candles.map((c) => Math.abs(c.close - c.open));

    let lastSwingHigh: number | null = null;
    let lastSwingLow: number | null = null;
    let structure: "bullish" | "bearish" | "unknown" = "unknown";
    const pendingOBs: PendingOrderBlock[] = [];
    const signals: StrategySignal[] = [];

    for (let i = 0; i < n; i++) {
      const newEvents = eventsByBar.get(i);
      if (newEvents) {
        for (const e of newEvents) {
          if (e.type === "high") lastSwingHigh = e.price;
          else lastSwingLow = e.price;
        }
      }

      const candle = candles[i]!;
      const windowStart = Math.max(0, i - 20);
      const avgBody = i > windowStart ? average(bodySizes.slice(windowStart, i)) : 0;
      const displacementRatio = avgBody > 0 ? bodySizes[i]! / avgBody : 0;

      // 向上突破（CHoCH 或 BOS）
      if (lastSwingHigh !== null && candle.close > lastSwingHigh) {
        const isChoch = structure === "bearish";
        if (displacementRatio >= params.minDisplacementMultiple) {
          const ob = findBullishOrderBlock(candles, i, params.orderBlockLookback);
          if (ob) {
            pendingOBs.push({
              type: "bullish",
              high: ob.high,
              low: ob.low,
              createdAt: i,
              isChoch,
              displacementRatio,
              reason: isChoch
                ? `價格突破前波段高點 ${lastSwingHigh.toFixed(4)}，結構由空轉多（CHoCH）`
                : `價格延續多頭結構，突破前波段高點 ${lastSwingHigh.toFixed(4)}（BOS）`,
            });
          }
        }
        structure = "bullish";
        lastSwingHigh = null; // 必須等待下一個新確認的擺動高點才能再次觸發
      }

      // 向下突破（CHoCH 或 BOS）
      if (lastSwingLow !== null && candle.close < lastSwingLow) {
        const isChoch = structure === "bullish";
        if (displacementRatio >= params.minDisplacementMultiple) {
          const ob = findBearishOrderBlock(candles, i, params.orderBlockLookback);
          if (ob) {
            pendingOBs.push({
              type: "bearish",
              high: ob.high,
              low: ob.low,
              createdAt: i,
              isChoch,
              displacementRatio,
              reason: isChoch
                ? `價格跌破前波段低點 ${lastSwingLow.toFixed(4)}，結構由多轉空（CHoCH）`
                : `價格延續空頭結構，跌破前波段低點 ${lastSwingLow.toFixed(4)}（BOS）`,
            });
          }
        }
        structure = "bearish";
        lastSwingLow = null;
      }

      // 檢查未被回測的訂單塊是否在本根 K 棒被價格回測（進場候選），或已過期失效
      for (let p = pendingOBs.length - 1; p >= 0; p--) {
        const ob = pendingOBs[p]!;
        if (i - ob.createdAt > params.maxMitigationBars) {
          pendingOBs.splice(p, 1);
          continue;
        }
        if (i === ob.createdAt) continue; // 突破當根不算回測，至少需下一根 K 棒

        const touched = candle.low <= ob.high && candle.high >= ob.low;
        if (!touched) continue;

        const confidence = Math.round(Math.min(95, 55 + Math.min(25, ob.displacementRatio * 8) + (ob.isChoch ? 10 : 0)));
        signals.push({
          time: candle.openTime,
          symbol: ctx.symbol,
          interval: ctx.interval,
          type: ob.type === "bullish" ? "bullish_candidate" : "bearish_candidate",
          price: candle.close,
          reason: `${ob.reason}，價格回測訂單塊 ${ob.low.toFixed(4)}~${ob.high.toFixed(4)}`,
          confidence,
          params: { ...params },
        });
        pendingOBs.splice(p, 1);
      }
    }

    return signals;
  },
};

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
