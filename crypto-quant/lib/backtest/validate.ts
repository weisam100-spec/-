import type { BacktestConfig } from "./types";

export function validateBacktestConfig(config: BacktestConfig): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(config.initialCapitalUsdt) || config.initialCapitalUsdt <= 0) {
    errors.push("初始資金必須大於 0");
  }
  if (!Number.isFinite(config.positionSizePct) || config.positionSizePct <= 0 || config.positionSizePct > 100) {
    errors.push("每次投入比例必須介於 0（不含）至 100 之間");
  }
  if (!Number.isFinite(config.feeRatePct) || config.feeRatePct < 0 || config.feeRatePct > 5) {
    errors.push("手續費率必須介於 0 至 5% 之間");
  }
  if (!Number.isFinite(config.slippageRatePct) || config.slippageRatePct < 0 || config.slippageRatePct > 5) {
    errors.push("滑價必須介於 0 至 5% 之間");
  }
  if (config.stopLossPct !== null && (config.stopLossPct <= 0 || config.stopLossPct >= 100)) {
    errors.push("停損比例必須介於 0（不含）至 100（不含）之間");
  }
  if (config.takeProfitPct !== null && config.takeProfitPct <= 0) {
    errors.push("停利比例必須大於 0");
  }
  if (config.trailingStopPct !== null && (config.trailingStopPct <= 0 || config.trailingStopPct >= 100)) {
    errors.push("移動停損比例必須介於 0（不含）至 100（不含）之間");
  }
  if (config.maxConcurrentPositions !== 1) {
    errors.push("第一版僅支援現貨多頭單一持倉，最大同時持倉數必須為 1");
  }
  if (config.direction !== "long_only") {
    errors.push("第一版僅開放現貨多頭模擬回測");
  }
  if (config.startTime && config.endTime && config.startTime >= config.endTime) {
    errors.push("日期起點不得晚於或等於終點");
  }
  return errors;
}
