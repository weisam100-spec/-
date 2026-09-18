import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "./rateLimit";

export function withRateLimit(
  handler: (request: Request, ctx: unknown) => Promise<NextResponse>,
) {
  return async (request: Request, ctx: unknown) => {
    const ip = getClientIp(request);
    const { allowed, retryAfterSeconds } = checkRateLimit(`${new URL(request.url).pathname}:${ip}`);
    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: { message: "請求過於頻繁，請稍後再試", code: "rate_limited" } },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds ?? 60) } },
      );
    }
    return handler(request, ctx);
  };
}
