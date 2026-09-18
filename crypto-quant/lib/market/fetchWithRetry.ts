import { env } from "@/lib/env";

export class UpstreamFetchError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "UpstreamFetchError";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 對外部資料來源做有限次數的重試（指數退避），絕不無限重試。
 * 4xx（除 429 外）視為不可重試的錯誤，直接拋出。
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  opts?: { maxRetries?: number; baseMs?: number; timeoutMs?: number },
): Promise<Response> {
  const maxRetries = opts?.maxRetries ?? env.fetchMaxRetries;
  const baseMs = opts?.baseMs ?? env.fetchRetryBaseMs;
  const timeoutMs = opts?.timeoutMs ?? 8000;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return res;

      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt === maxRetries) {
        throw new UpstreamFetchError(`上游 API 回應錯誤 (HTTP ${res.status})`, res.status);
      }
      lastError = new UpstreamFetchError(`上游 API 回應錯誤 (HTTP ${res.status})`, res.status);
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt === maxRetries) break;
    }
    const delay = baseMs * 2 ** attempt + Math.random() * 100;
    await sleep(delay);
  }
  if (lastError instanceof Error) throw lastError;
  throw new UpstreamFetchError("上游 API 呼叫失敗");
}
