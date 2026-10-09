import { apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { env } from "@/lib/env";

export const GET = withRateLimit(async () => {
  return apiOk({ publicKey: env.vapidPublicKey || null });
});
