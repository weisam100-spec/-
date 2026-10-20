import type { Strategy, StrategySignal } from "./types";

/**
 * 每日基準線策略（Daily Reference Line）。
 *
 * 部分當沖交易者會把每天固定時間（例如台北時間中午 12 點）當根 K 棒的收盤價畫一條水平線，
 * 作為當天的參考基準：之後價格站上這條線視為偏多候選，跌破視為偏空候選。
 * 這純粹是以固定時間點切出的參考價位，不是公認的技術分析理論，效果會因市場、時段、
 * 交易對而異，請自行評估後再決定是否採用。
 *
 * 規則（皆為明確規則，非黑箱）：
 * 1. 每個台北曆日（Asia/Taipei，全年固定 UTC+8，無日光節約時間）當天第一根「開盤時間已達
 *    基準時刻」的 K 棒，以其收盤價作為當天的基準價；基準價一旦確立便不再變動，直到換日重設。
 * 2. 基準價確立後，從下一根 K 棒開始比較收盤價與基準價的相對位置；當相對位置由下轉上
 *    （跌破→站上）觸發偏多候選訊號，由上轉下（站上→跌破）觸發偏空候選訊號。
 * 3. 兩次訊號之間至少間隔 cooldownBars 根 K 棒，避免價格貼著基準線來回時連續觸發。
 * 4. 僅適合日內週期（5 分鐘～4 小時）；日線以上每根 K 棒本身就橫跨整天，通常不會產生訊號。
 */

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

export interface DailyReferenceLineParams extends Record<string, unknown> {
  /** 每日基準時間（台北時間，24 小時制）的小時數 */
  anchorHour: number;
  /** 每日基準時間的分鐘數 */
  anchorMinute: number;
  /** 兩次訊號之間至少間隔幾根 K 棒 */
  cooldownBars: number;
}

export const dailyReferenceLineDefaultParams: DailyReferenceLineParams = {
  anchorHour: 12,
  anchorMinute: 0,
  cooldownBars: 5,
};

function taipeiDateKeyAndMinutes(epochMs: number): { dateKey: number; minutesOfDay: number } {
  const local = epochMs + TAIPEI_OFFSET_MS;
  const dateKey = Math.floor(local / 86_400_000);
  const minutesOfDay = Math.floor((local - dateKey * 86_400_000) / 60_000);
  return { dateKey, minutesOfDay };
}

export const dailyReferenceLineStrategy: Strategy<DailyReferenceLineParams> = {
  id: "daily-reference-line",
  name: "每日基準線策略",
  description:
    "每個台北曆日固定時間（預設中午 12 點）當根 K 棒的收盤價畫一條水平基準線：之後價格站上這條線視為偏多候選，跌破視為偏空候選。純屬以固定時間點切出的參考價位，不是公認的技術分析理論，效果因市場與時段而異，僅適合日內週期，請自行評估後再決定是否採用。",
  defaultParams: dailyReferenceLineDefaultParams,

  validateParams(params) {
    const errors: string[] = [];
    if (!Number.isInteger(params.anchorHour) || params.anchorHour < 0 || params.anchorHour > 23) {
      errors.push("基準時間的小時數必須是 0 到 23 之間的整數");
    }
    if (!Number.isInteger(params.anchorMinute) || params.anchorMinute < 0 || params.anchorMinute > 59) {
      errors.push("基準時間的分鐘數必須是 0 到 59 之間的整數");
    }
    if (!Number.isInteger(params.cooldownBars) || params.cooldownBars < 0 || params.cooldownBars > 500) {
      errors.push("訊號冷卻根數必須介於 0 至 500 之間的整數");
    }
    return { valid: errors.length === 0, errors };
  },

  generateSignals(candles, params, ctx): StrategySignal[] {
    const anchorMinutesOfDay = params.anchorHour * 60 + params.anchorMinute;
    const signals: StrategySignal[] = [];
    const anchorLabel = `${String(params.anchorHour).padStart(2, "0")}:${String(params.anchorMinute).padStart(2, "0")}`;

    let currentDateKey: number | null = null;
    let anchorPrice: number | null = null;
    let anchorSet = false;
    let prevAboveAnchor: boolean | null = null;
    let lastSignalIndex = -Infinity;

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i]!;
      const { dateKey, minutesOfDay } = taipeiDateKeyAndMinutes(c.openTime);

      if (dateKey !== currentDateKey) {
        currentDateKey = dateKey;
        anchorPrice = null;
        anchorSet = false;
        prevAboveAnchor = null;
      }

      if (!anchorSet) {
        if (minutesOfDay >= anchorMinutesOfDay) {
          anchorPrice = c.close;
          anchorSet = true;
        }
        continue;
      }

      const isAbove = c.close > anchorPrice!;
      if (prevAboveAnchor !== null && isAbove !== prevAboveAnchor && i - lastSignalIndex >= params.cooldownBars) {
        signals.push({
          time: c.openTime,
          symbol: ctx.symbol,
          interval: ctx.interval,
          type: isAbove ? "bullish_candidate" : "bearish_candidate",
          price: c.close,
          reason: isAbove
            ? `收盤價 ${c.close.toFixed(4)} 站上今日 ${anchorLabel} 基準價 ${anchorPrice!.toFixed(4)}`
            : `收盤價 ${c.close.toFixed(4)} 跌破今日 ${anchorLabel} 基準價 ${anchorPrice!.toFixed(4)}`,
          confidence: 55,
          params: { ...params },
        });
        lastSignalIndex = i;
      }
      prevAboveAnchor = isAbove;
    }

    return signals;
  },
};
