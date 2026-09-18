import { apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { getUsdtTwdRate } from "@/lib/market/fx";

export const GET = withRateLimit(async () => {
  const rate = await getUsdtTwdRate();
  return apiOk(rate);
});
