import { randomUUID } from "crypto";
import { getDb } from "./db";

export interface PushSubscriptionRecord {
  id: string;
  workspaceId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface Row {
  id: string;
  workspace_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

function rowToRecord(row: Row): PushSubscriptionRecord {
  return { id: row.id, workspaceId: row.workspace_id, endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth };
}

export function listPushSubscriptions(workspaceId: string): PushSubscriptionRecord[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM push_subscriptions WHERE workspace_id = ?").all(workspaceId) as Row[];
  return rows.map(rowToRecord);
}

export function addPushSubscription(
  workspaceId: string,
  sub: { endpoint: string; p256dh: string; auth: string },
): PushSubscriptionRecord {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM push_subscriptions WHERE endpoint = ?").get(sub.endpoint) as Row | undefined;
  if (existing) return rowToRecord(existing);

  const id = randomUUID();
  db.prepare(
    "INSERT INTO push_subscriptions (id, workspace_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, workspaceId, sub.endpoint, sub.p256dh, sub.auth, Date.now());
  return { id, workspaceId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth };
}

export function removePushSubscription(workspaceId: string, endpoint: string): boolean {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM push_subscriptions WHERE workspace_id = ? AND endpoint = ?")
    .run(workspaceId, endpoint);
  return result.changes > 0;
}

/** 推播失敗（例如訂閱已過期）時由排程端呼叫，清除失效的訂閱 */
export function removePushSubscriptionByEndpoint(endpoint: string): void {
  const db = getDb();
  db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
}
