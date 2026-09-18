import type { Candle } from "@/lib/market/types";
import type { StrategySignal } from "@/lib/strategies/types";

/** 第一版僅支援現貨多頭模擬，禁止假裝支援尚未實作的槓桿／合約功能 */
export type TradeDirection = "long_only";

export interface BacktestConfig {
  initialCapitalUsdt: number;
  /** 單次交易投入資金佔目前可用資金的比例，0~100 */
  positionSizePct: number;
  feeRatePct: number;
  slippageRatePct: number;
  stopLossPct: number | null;
  takeProfitPct: number | null;
  trailingStopPct: number | null;
  maxConcurrentPositions: number;
  direction: TradeDirection;
  startTime: number;
  endTime: number;
}

export const defaultBacktestConfig: BacktestConfig = {
  initialCapitalUsdt: 100_000,
  positionSizePct: 100,
  feeRatePct: 0.1,
  slippageRatePct: 0.05,
  stopLossPct: null,
  takeProfitPct: null,
  trailingStopPct: null,
  maxConcurrentPositions: 1,
  direction: "long_only",
  startTime: 0,
  endTime: 0,
};

export interface TradeRecord {
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  quantity: number;
  entryFee: number;
  exitFee: number;
  totalCost: number;
  pnl: number;
  pnlBeforeCost: number;
  returnPct: number;
  holdingMs: number;
  entryReason: string;
  exitReason: string;
  paramsSnapshot: Record<string, unknown>;
}

export interface EquityPoint {
  time: number;
  equity: number;
  buyHoldEquity: number;
  inPosition: boolean;
}

export interface BacktestWarning {
  code: string;
  message: string;
}

export interface BacktestResult {
  trades: TradeRecord[];
  equityCurve: EquityPoint[];
  warnings: BacktestWarning[];
  config: BacktestConfig;
  usedCandles: number;
  firstTradableTime: number | null;
  lastTime: number | null;
}

export interface RunBacktestInput {
  candles: Candle[];
  signals: StrategySignal[];
  config: BacktestConfig;
}
