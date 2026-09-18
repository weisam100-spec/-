import { apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { listStrategies } from "@/lib/strategies/registry";

export const GET = withRateLimit(async () => {
  return apiOk({ strategies: listStrategies() });
});
