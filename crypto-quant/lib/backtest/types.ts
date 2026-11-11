import type { Candle } from "@/lib/market/types";
import type { StrategySignal } from "@/lib/strategies/types";

/**
 * 交易方向模式：
 * - "long_only"：僅做多，對應現貨實際能做到的事（預設）。
 * - "long_short"：額外模擬放空部位的損益。這是「假設用保證金／合約放空，方向判斷正確或錯誤
 *   各會賺賠多少」的簡化數學模擬，現貨本身無法放空；並未模擬真實保證金交易的借貸成本、
 *   資金費率（funding rate）與強制平倉機制。無論哪種模式，本站都不會真的執行下單或開槓桿。
 */
export type TradeDirection = "long_only" | "long_short";

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

/**
 * 固定風險比例部位（俗稱「1R」）：啟用後會取代 positionSizePct 固定投入比例的算法，
 * 改成「這筆交易最多願意賠掉目前可用資金的 riskPct%」反推部位大小——
 * 部位大小 = (可用資金 × riskPct%) ÷ 停損距離百分比。
 * 必須同時設定 stopLossPct（否則無法反推部位大小，等於沒有風險上限）。
 * 現貨、不開槓桿：反推出來的部位金額若超過目前可用資金，會被限制在可用資金以內，
 * 此時實際承擔的風險會低於 riskPct（而不是用槓桿硬湊出目標風險）。
 */
export interface RiskBasedSizingConfig {
  /** 每筆交易願意承擔的最大虧損，佔目前可用資金的比例（%），必須大於 0 */
  riskPct: number;
}

export interface BacktestConfig {
  initialCapitalUsdt: number;
  /** 單次交易投入資金佔目前可用資金的比例，0~100；啟用 riskBasedSizing 時此欄位會被忽略 */
  positionSizePct: number;
  feeRatePct: number;
  slippageRatePct: number;
  stopLossPct: number | null;
  /** 單一停利比例；與 splitTakeProfit 互斥，啟用分批停利時請將此欄位設為 null */
  takeProfitPct: number | null;
  trailingStopPct: number | null;
  /** 分批停利（TP1/TP2）設定，null 代表不啟用，沿用 takeProfitPct 單一停利 */
  splitTakeProfit: SplitTakeProfitConfig | null;
  /** 固定風險比例部位（1R）設定，null 代表不啟用，沿用 positionSizePct 固定投入比例 */
  riskBasedSizing: RiskBasedSizingConfig | null;
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
  riskBasedSizing: null,
  maxConcurrentPositions: 1,
  direction: "long_only",
  startTime: 0,
  endTime: 0,
};

export interface TradeRecord {
  /** 多單或模擬空單 */
  side: "long" | "short";
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
