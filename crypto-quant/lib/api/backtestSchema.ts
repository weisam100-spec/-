import { z } from "zod";
import { SUPPORTED_SYMBOL_SET, SUPPORTED_INTERVALS } from "@/lib/market/symbols";
import { strategyRegistry } from "@/lib/strategies/registry";

export const symbolSchema = z.enum([...SUPPORTED_SYMBOL_SET] as [string, ...string[]]);
export const intervalSchema = z.enum(SUPPORTED_INTERVALS as unknown as [string, ...string[]]);
export const strategyIdSchema = z.enum(Object.keys(strategyRegistry) as [string, ...string[]]);

export const backtestConfigSchema = z.object({
  initialCapitalUsdt: z.number().positive().max(1_000_000_000),
  positionSizePct: z.number().positive().max(100),
  feeRatePct: z.number().min(0).max(5),
  slippageRatePct: z.number().min(0).max(5),
  stopLossPct: z.number().positive().max(99).nullable(),
  takeProfitPct: z.number().positive().nullable(),
  trailingStopPct: z.number().positive().max(99).nullable(),
  maxConcurrentPositions: z.literal(1),
  direction: z.literal("long_only"),
  startTime: z.number().int().positive(),
  endTime: z.number().int().positive(),
});

export const backtestRequestSchema = z.object({
  symbol: symbolSchema,
  interval: intervalSchema,
  strategyId: strategyIdSchema,
  strategyParams: z.record(z.string(), z.unknown()),
  config: backtestConfigSchema,
});
