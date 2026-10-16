import { detectOrderBlocks } from "./orderBlockDetection";
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

export const smcStrategy: Strategy<SmcParams> = {
  id: "smc",
  name: "SMC 聰明錢概念策略",
  description:
    "基於市場結構轉變（CHoCH）、結構延續突破（BOS）與訂單塊（Order Block）回測的價格行為策略：結構突破後標記造成突破的訂單塊，待價格回測該區間時形成偏多／偏空候選訊號。",
  defaultParams: smcDefaultParams,

  validateParams(params) {
    const errors: string[] = [];
    if (
      !Number.isFinite(params.swingLookback) ||
      params.swingLookback < 2 ||
      params.swingLookback > 50
    ) {
      errors.push("擺動點確認根數必須介於 2 至 50 之間");
    }
    if (
      !Number.isFinite(params.orderBlockLookback) ||
      params.orderBlockLookback < 1 ||
      params.orderBlockLookback > 100
    ) {
      errors.push("訂單塊搜尋範圍必須介於 1 至 100 之間");
    }
    if (
      !Number.isFinite(params.minDisplacementMultiple) ||
      params.minDisplacementMultiple <= 0
    ) {
      errors.push("突破動能倍數必須大於 0");
    }
    if (
      !Number.isFinite(params.maxMitigationBars) ||
      params.maxMitigationBars < 1 ||
      params.maxMitigationBars > 500
    ) {
      errors.push("訂單塊有效期（K 棒數）必須介於 1 至 500 之間");
    }
    return { valid: errors.length === 0, errors };
  },

  generateSignals(candles, params, ctx): StrategySignal[] {
    const { touches } = detectOrderBlocks(candles, params);
    return touches.map(
      (t): StrategySignal => ({
        time: t.time,
        symbol: ctx.symbol,
        interval: ctx.interval,
        type: t.type === "bullish" ? "bullish_candidate" : "bearish_candidate",
        price: t.price,
        reason: `${t.reason}，價格回測訂單塊 ${t.low.toFixed(4)}~${t.high.toFixed(4)}`,
        confidence: Math.round(
          Math.min(
            95,
            55 + Math.min(25, t.displacementRatio * 8) + (t.isChoch ? 10 : 0),
          ),
        ),
        params: { ...params },
      }),
    );
  },
};
