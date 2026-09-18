// 簡單的行程內 TTL 快取，用來避免對交易所 API 過於頻繁的重複呼叫。
// 正式多執行個體部署時可替換為 Redis，介面維持不變。
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlSeconds: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<{ value: T; hit: boolean }> {
  const existing = cacheGet<T>(key);
  if (existing !== undefined) return { value: existing, hit: true };
  const value = await loader();
  cacheSet(key, value, ttlSeconds);
  return { value, hit: false };
}
