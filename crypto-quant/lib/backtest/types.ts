import type { Candle } from "@/lib/market/types";
import type { StrategySignal } from "@/lib/strategies/types";

/** 第一版僅支援現貨多頭模擬，禁止假裝支援尚未實作的槓桿／合約功能 */
export type TradeDirection = "long_only";

/**
 * 分批停利（TP1/TP2）設定：啟用後會取代單一停利（takeProfitPct）。
 * 進場後價格先漲到 tp1Pct 時，出掉 tp1SizePct% 的部位鎖住部分獲利；
 * 剩餘部位繼續持有，待漲到 tp2Pct 或觸發停損／移動停損／策略出場訊號時才出清剩餘部位。
 */
export interface SplitTakeProfitConfig {
  /** 第一停利目標漲幅（%，相對進場價），必須大於 0 */
  tp1Pct: number;
  /** 第一停利出場比例（%，相對原始進場數量），必須介於 0（不含）至 100 之間 */
  tp1SizePct: number;
  /** 第二停利目標漲幅（%，相對進場價），必須大於 tp1Pct */
  tp2Pct: number;
}

export interface BacktestConfig {
  initialCapitalUsdt: number;
  /** 單次交易投入資金佔目前可用資金的比例，0~100 */
  positionSizePct: number;
  feeRatePct: number;
  slippageRatePct: number;
  stopLossPct: number | null;
  /** 單一停利比例；與 splitTakeProfit 互斥，啟用分批停利時請將此欄位設為 null */
  takeProfitPct: number | null;
  trailingStopPct: number | null;
  /** 分批停利（TP1/TP2）設定，null 代表不啟用，沿用 takeProfitPct 單一停利 */
  splitTakeProfit: SplitTakeProfitConfig | null;
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
  splitTakeProfit: null,
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
  /** 啟用分批停利時，標記這筆紀錄屬於哪一批出場；未啟用分批停利則不會有此欄位 */
  tpStage?: "tp1" | "tp2";
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
