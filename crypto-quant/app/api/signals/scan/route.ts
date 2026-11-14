import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { env } from "@/lib/env";
import { fetchKlinesRange } from "@/lib/market/klinesRange";
import { SUPPORTED_SYMBOLS, INTERVAL_MS, type Interval } from "@/lib/market/symbols";
import { buildTrendSignalCard } from "@/lib/signals/trendSignalScan";

const querySchema = z.object({ interval: z.enum(["5m", "15m"]) });

/** 卡片上的迷你價格走勢與高低點固定取「最近 12 小時」，與選擇的週期無關 */
const WINDOW_HOURS = 12;

export const GET = withRateLimit(async (request) => {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ interval: searchParams.get("interval") });
  if (!parsed.success) {
    return apiError("interval 參數不合法，只支援 5m 或 15m", 400, "invalid_params");
  }
  const interval = parsed.data.interval as Interval;
  const windowBars = Math.max(1, Math.round((WINDOW_HOURS * 60 * 60 * 1000) / INTERVAL_MS[interval]));
  const lookbackBars = env.alertMaxLookbackBars;
  const endTime = Date.now();
  const startTime = endTime - lookbackBars * INTERVAL_MS[interval];

  const items = await Promise.all(
    SUPPORTED_SYMBOLS.map(async (meta) => {
      const result = await fetchKlinesRange({
        symbol: meta.symbol,
        interval,
        startTime,
        endTime,
        maxBars: lookbackBars,
      });
      if (result.unavailable || result.candles.length === 0) {
        return {
          symbol: meta.symbol,
          displayName: meta.displayName,
          card: null,
          unavailable: result.unavailable?.reason ?? "查無資料",
        };
      }
      return {
        symbol: meta.symbol,
        displayName: meta.displayName,
        card: buildTrendSignalCard(result.candles, meta.symbol, interval, windowBars),
        source: result.source,
        freshness: result.freshness,
      };
    }),
  );

  return apiOk({
    interval,
    items,
    disclaimer:
      "每張卡片都是把本站既有的「FVG 價格失衡區＋供需區策略」以預設參數套用在該交易對上的最新偵測結果，純屬歷史價格結構分析；信心分數僅供參考，不是勝率保證；不是投資建議，也不是依市場數據排出的多空推薦名單。",
  });
});
