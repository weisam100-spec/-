export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `請求失敗（${res.status}）`);
  }
  return res.json() as Promise<T>;
}
