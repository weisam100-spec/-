import { env } from "@/lib/env";
import { fetchStrategyCandles } from "@/lib/market/strategyData";
import { strategyRegistry, type StrategyId } from "@/lib/strategies/registry";
import { SIGNAL_TYPE_LABEL } from "@/lib/strategies/types";
import { listAlertEnabledConfigs, markConfigNotified } from "@/lib/storage/strategyConfigRepo";
import { dispatchToWorkspace } from "@/lib/notifications/dispatch";
import { formatDateTime, formatUsdt } from "@/lib/format";
import { INTERVAL_MS, type Interval } from "@/lib/market/symbols";

export interface AlertCheckSummary {
  checkedConfigs: number;
  notifiedConfigs: number;
  errors: { configId: string; message: string }[];
}

/**
 * 對單一啟用提醒的策略設定抓取最新資料、產生訊號，若有「上次通知之後才出現」的新訊號，
 * 透過該工作區已啟用的通知管道發送（Telegram / Email / 瀏覽器推播），並更新通知基準。
 * 資料或策略執行失敗時不會中斷整批排程，只記錄該筆錯誤繼續處理下一筆。
 */
export async function checkAlertsOnce(): Promise<AlertCheckSummary> {
  const configs = listAlertEnabledConfigs();
  const summary: AlertCheckSummary = { checkedConfigs: 0, notifiedConfigs: 0, errors: [] };

  for (const config of configs) {
    summary.checkedConfigs++;
    try {
      const interval = config.interval as Interval;
      const endTime = Date.now();
      const startTime = endTime - env.alertMaxLookbackBars * INTERVAL_MS[interval];

      const { primary, correlated } = await fetchStrategyCandles({
        strategyId: config.strategyId,
        symbol: config.symbol,
        interval,
        strategyParams: config.params,
        startTime,
        endTime,
        maxBars: env.alertMaxLookbackBars,
      });

      if (primary.unavailable || correlated?.unavailable) {
        summary.errors.push({
          configId: config.id,
          message: primary.unavailable?.reason ?? correlated?.unavailable?.reason ?? "資料無法取得",
        });
        continue;
      }
      if (primary.candles.length === 0) continue;

      const strategy = strategyRegistry[config.strategyId as StrategyId];
      const validation = strategy.validateParams(config.params as never);
      if (!validation.valid) {
        summary.errors.push({ configId: config.id, message: `策略參數不合法：${validation.errors.join("；")}` });
        continue;
      }

      const signals = strategy.generateSignals(primary.candles, config.params as never, {
        symbol: config.symbol,
        interval,
        correlatedCandles: correlated?.candles,
        correlatedSymbol: typeof config.params.correlatedSymbol === "string" ? config.params.correlatedSymbol : undefined,
      });
      if (signals.length === 0) continue;

      // 只保留收盤已確定的訊號（忽略最後一根可能尚未收盤的 K 棒），避免通知之後又反悔的暫時訊號
      const closedCandleTimes = new Set(primary.candles.filter((c) => c.closed).map((c) => c.openTime));
      const confirmedSignals = signals.filter((s) => closedCandleTimes.has(s.time));

      const baseline = config.lastNotifiedSignalTime;
      const newSignals =
        baseline === null ? [] : confirmedSignals.filter((s) => s.time > baseline);

      if (baseline === null) {
        // 第一次啟用提醒：只建立基準，不回溯通知歷史訊號
        const latest = confirmedSignals[confirmedSignals.length - 1];
        if (latest) markConfigNotified(config.id, latest.time);
        continue;
      }

      if (newSignals.length === 0) continue;

      const lines = newSignals.map(
        (s) => `${formatDateTime(s.time)}｜${SIGNAL_TYPE_LABEL[s.type]}｜${formatUsdt(s.price)}\n原因：${s.reason}`,
      );
      const title = `【${config.name}】${config.symbol} 出現新訊號`;
      const text = lines.join("\n\n");

      const results = await dispatchToWorkspace(config.workspaceId, { title, text });
      if (results.some((r) => r.ok)) {
        summary.notifiedConfigs++;
      }
      // 無論是否真的送出通知（該工作區也可能根本沒啟用任何管道），都更新基準，
      // 避免下次又重新累積同一批舊訊號。
      const latestTime = newSignals[newSignals.length - 1]!.time;
      markConfigNotified(config.id, latestTime);
    } catch (err) {
      summary.errors.push({ configId: config.id, message: err instanceof Error ? err.message : "未知錯誤" });
    }
  }

  return summary;
}
