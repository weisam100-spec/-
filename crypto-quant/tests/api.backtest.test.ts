import { describe, it, expect } from "vitest";

process.env.DATA_PROVIDER = "demo";

const { POST } = await import("@/app/api/backtest/run/route");
const { GET: getSymbols } = await import("@/app/api/symbols/route");
const { GET: getStrategies } = await import("@/app/api/strategies/route");

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/backtest/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/symbols", () => {
  it("回傳支援的交易對與週期清單", async () => {
    const res = await getSymbols(new Request("http://localhost/api/symbols") as never, undefined as never);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.symbols.length).toBe(6);
    expect(json.data.intervals.length).toBe(5);
  });
});

describe("GET /api/strategies", () => {
  it("回傳四種第一版策略", async () => {
    const res = await getStrategies(new Request("http://localhost/api/strategies") as never, undefined as never);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.strategies.length).toBe(4);
  });
});

describe("POST /api/backtest/run", () => {
  it("使用 DEMO 資料來源可成功執行 EMA 策略回測並回傳績效指標", async () => {
    const now = Date.now();
    const startTime = now - 60 * 24 * 60 * 60 * 1000;
    const res = await POST(
      makeRequest({
        symbol: "BTCUSDT",
        interval: "1h",
        strategyId: "ema-trend",
        strategyParams: { shortPeriod: 20, longPeriod: 50, confirmClose: true, confirmVolume: false, confirmRsi: false },
        config: {
          initialCapitalUsdt: 100000,
          positionSizePct: 100,
          feeRatePct: 0.1,
          slippageRatePct: 0.05,
          stopLossPct: null,
          takeProfitPct: null,
          trailingStopPct: null,
          maxConcurrentPositions: 1,
          direction: "long_only",
          startTime,
          endTime: now,
        },
      }) as never,
      undefined as never,
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.metrics).toBeDefined();
    expect(json.data.dataSource).toBe("demo");
    expect(typeof json.data.metrics.totalReturnPct).toBe("number");
  });

  it("不支援的交易對會回傳 400 而非假資料", async () => {
    const now = Date.now();
    const res = await POST(
      makeRequest({
        symbol: "DOGEUSDT",
        interval: "1h",
        strategyId: "ema-trend",
        strategyParams: { shortPeriod: 20, longPeriod: 50, confirmClose: true, confirmVolume: false, confirmRsi: false },
        config: {
          initialCapitalUsdt: 100000,
          positionSizePct: 100,
          feeRatePct: 0.1,
          slippageRatePct: 0.05,
          stopLossPct: null,
          takeProfitPct: null,
          trailingStopPct: null,
          maxConcurrentPositions: 1,
          direction: "long_only",
          startTime: now - 1000000,
          endTime: now,
        },
      }) as never,
      undefined as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });

  it("不合法的策略參數（短週期大於長週期）會回傳 400", async () => {
    const now = Date.now();
    const res = await POST(
      makeRequest({
        symbol: "BTCUSDT",
        interval: "1h",
        strategyId: "ema-trend",
        strategyParams: { shortPeriod: 100, longPeriod: 20, confirmClose: true, confirmVolume: false, confirmRsi: false },
        config: {
          initialCapitalUsdt: 100000,
          positionSizePct: 100,
          feeRatePct: 0.1,
          slippageRatePct: 0.05,
          stopLossPct: null,
          takeProfitPct: null,
          trailingStopPct: null,
          maxConcurrentPositions: 1,
          direction: "long_only",
          startTime: now - 60 * 24 * 60 * 60 * 1000,
          endTime: now,
        },
      }) as never,
      undefined as never,
    );
    expect(res.status).toBe(400);
  });

  it("日期起點晚於終點會回傳 400", async () => {
    const now = Date.now();
    const res = await POST(
      makeRequest({
        symbol: "BTCUSDT",
        interval: "1h",
        strategyId: "ema-trend",
        strategyParams: { shortPeriod: 20, longPeriod: 50, confirmClose: true, confirmVolume: false, confirmRsi: false },
        config: {
          initialCapitalUsdt: 100000,
          positionSizePct: 100,
          feeRatePct: 0.1,
          slippageRatePct: 0.05,
          stopLossPct: null,
          takeProfitPct: null,
          trailingStopPct: null,
          maxConcurrentPositions: 1,
          direction: "long_only",
          startTime: now,
          endTime: now - 1000000,
        },
      }) as never,
      undefined as never,
    );
    expect(res.status).toBe(400);
  });
});
