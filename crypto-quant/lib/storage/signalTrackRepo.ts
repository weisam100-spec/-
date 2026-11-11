import { randomUUID } from "crypto";
import { getDb } from "./db";
import type { StrategyId } from "@/lib/strategies/registry";
import type { Interval } from "@/lib/market/symbols";
import type { SignalType } from "@/lib/strategies/types";

export type SignalTrackStatus = "pending" | "hit_stop" | "hit_rr2" | "hit_rr3" | "no_result";

export interface SignalTrackRecord {
  id: string;
  workspaceId: string;
  strategyConfigId: string;
  strategyId: StrategyId;
  configName: string;
  symbol: string;
  interval: Interval;
  signalTime: number;
  signalType: SignalType;
  entryPrice: number;
  confidence: number;
  reason: string;
  stopPrice: number | null;
  rr2Price: number | null;
  rr3Price: number | null;
  status: SignalTrackStatus;
  resolvedAt: number | null;
  resolvedPrice: number | null;
  createdAt: number;
}

interface Row {
  id: string;
  workspace_id: string;
  strategy_config_id: string;
  strategy_id: string;
  config_name: string;
  symbol: string;
  interval: string;
  signal_time: number;
  signal_type: string;
  entry_price: number;
  confidence: number;
  reason: string;
  stop_price: number | null;
  rr2_price: number | null;
  rr3_price: number | null;
  status: string;
  resolved_at: number | null;
  resolved_price: number | null;
  created_at: number;
}

function rowToRecord(row: Row): SignalTrackRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    strategyConfigId: row.strategy_config_id,
    strategyId: row.strategy_id as StrategyId,
    configName: row.config_name,
    symbol: row.symbol,
    interval: row.interval as Interval,
    signalTime: row.signal_time,
    signalType: row.signal_type as SignalType,
    entryPrice: row.entry_price,
    confidence: row.confidence,
    reason: row.reason,
    stopPrice: row.stop_price,
    rr2Price: row.rr2_price,
    rr3Price: row.rr3_price,
    status: row.status as SignalTrackStatus,
    resolvedAt: row.resolved_at,
    resolvedPrice: row.resolved_price,
    createdAt: row.created_at,
  };
}

/**
 * 記錄一筆「即時」訊號（排程偵測到的新訊號，非回測）以供日後追蹤後續走勢。
 * 同一組策略設定、同一個訊號時間只會記錄一次（UNIQUE 約束），重複呼叫會被忽略。
 */
export function recordSignalTrack(input: {
  workspaceId: string;
  strategyConfigId: string;
  strategyId: StrategyId;
  configName: string;
  symbol: string;
  interval: Interval;
  signalTime: number;
  signalType: SignalType;
  entryPrice: number;
  confidence: number;
  reason: string;
  stopPrice: number | null;
  rr2Price: number | null;
  rr3Price: number | null;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO signal_track_records
      (id, workspace_id, strategy_config_id, strategy_id, config_name, symbol, interval, signal_time, signal_type, entry_price, confidence, reason, stop_price, rr2_price, rr3_price, status, resolved_at, resolved_price, created_at)
     VALUES
      (@id, @workspaceId, @strategyConfigId, @strategyId, @configName, @symbol, @interval, @signalTime, @signalType, @entryPrice, @confidence, @reason, @stopPrice, @rr2Price, @rr3Price, 'pending', NULL, NULL, @createdAt)`,
  ).run({
    id: randomUUID(),
    workspaceId: input.workspaceId,
    strategyConfigId: input.strategyConfigId,
    strategyId: input.strategyId,
    configName: input.configName,
    symbol: input.symbol,
    interval: input.interval,
    signalTime: input.signalTime,
    signalType: input.signalType,
    entryPrice: input.entryPrice,
    confidence: input.confidence,
    reason: input.reason,
    stopPrice: input.stopPrice,
    rr2Price: input.rr2Price,
    rr3Price: input.rr3Price,
    createdAt: Date.now(),
  });
}

/** 列出所有工作區中仍待確認結果的追蹤紀錄，供背景排程掃描使用（不分工作區） */
export function listPendingSignalTracks(): SignalTrackRecord[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM signal_track_records WHERE status = 'pending'").all() as Row[];
  return rows.map(rowToRecord);
}

export function resolveSignalTrack(
  id: string,
  status: Exclude<SignalTrackStatus, "pending">,
  resolvedAt: number,
  resolvedPrice: number,
): void {
  const db = getDb();
  db.prepare("UPDATE signal_track_records SET status = ?, resolved_at = ?, resolved_price = ? WHERE id = ?").run(
    status,
    resolvedAt,
    resolvedPrice,
    id,
  );
}

export function listSignalTracks(workspaceId: string, limit = 200): SignalTrackRecord[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM signal_track_records WHERE workspace_id = ? ORDER BY signal_time DESC LIMIT ?")
    .all(workspaceId, limit) as Row[];
  return rows.map(rowToRecord);
}
