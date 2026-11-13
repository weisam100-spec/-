import type { Candle } from "@/lib/market/types";
import { INTERVAL_MS, type Interval } from "@/lib/market/symbols";
import { fetchKlinesRange } from "@/lib/market/klinesRange";
import { listEnabledPriceAlertRules, markPriceAlertTriggered, type PriceAlertRule } from "@/lib/storage/priceAlertRepo";
import { dispatchToWorkspace } from "@/lib/notifications/dispatch";
import { formatDateTime, formatPercent, formatUsdt } from "@/lib/format";

export interface PriceMoveEvaluation {
  changePct: number;
  direction: "up" | "down";
  fromPrice: number;
  toPrice: number;
  fromTime: number;
  toTime: number;
}

/**
 * 純函式：在給定的 K 棒序列與規則下，判斷是否該觸發「異常價格波動」警報。
 * 只比較「視窗起點」與「最新已收盤」兩個時間點的收盤價計算漲跌幅，單純的歷史數字計算，
 * 不涉及任何預測。冷卻期（等於視窗長度）用來避免同一波動被重複通知。
 */
export function evaluatePriceMove(
  candles: Candle[],
  rule: Pick<PriceAlertRule, "thresholdPct" | "windowMinutes" | "direction" | "lastTriggeredAt">,
  now: number,
): PriceMoveEvaluation | null {
  const closed = candles.filter((c) => c.closed).sort((a, b) => a.openTime - b.openTime);
  if (closed.length < 2) return null;

  const windowMs = rule.windowMinutes * 60 * 1000;
  if (rule.lastTriggeredAt !== null && now - rule.lastTriggeredAt < windowMs) return null;

  const latest = closed[closed.length - 1]!;
  const cutoff = latest.openTime - windowMs;

  // 找出視窗起點「當下或之前」最接近的一根已收盤 K 棒作為基準價
  let baseline: Candle | null = null;
  for (const c of closed) {
    if (c.openTime > cutoff) break;
    baseline = c;
  }
  if (!baseline || baseline.openTime === latest.openTime) return null;

  const changePct = ((latest.close - baseline.close) / baseline.close) * 100;
  if (Math.abs(changePct) < rule.thresholdPct) return null;

  const direction: "up" | "down" = changePct >= 0 ? "up" : "down";
  if (rule.direction !== "both" && rule.direction !== direction) return null;

  return {
    changePct,
    direction,
    fromPrice: baseline.close,
    toPrice: latest.close,
    fromTime: baseline.openTime,
    toTime: latest.openTime,
  };
}

export interface PriceAlertCheckSummary {
  checkedRules: number;
  triggeredRules: number;
  errors: { ruleId: string; message: string }[];
}

/** 判斷異常波動用固定採用 5 分鐘 K 棒，足以涵蓋常見的視窗長度設定（5 分鐘以上） */
const CHECK_INTERVAL: Interval = "5m";

/**
 * 對所有已啟用的異常價格波動規則抓取最新資料並判斷是否觸發，觸發時透過該工作區
 * 已啟用的通知管道發送（與策略訊號提醒共用同一套管道）。單一規則失敗不影響其他規則。
 */
export async function checkPriceAlertsOnce(): Promise<PriceAlertCheckSummary> {
  const rules = listEnabledPriceAlertRules();
  const summary: PriceAlertCheckSummary = { checkedRules: 0, triggeredRules: 0, errors: [] };

  for (const rule of rules) {
    summary.checkedRules++;
    try {
      const endTime = Date.now();
      const bufferBars = 10;
      const startTime = endTime - rule.windowMinutes * 60 * 1000 - bufferBars * INTERVAL_MS[CHECK_INTERVAL];
      const result = await fetchKlinesRange({
        symbol: rule.symbol,
        interval: CHECK_INTERVAL,
        startTime,
        endTime,
        maxBars: Math.ceil(rule.windowMinutes / 5) + bufferBars + 5,
      });
      if (result.unavailable || result.candles.length === 0) continue;

      const evaluation = evaluatePriceMove(result.candles, rule, endTime);
      if (!evaluation) continue;

      const directionLabel = evaluation.direction === "up" ? "急漲" : "急跌";
      const title = `【異常價格波動】${rule.symbol} ${directionLabel}`;
      const text = [
        `${formatDateTime(evaluation.fromTime)} ~ ${formatDateTime(evaluation.toTime)}（約 ${rule.windowMinutes} 分鐘內）`,
        `${formatUsdt(evaluation.fromPrice)} → ${formatUsdt(evaluation.toPrice)}（${formatPercent(evaluation.changePct)}）`,
        "純粹是價格歷史數字變動的計算結果，不是預測或投資建議。",
      ].join("\n");

      const results = await dispatchToWorkspace(rule.workspaceId, { title, text });
      markPriceAlertTriggered(rule.id, endTime);
      if (results.some((r) => r.ok)) summary.triggeredRules++;
    } catch (err) {
      summary.errors.push({ ruleId: rule.id, message: err instanceof Error ? err.message : "未知錯誤" });
    }
  }

  return summary;
}
