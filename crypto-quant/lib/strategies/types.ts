import type { Interval } from "@/lib/market/symbols";
import type { Candle } from "@/lib/market/types";

/**
 * 訊號類型：禁止使用「保證獲利」「一定上漲」等字眼，
 * 一律以「候選訊號」「觀望」「風險升高」表達，強調這只是分析結果而非投資建議。
 */
export type SignalType = "bullish_candidate" | "bearish_candidate" | "watch" | "risk_up";

export const SIGNAL_TYPE_LABEL: Record<SignalType, string> = {
  bullish_candidate: "偏多候選訊號",
  bearish_candidate: "偏空候選訊號",
  watch: "觀望",
  risk_up: "風險升高",
};

export interface FactorContribution {
  factor: string;
  /** 該因子對總分的貢獻（已乘上權重），範圍與總分一致 */
  contribution: number;
  /** 該因子本身未加權的分數，-100 ~ 100 */
  rawScore: number;
  detail: string;
}

export interface StrategySignal {
  /** 觸發訊號的 K 棒開盤時間（epoch ms）；實際成交最早在下一根 K 棒 */
  time: number;
  symbol: string;
  interval: Interval;
  type: SignalType;
  /** 觸發當下的收盤價 */
  price: number;
  reason: string;
  /** 信心分數 0~100，僅供參考，非勝率保證 */
  confidence: number;
  params: Record<string, unknown>;
  contributions?: FactorContribution[];
}

export interface ParamValidationResult {
  valid: boolean;
  errors: string[];
}

export interface StrategyContext {
  symbol: string;
  interval: Interval;
}

export interface Strategy<P extends Record<string, unknown>> {
  id: string;
  name: string;
  description: string;
  defaultParams: P;
  validateParams(params: P): ParamValidationResult;
  /**
   * 產生訊號。實作時只能使用 candles[0..i]（含）的資料計算第 i 根的訊號，
   * 不得使用未來資料（防止未來函數）。
   */
  generateSignals(candles: Candle[], params: P, ctx: StrategyContext): StrategySignal[];
}
