import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { symbolSchema } from "@/lib/api/backtestSchema";
import { env } from "@/lib/env";
import { fetchStrategyCandles } from "@/lib/market/strategyData";
import { fvgSupplyDemandStrategy, fvgSupplyDemandDefaultParams } from "@/lib/strategies/fvgSupplyDemand";
import { SIGNAL_TYPE_LABEL } from "@/lib/strategies/types";
import { INTERVAL_MS, type Interval } from "@/lib/market/symbols";
import type { StrategyId } from "@/lib/strategies/registry";

const querySchema = z.object({ symbol: symbolSchema });

/**
 * 觀察清單用：在固定的 1 小時週期、使用「FVG 價格失衡區＋供需區策略」預設參數，
 * 回報該交易對最新一筆候選訊號（若有）。這只是把本站既有策略的歷史訊號偵測結果
 * 套用到觀察清單的交易對上，純屬歷史價格結構分析，不是「該買或該賣」的建議，
 * 也不是任何形式的多空排名或推薦名單。
 */
const SIGNAL_INTERVAL: Interval = "1h";

export const GET = withRateLimit(async (request) => {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ symbol: searchParams.get("symbol") });
  if (!parsed.success) {
    return apiError("symbol 參數不合法或未在白名單內", 400, "invalid_params");
  }

  const endTime = Date.now();
  const startTime = endTime - env.alertMaxLookbackBars * INTERVAL_MS[SIGNAL_INTERVAL];

  const { primary } = await fetchStrategyCandles({
    strategyId: fvgSupplyDemandStrategy.id as StrategyId,
    symbol: parsed.data.symbol,
    interval: SIGNAL_INTERVAL,
    strategyParams: fvgSupplyDemandDefaultParams,
    startTime,
    endTime,
    maxBars: env.alertMaxLookbackBars,
  });

  if (primary.unavailable) {
    return apiError(`目前無法取得 ${parsed.data.symbol} 資料：${primary.unavailable.reason}`, 502, "data_unavailable");
  }
  if (primary.candles.length === 0) {
    return apiOk({ signal: null, interval: SIGNAL_INTERVAL });
  }

  const signals = fvgSupplyDemandStrategy.generateSignals(primary.candles, fvgSupplyDemandDefaultParams, {
    symbol: parsed.data.symbol,
    interval: SIGNAL_INTERVAL,
  });
  const latest = signals[signals.length - 1];
  if (!latest) {
    return apiOk({ signal: null, interval: SIGNAL_INTERVAL });
  }

  return apiOk({
    signal: {
      time: latest.time,
      type: latest.type,
      label: SIGNAL_TYPE_LABEL[latest.type],
      price: latest.price,
    },
    interval: SIGNAL_INTERVAL,
  });
});
