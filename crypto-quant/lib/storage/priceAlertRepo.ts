import { randomUUID } from "crypto";
import { getDb } from "./db";

export type PriceAlertDirection = "both" | "up" | "down";

export interface PriceAlertRule {
  id: string;
  workspaceId: string;
  symbol: string;
  /** 觸發門檻：在 windowMinutes 分鐘內的漲跌幅達到這個百分比（絕對值）就觸發 */
  thresholdPct: number;
  windowMinutes: number;
  direction: PriceAlertDirection;
  enabled: boolean;
  /** 最近一次觸發時間，用於冷卻期判斷，避免同一波動重複通知 */
  lastTriggeredAt: number | null;
  createdAt: number;
}

interface Row {
  id: string;
  workspace_id: string;
  symbol: string;
  threshold_pct: number;
  window_minutes: number;
  direction: string;
  enabled: number;
  last_triggered_at: number | null;
  created_at: number;
}

function rowToRule(row: Row): PriceAlertRule {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    symbol: row.symbol,
    thresholdPct: row.threshold_pct,
    windowMinutes: row.window_minutes,
    direction: row.direction as PriceAlertDirection,
    enabled: Boolean(row.enabled),
    lastTriggeredAt: row.last_triggered_at,
    createdAt: row.created_at,
  };
}

export function listPriceAlertRules(workspaceId: string): PriceAlertRule[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM price_alert_rules WHERE workspace_id = ? ORDER BY created_at DESC")
    .all(workspaceId) as Row[];
  return rows.map(rowToRule);
}

export function createPriceAlertRule(
  workspaceId: string,
  input: { symbol: string; thresholdPct: number; windowMinutes: number; direction: PriceAlertDirection },
): PriceAlertRule {
  const db = getDb();
  const id = randomUUID();
  const createdAt = Date.now();
  db.prepare(
    `INSERT INTO price_alert_rules (id, workspace_id, symbol, threshold_pct, window_minutes, direction, enabled, last_triggered_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, NULL, ?)`,
  ).run(id, workspaceId, input.symbol, input.thresholdPct, input.windowMinutes, input.direction, createdAt);
  return {
    id,
    workspaceId,
    symbol: input.symbol,
    thresholdPct: input.thresholdPct,
    windowMinutes: input.windowMinutes,
    direction: input.direction,
    enabled: true,
    lastTriggeredAt: null,
    createdAt,
  };
}

export function setPriceAlertRuleEnabled(workspaceId: string, id: string, enabled: boolean): boolean {
  const db = getDb();
  const result = db
    .prepare("UPDATE price_alert_rules SET enabled = ? WHERE workspace_id = ? AND id = ?")
    .run(enabled ? 1 : 0, workspaceId, id);
  return result.changes > 0;
}

export function deletePriceAlertRule(workspaceId: string, id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM price_alert_rules WHERE workspace_id = ? AND id = ?").run(workspaceId, id);
  return result.changes > 0;
}

/** 列出所有工作區中已啟用的規則，供背景排程掃描使用（不分工作區） */
export function listEnabledPriceAlertRules(): PriceAlertRule[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM price_alert_rules WHERE enabled = 1").all() as Row[];
  return rows.map(rowToRule);
}

export function markPriceAlertTriggered(id: string, triggeredAt: number): void {
  const db = getDb();
  db.prepare("UPDATE price_alert_rules SET last_triggered_at = ? WHERE id = ?").run(triggeredAt, id);
}
