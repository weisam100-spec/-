// 前端統一 API 呼叫工具，會將後端標準化的 { ok, data } / { ok:false, error } 格式
// 轉換為成功回傳資料、失敗拋出帶有中文訊息的 Error，方便畫面顯示友善錯誤提示。

interface ApiOk<T> {
  ok: true;
  data: T;
}
interface ApiErr {
  ok: false;
  error: { message: string; code?: string };
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function parse<T>(res: Response): Promise<T> {
  let body: ApiOk<T> | ApiErr;
  try {
    body = await res.json();
  } catch {
    throw new ApiRequestError("伺服器回應格式錯誤，請稍後再試", "bad_response", res.status);
  }
  if (!body.ok) {
    throw new ApiRequestError(body.error.message, body.error.code, res.status);
  }
  return body.data;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: "GET" });
  return parse<T>(res);
}

export async function apiPost<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parse<T>(res);
}

export async function apiPatch<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parse<T>(res);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: "DELETE" });
  return parse<T>(res);
}
