import type { StockDataProvider } from "./StockDataProvider";
import { FinMindStockDataProvider } from "./FinMindStockDataProvider";

/**
 * Single place that decides which StockDataProvider implementation is
 * active. Quote/history come from FinMind (real TWSE/TPEx data); everything
 * else FinMindStockDataProvider doesn't cover yet still falls back to mock
 * data internally (see its class doc).
 */
export const stockDataProvider: StockDataProvider = new FinMindStockDataProvider();
