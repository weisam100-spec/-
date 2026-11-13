import { detectOrderBlocks, type OrderBlockTouch } from "./orderBlockDetection";
import { detectFvgZones, type FvgTouch } from "./fvgDetection";
import { HIGHER_TIMEFRAME, computeStructureTrend, structureAsOf } from "./higherTimeframe";
import { INTERVAL_LABEL, INTERVAL_MS } from "@/lib/market/symbols";
import type { RiskLevels, Strategy, StrategyContext, StrategySignal } from "./types";

/**
 * FVG（價格失衡區）＋供需區雙重確認策略。
 *
 * 靈感來自常見的 SMC（Smart Money Concepts）圖表分析風格：在圖上用色塊標示供給／需求區
 * 與價格失衡區（Fair Value Gap）。這裡實作的是這兩個概念公開、明確的定義，
 * 並非複製任何特定人士或課程的私有規則（那類規則通常是主觀畫線，無法從單張截圖還原）。
 *
 * 核心邏輯：
 * 1. 供需區：沿用訂單塊（Order Block）偵測（@/lib/strategies/orderBlockDetection），
 *    多頭訂單塊＝需求區，空頭訂單塊＝供給區。
 * 2. 價格失衡區（FVG）：連續三根 K 棒中第 1、3 根之間出現沒有重疊的缺口
 *    （@/lib/strategies/fvgDetection）。
 * 3. 雙重確認：當「價格回測供需區」與「價格回補同方向 FVG」這兩個事件發生在彼此
 *    confirmWindowBars 根 K 棒之內（不限先後順序），才視為雙重確認，形成候選訊號；
 *    只有單一條件成立（只有供需區或只有 FVG）不會觸發訊號，藉此降低雜訊。
 * 4. 無未來函數：事件依照發生的時間順序逐一處理，比對時只會用到「已經發生」的事件，
 *    不會用到尚未出現的 K 棒資料；因此回測時若只使用部分資料，產生的訊號與完整資料
 *    在相同時間點之前必定完全一致。
 */

export interface FvgSupplyDemandParams extends Record<string, unknown> {
  /** FVG 缺口大小需達到缺口中點價格的這個百分比以上，才視為有效缺口 */
  minGapPct: number;
  /** FVG 缺口超過這麼多根 K 棒仍未回補，視為失效 */
  maxFvgAgeBars: number;
  /** 擺動點左右各需要幾根 K 棒才能確認供需區 */
  swingLookback: number;
  /** 往前搜尋供需區候選 K 棒的範圍 */
  orderBlockLookback: number;
  /** 帶動突破的 K 棒實體大小，需達到近期平均實體的幾倍才視為有效的動能突破 */
  minDisplacementMultiple: number;
  /** 供需區超過這麼多根 K 棒仍未被價格回測，視為失效 */
  maxMitigationBars: number;
  /** 供需區回測與 FVG 回補須在彼此這麼多根 K 棒之內，才視為雙重確認 */
  confirmWindowBars: number;
  /**
   * 多時間框架順勢過濾：啟用後，只有當高一層時間週期（對照表見 @/lib/strategies/higherTimeframe）
   * 當下的市場結構方向與訊號方向一致時，才會保留該訊號；方向不一致或結構尚未明朗則濾掉。
   * 主要週期已是日線（無更高週期可用）時，此開關不會有效果。
   */
  useHigherTimeframeFilter: boolean;
}

export const fvgSupplyDemandDefaultParams: FvgSupplyDemandParams = {
  minGapPct: 0.1,
  maxFvgAgeBars: 40,
  swingLookback: 5,
  orderBlockLookback: 15,
  minDisplacementMultiple: 1.5,
  maxMitigationBars: 50,
  confirmWindowBars: 5,
  useHigherTimeframeFilter: false,
};

type ZoneType = "bullish" | "bearish";

interface TouchEvent {
  index: number;
  time: number;
  price: number;
  type: ZoneType;
  source: "ob" | "fvg";
  ob?: OrderBlockTouch;
  fvg?: FvgTouch;
}

/**
 * 停損緩衝：避免停損價剛好設在區間邊界，價格稍微觸碰邊界就立刻出場；
 * 以區間邊界再往外推一個很小的百分比（0.1%），純屬數學上的緩衝，不是任何交易建議。
 */
const STOP_BUFFER_PCT = 0.1;

function computeRiskLevels(
  type: "bullish" | "bearish",
  entryPrice: number,
  ob: OrderBlockTouch,
  fvg: FvgTouch,
): RiskLevels | undefined {
  if (type === "bullish") {
    const zoneBottom = Math.min(ob.low, fvg.bottom);
    const stopPrice = zoneBottom * (1 - STOP_BUFFER_PCT / 100);
    const riskPerUnit = entryPrice - stopPrice;
    if (riskPerUnit <= 0) return undefined;
    return {
      stopPrice,
      riskPerUnit,
      rr2Price: entryPrice + riskPerUnit * 2,
      rr3Price: entryPrice + riskPerUnit * 3,
    };
  }
  const zoneTop = Math.max(ob.high, fvg.top);
  const stopPrice = zoneTop * (1 + STOP_BUFFER_PCT / 100);
  const riskPerUnit = stopPrice - entryPrice;
  if (riskPerUnit <= 0) return undefined;
  return {
    stopPrice,
    riskPerUnit,
    rr2Price: entryPrice - riskPerUnit * 2,
    rr3Price: entryPrice - riskPerUnit * 3,
  };
}

function buildSignal(
  ob: OrderBlockTouch,
  fvg: FvgTouch,
  later: TouchEvent,
  ctx: StrategyContext,
  params: FvgSupplyDemandParams,
): StrategySignal {
  const dist = Math.abs(ob.index - fvg.index);
  const confidence = Math.round(
    Math.min(95, 60 + (ob.isChoch ? 10 : 0) + Math.max(0, 10 - dist * 2)),
  );
  const zoneLabel = ob.type === "bullish" ? "需求區" : "供給區";
  return {
    time: later.time,
    symbol: ctx.symbol,
    interval: ctx.interval,
    type: ob.type === "bullish" ? "bullish_candidate" : "bearish_candidate",
    price: later.price,
    reason: `${ob.reason}，價格回測${zoneLabel} ${ob.low.toFixed(4)}~${ob.high.toFixed(4)}；同方向價格失衡區（FVG）${fvg.bottom.toFixed(4)}~${fvg.top.toFixed(4)} 亦被回補，兩者相距 ${dist} 根 K 棒內，視為供需區＋FVG 雙重確認`,
    confidence,
    params: { ...params },
    riskLevels: computeRiskLevels(ob.type, later.price, ob, fvg),
  };
}

function generateCombinedSignals(
  obTouches: OrderBlockTouch[],
  fvgTouches: FvgTouch[],
  windowBars: number,
  ctx: StrategyContext,
  params: FvgSupplyDemandParams,
): StrategySignal[] {
  const events: TouchEvent[] = [
    ...obTouches.map((t): TouchEvent => ({ index: t.index, time: t.time, price: t.price, type: t.type, source: "ob", ob: t })),
    ...fvgTouches.map((t): TouchEvent => ({ index: t.index, time: t.time, price: t.price, type: t.type, source: "fvg", fvg: t })),
  ].sort((a, b) => a.index - b.index || (a.source === "ob" ? -1 : 1));

  const pendingOb: Record<ZoneType, TouchEvent[]> = { bullish: [], bearish: [] };
  const pendingFvg: Record<ZoneType, TouchEvent[]> = { bullish: [], bearish: [] };
  const signals: StrategySignal[] = [];

  for (const ev of events) {
    const ownPending = ev.source === "ob" ? pendingOb[ev.type] : pendingFvg[ev.type];
    const otherPending = ev.source === "ob" ? pendingFvg[ev.type] : pendingOb[ev.type];

    // 只比對「已經發生」（index <= 當前事件）的事件，確保無未來函數
    let bestIndexInList = -1;
    let bestDist = Infinity;
    for (let k = 0; k < otherPending.length; k++) {
      const dist = ev.index - otherPending[k]!.index;
      if (dist <= windowBars && dist < bestDist) {
        bestDist = dist;
        bestIndexInList = k;
      }
    }

    if (bestIndexInList >= 0) {
      const partner = otherPending[bestIndexInList]!;
      otherPending.splice(bestIndexInList, 1);
      const ob = (ev.source === "ob" ? ev.ob : partner.ob)!;
      const fvg = (ev.source === "fvg" ? ev.fvg : partner.fvg)!;
      signals.push(buildSignal(ob, fvg, ev, ctx, params));
    } else {
      ownPending.push(ev);
    }
  }

  signals.sort((a, b) => a.time - b.time);
  return signals;
}

export const fvgSupplyDemandStrategy: Strategy<FvgSupplyDemandParams> = {
  id: "fvg-supply-demand",
  name: "FVG 價格失衡區＋供需區策略",
  description:
    "結合兩個公開、明確定義的 SMC 概念：供需區（訂單塊回測）與價格失衡區（FVG 回補）。只有當兩者在彼此設定的根數範圍內同時發生，才視為雙重確認形成候選訊號，藉此降低單一條件觸發的雜訊。",
  defaultParams: fvgSupplyDemandDefaultParams,

  validateParams(params) {
    const errors: string[] = [];
    if (!Number.isFinite(params.minGapPct) || params.minGapPct < 0 || params.minGapPct > 10) {
      errors.push("FVG 最小缺口比例必須介於 0 至 10% 之間");
    }
    if (!Number.isFinite(params.maxFvgAgeBars) || params.maxFvgAgeBars < 1 || params.maxFvgAgeBars > 500) {
      errors.push("FVG 有效期（K 棒數）必須介於 1 至 500 之間");
    }
    if (!Number.isFinite(params.swingLookback) || params.swingLookback < 2 || params.swingLookback > 50) {
      errors.push("擺動點確認根數必須介於 2 至 50 之間");
    }
    if (!Number.isFinite(params.orderBlockLookback) || params.orderBlockLookback < 1 || params.orderBlockLookback > 100) {
      errors.push("供需區搜尋範圍必須介於 1 至 100 之間");
    }
    if (!Number.isFinite(params.minDisplacementMultiple) || params.minDisplacementMultiple <= 0) {
      errors.push("突破動能倍數必須大於 0");
    }
    if (!Number.isFinite(params.maxMitigationBars) || params.maxMitigationBars < 1 || params.maxMitigationBars > 500) {
      errors.push("供需區有效期（K 棒數）必須介於 1 至 500 之間");
    }
    if (!Number.isFinite(params.confirmWindowBars) || params.confirmWindowBars < 0 || params.confirmWindowBars > 100) {
      errors.push("雙重確認容許根數必須介於 0 至 100 之間");
    }
    if (typeof params.useHigherTimeframeFilter !== "boolean") {
      errors.push("多時間框架順勢過濾開關必須是布林值");
    }
    return { valid: errors.length === 0, errors };
  },

  requiresHigherTimeframe: true,

  generateSignals(candles, params, ctx): StrategySignal[] {
    const { touches: obTouches } = detectOrderBlocks(candles, {
      swingLookback: params.swingLookback,
      orderBlockLookback: params.orderBlockLookback,
      minDisplacementMultiple: params.minDisplacementMultiple,
      maxMitigationBars: params.maxMitigationBars,
    });
    const { touches: fvgTouches } = detectFvgZones(candles, {
      minGapPct: params.minGapPct,
      maxAgeBars: params.maxFvgAgeBars,
    });
    const signals = generateCombinedSignals(obTouches, fvgTouches, params.confirmWindowBars, ctx, params);

    if (!params.useHigherTimeframeFilter) return signals;
    const higherInterval = HIGHER_TIMEFRAME[ctx.interval];
    if (higherInterval === null || !ctx.higherTimeframeCandles || ctx.higherTimeframeCandles.length === 0) {
      // 沒有更高週期可用，或呼叫端未提供高週期資料：無法過濾，原樣放行，不假裝有做過濾
      return signals;
    }
    const higherIntervalMs = INTERVAL_MS[higherInterval];
    const trend = computeStructureTrend(ctx.higherTimeframeCandles, params.swingLookback);
    return signals
      .filter((s) => {
        const higherStructure = structureAsOf(trend, s.time, higherIntervalMs);
        if (s.type === "bullish_candidate") return higherStructure === "bullish";
        if (s.type === "bearish_candidate") return higherStructure === "bearish";
        return true;
      })
      .map((s) => ({
        ...s,
        reason: `${s.reason}；${INTERVAL_LABEL[higherInterval]}週期結構同方向，符合多時間框架順勢過濾`,
      }));
  },
};
