import { randomUUID } from "crypto";
import { getDb } from "./db";

export interface WatchlistItem {
  id: string;
  workspaceId: string;
  symbol: string;
  note: string | null;
  createdAt: number;
}

interface Row {
  id: string;
  workspace_id: string;
  symbol: string;
  note: string | null;
  created_at: number;
}

function rowToItem(row: Row): WatchlistItem {
  return { id: row.id, workspaceId: row.workspace_id, symbol: row.symbol, note: row.note, createdAt: row.created_at };
}

export function listWatchlist(workspaceId: string): WatchlistItem[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM watchlist_items WHERE workspace_id = ? ORDER BY created_at ASC")
    .all(workspaceId) as Row[];
  return rows.map(rowToItem);
}

export function addWatchlistItem(workspaceId: string, symbol: string, note?: string): WatchlistItem {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM watchlist_items WHERE workspace_id = ? AND symbol = ?")
    .get(workspaceId, symbol) as Row | undefined;
  if (existing) return rowToItem(existing);

  const id = randomUUID();
  const createdAt = Date.now();
  db.prepare(
    "INSERT INTO watchlist_items (id, workspace_id, symbol, note, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, workspaceId, symbol, note ?? null, createdAt);
  return { id, workspaceId, symbol, note: note ?? null, createdAt };
}

export function removeWatchlistItem(workspaceId: string, id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM watchlist_items WHERE workspace_id = ? AND id = ?").run(workspaceId, id);
  return result.changes > 0;
}
