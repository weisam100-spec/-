const FINMIND_BASE_URL = "https://api.finmindtrade.com/api/v4/data";

export class FinMindRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinMindRequestError";
  }
}

interface FinMindEnvelope<T> {
  status: number;
  msg: string;
  data: T[];
}

/**
 * FinMind (https://finmindtrade.com) aggregates official TWSE/TPEx data into
 * a single free JSON API — no API key required for light usage. Set
 * FINMIND_TOKEN in the environment to raise the free-tier rate limit if you
 * hit 402/429 responses (register a free token at finmindtrade.com).
 */
export async function fetchFinMindDataset<T>(
  dataset: string,
  params: Record<string, string>
): Promise<T[]> {
  const url = new URL(FINMIND_BASE_URL);
  url.searchParams.set("dataset", dataset);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const token = process.env.FINMIND_TOKEN;
  if (token) url.searchParams.set("token", token);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let res: Response;
  try {
    res = await fetch(url.toString(), { signal: controller.signal });
  } catch (err) {
    throw new FinMindRequestError(
      `無法連接股市資料來源（FinMind），請確認網路連線後再試：${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new FinMindRequestError(`股市資料來源回應錯誤（HTTP ${res.status}）`);
  }

  const body = (await res.json()) as FinMindEnvelope<T>;
  if (body.status !== 200) {
    throw new FinMindRequestError(`股市資料來源回應錯誤：${body.msg || "未知錯誤"}`);
  }
  return body.data ?? [];
}
