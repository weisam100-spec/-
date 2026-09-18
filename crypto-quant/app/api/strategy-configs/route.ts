import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { backtestConfigSchema, intervalSchema, strategyIdSchema, symbolSchema } from "@/lib/api/backtestSchema";
import { createStrategyConfig, listStrategyConfigs } from "@/lib/storage/strategyConfigRepo";
import { getOrCreateWorkspaceId } from "@/lib/storage/workspace";
import { strategyRegistry } from "@/lib/strategies/registry";
import type { StrategyId } from "@/lib/strategies/registry";

const createSchema = z.object({
  strategyId: strategyIdSchema,
  name: z.string().min(1).max(80),
  symbol: symbolSchema,
  interval: intervalSchema,
  params: z.record(z.string(), z.unknown()),
  backtestConfig: backtestConfigSchema,
});

export const GET = withRateLimit(async () => {
  const workspaceId = await getOrCreateWorkspaceId();
  return apiOk({ configs: listStrategyConfigs(workspaceId) });
});

export const POST = withRateLimit(async (request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("請求內容必須是合法的 JSON", 400, "invalid_json");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("請求參數不合法：" + parsed.error.issues.map((i) => i.message).join("；"), 400, "invalid_params");
  }

  const strategy = strategyRegistry[parsed.data.strategyId as StrategyId];
  const validation = strategy.validateParams(parsed.data.params as never);
  if (!validation.valid) {
    return apiError("策略參數不合法：" + validation.errors.join("；"), 400, "invalid_strategy_params");
  }

  const workspaceId = await getOrCreateWorkspaceId();
  const created = createStrategyConfig(workspaceId, {
    strategyId: parsed.data.strategyId as StrategyId,
    name: parsed.data.name,
    symbol: parsed.data.symbol,
    interval: parsed.data.interval as never,
    params: parsed.data.params,
    backtestConfig: parsed.data.backtestConfig,
  });
  return apiOk({ config: created }, 201);
});
