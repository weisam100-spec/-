import { describe, it, expect } from "vitest";

process.env.DATA_PROVIDER = "demo";

const { GET } = await import("@/app/api/market/long-short-ratio/route");

function makeRequest(query: string) {
  return new Request(`http://localhost/api/market/long-short-ratio?${query}`);
}

describe("GET /api/market/long-short-ratio", () => {
  it("使用 DEMO 資料來源可成功取得大戶多空持倉比", async () => {
    const res = await GET(
      makeRequest("symbol=BTCUSDT&period=1h&limit=10") as never,
      undefined as never,
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.data.length).toBe(10);
    expect(json.data.freshness).toBe("demo");
  });

  it("不支援的交易對會回傳 400", async () => {
    const res = await GET(
      makeRequest("symbol=DOGEUSDT&period=1h") as never,
      undefined as never,
    );
    expect(res.status).toBe(400);
  });

  it("不合法的 period 會回傳 400", async () => {
    const res = await GET(
      makeRequest("symbol=BTCUSDT&period=2h") as never,
      undefined as never,
    );
    expect(res.status).toBe(400);
  });

  it("缺少必填參數會回傳 400", async () => {
    const res = await GET(makeRequest("symbol=BTCUSDT") as never, undefined as never);
    expect(res.status).toBe(400);
  });
});
