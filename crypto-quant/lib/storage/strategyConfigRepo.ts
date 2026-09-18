import { randomUUID } from "crypto";
import { getDb } from "./db";
import type { StrategyId } from "@/lib/strategies/registry";
import type { Interval } from "@/lib/market/symbols";
import type { BacktestConfig } from "@/lib/backtest/types";

export interface StrategyConfigRecord {
  id: string;
  workspaceId: string;
  strategyId: StrategyId;
  name: string;
  symbol: string;
  interval: Interval;
  params: Record<string, unknown>;
  backtestConfig: BacktestConfig;
  createdAt: number;
  updatedAt: number;
}

interface Row {
  id: string;
  workspace_id: string;
  strategy_id: string;
  name: string;
  symbol: string;
  interval: string;
  params_json: string;
  backtest_config_json: string;
  created_at: number;
  updated_at: number;
}

function rowToRecord(row: Row): StrategyConfigRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    strategyId: row.strategy_id as StrategyId,
    name: row.name,
    symbol: row.symbol,
    interval: row.interval as Interval,
    params: JSON.parse(row.params_json),
    backtestConfig: JSON.parse(row.backtest_config_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listStrategyConfigs(workspaceId: string): StrategyConfigRecord[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM strategy_configs WHERE workspace_id = ? ORDER BY updated_at DESC")
    .all(workspaceId) as Row[];
  return rows.map(rowToRecord);
}

export function getStrategyConfig(workspaceId: string, id: string): StrategyConfigRecord | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM strategy_configs WHERE workspace_id = ? AND id = ?")
    .get(workspaceId, id) as Row | undefined;
  return row ? rowToRecord(row) : null;
}

export function createStrategyConfig(
  workspaceId: string,
  input: Pick<StrategyConfigRecord, "strategyId" | "name" | "symbol" | "interval" | "params" | "backtestConfig">,
): StrategyConfigRecord {
  const db = getDb();
  const now = Date.now();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO strategy_configs (id, workspace_id, strategy_id, name, symbol, interval, params_json, backtest_config_json, created_at, updated_at)
     VALUES (@id, @workspaceId, @strategyId, @name, @symbol, @interval, @paramsJson, @backtestConfigJson, @createdAt, @updatedAt)`,
  ).run({
    id,
    workspaceId,
    strategyId: input.strategyId,
    name: input.name,
    symbol: input.symbol,
    interval: input.interval,
    paramsJson: JSON.stringify(input.params),
    backtestConfigJson: JSON.stringify(input.backtestConfig),
    createdAt: now,
    updatedAt: now,
  });
  return getStrategyConfig(workspaceId, id)!;
}

export function updateStrategyConfig(
  workspaceId: string,
  id: string,
  patch: Partial<Pick<StrategyConfigRecord, "name" | "params" | "backtestConfig" | "symbol" | "interval">>,
): StrategyConfigRecord | null {
  const existing = getStrategyConfig(workspaceId, id);
  if (!existing) return null;
  const db = getDb();
  const merged = { ...existing, ...patch };
  db.prepare(
    `UPDATE strategy_configs SET name=@name, symbol=@symbol, interval=@interval, params_json=@paramsJson, backtest_config_json=@backtestConfigJson, updated_at=@updatedAt
     WHERE workspace_id=@workspaceId AND id=@id`,
  ).run({
    id,
    workspaceId,
    name: merged.name,
    symbol: merged.symbol,
    interval: merged.interval,
    paramsJson: JSON.stringify(merged.params),
    backtestConfigJson: JSON.stringify(merged.backtestConfig),
    updatedAt: Date.now(),
  });
  return getStrategyConfig(workspaceId, id);
}

export function duplicateStrategyConfig(workspaceId: string, id: string): StrategyConfigRecord | null {
  const existing = getStrategyConfig(workspaceId, id);
  if (!existing) return null;
  return createStrategyConfig(workspaceId, {
    strategyId: existing.strategyId,
    name: `${existing.name}（複製）`,
    symbol: existing.symbol,
    interval: existing.interval,
    params: existing.params,
    backtestConfig: existing.backtestConfig,
  });
}

export function deleteStrategyConfig(workspaceId: string, id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM strategy_configs WHERE workspace_id = ? AND id = ?").run(workspaceId, id);
  return result.changes > 0;
}
