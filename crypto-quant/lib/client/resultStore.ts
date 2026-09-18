"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { BacktestRunResponse, CompareEntry } from "./hooks";
import type { Interval } from "@/lib/market/symbols";
import type { StrategyId } from "@/lib/strategies/registry";

export interface LastBacktestRun {
  symbol: string;
  interval: Interval;
  strategyId: StrategyId;
  strategyName: string;
  strategyParams: Record<string, unknown>;
  runAt: number;
  response: BacktestRunResponse;
}

export interface LastCompareRun {
  symbol: string;
  interval: Interval;
  runAt: number;
  comparisons: CompareEntry[];
  disclaimer: string;
}

interface ResultState {
  lastBacktest: LastBacktestRun | null;
  lastCompare: LastCompareRun | null;
  setLastBacktest: (run: LastBacktestRun) => void;
  setLastCompare: (run: LastCompareRun) => void;
}

/**
 * 回測 / 比較結果為單次執行的展示用資料，暫存於瀏覽器 sessionStorage，
 * 讓使用者從「策略設定頁」導向「回測結果頁」時仍可看到結果；重新整理分頁或關閉分頁後即清除。
 * 正式資料（策略設定、觀察清單、模擬投資組合）皆儲存於伺服器端資料庫，不受此影響。
 */
export const useResultStore = create<ResultState>()(
  persist(
    (set) => ({
      lastBacktest: null,
      lastCompare: null,
      setLastBacktest: (run) => set({ lastBacktest: run }),
      setLastCompare: (run) => set({ lastCompare: run }),
    }),
    {
      name: "cq-result-store",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
