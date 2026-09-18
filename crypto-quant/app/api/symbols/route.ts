import { apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { SUPPORTED_SYMBOLS, SUPPORTED_INTERVALS, INTERVAL_LABEL } from "@/lib/market/symbols";

export const GET = withRateLimit(async () => {
  return apiOk({
    symbols: SUPPORTED_SYMBOLS,
    intervals: SUPPORTED_INTERVALS.map((id) => ({ id, label: INTERVAL_LABEL[id] })),
  });
});
