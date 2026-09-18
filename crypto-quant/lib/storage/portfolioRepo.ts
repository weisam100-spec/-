import { randomUUID } from "crypto";
import { getDb } from "./db";

const DEFAULT_INITIAL_CASH = 100_000;

export interface Holding {
  id: string;
  symbol: string;
  quantity: number;
  avgCostUsdt: number;
}

export interface PortfolioSnapshot {
  workspaceId: string;
  cashUsdt: number;
  holdings: Holding[];
  totalRealizedPnlUsdt: number;
}

interface HoldingRow {
  id: string;
  workspace_id: string;
  symbol: string;
  quantity: number;
  avg_cost_usdt: number;
}

function ensureCashRow(workspaceId: string): number {
  const db = getDb();
  const row = db.prepare("SELECT cash_usdt FROM portfolio_cash WHERE workspace_id = ?").get(workspaceId) as
    | { cash_usdt: number }
    | undefined;
  if (row) return row.cash_usdt;
  db.prepare("INSERT INTO portfolio_cash (workspace_id, cash_usdt, updated_at) VALUES (?, ?, ?)").run(
    workspaceId,
    DEFAULT_INITIAL_CASH,
    Date.now(),
  );
  return DEFAULT_INITIAL_CASH;
}

export function getPortfolio(workspaceId: string): PortfolioSnapshot {
  const db = getDb();
  const cashUsdt = ensureCashRow(workspaceId);
  const rows = db
    .prepare("SELECT * FROM portfolio_holdings WHERE workspace_id = ? ORDER BY symbol ASC")
    .all(workspaceId) as HoldingRow[];
  const holdings = rows
    .filter((r) => r.quantity > 0)
    .map((r) => ({ id: r.id, symbol: r.symbol, quantity: r.quantity, avgCostUsdt: r.avg_cost_usdt }));
  const realizedRow = db
    .prepare("SELECT COALESCE(SUM(realized_pnl), 0) as total FROM portfolio_transactions WHERE workspace_id = ? AND side = 'sell'")
    .get(workspaceId) as { total: number };
  return { workspaceId, cashUsdt, holdings, totalRealizedPnlUsdt: realizedRow.total };
}

export function resetPortfolio(workspaceId: string, initialCashUsdt = DEFAULT_INITIAL_CASH): PortfolioSnapshot {
  const db = getDb();
  const now = Date.now();
  db.prepare("DELETE FROM portfolio_holdings WHERE workspace_id = ?").run(workspaceId);
  db.prepare("DELETE FROM portfolio_transactions WHERE workspace_id = ?").run(workspaceId);
  db.prepare(
    "INSERT INTO portfolio_cash (workspace_id, cash_usdt, updated_at) VALUES (?, ?, ?) ON CONFLICT(workspace_id) DO UPDATE SET cash_usdt=excluded.cash_usdt, updated_at=excluded.updated_at",
  ).run(workspaceId, initialCashUsdt, now);
  return getPortfolio(workspaceId);
}

export interface TradeResult {
  ok: boolean;
  error?: string;
  portfolio?: PortfolioSnapshot;
}

/** 模擬買進（紙上交易，不會連接真實交易所） */
export function paperBuy(workspaceId: string, symbol: string, quantity: number, priceUsdt: number): TradeResult {
  if (quantity <= 0 || priceUsdt <= 0) return { ok: false, error: "數量與價格必須大於 0" };
  const db = getDb();
  const cashUsdt = ensureCashRow(workspaceId);
  const cost = quantity * priceUsdt;
  if (cost > cashUsdt) return { ok: false, error: "現金餘額不足，無法完成模擬買進" };

  const now = Date.now();
  const existing = db
    .prepare("SELECT * FROM portfolio_holdings WHERE workspace_id = ? AND symbol = ?")
    .get(workspaceId, symbol) as HoldingRow | undefined;

  const tx = db.transaction(() => {
    if (existing) {
      const newQuantity = existing.quantity + quantity;
      const newAvgCost = (existing.quantity * existing.avg_cost_usdt + cost) / newQuantity;
      db.prepare(
        "UPDATE portfolio_holdings SET quantity=?, avg_cost_usdt=?, updated_at=? WHERE id=?",
      ).run(newQuantity, newAvgCost, now, existing.id);
    } else {
      db.prepare(
        "INSERT INTO portfolio_holdings (id, workspace_id, symbol, quantity, avg_cost_usdt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run(randomUUID(), workspaceId, symbol, quantity, priceUsdt, now, now);
    }
    db.prepare("UPDATE portfolio_cash SET cash_usdt = cash_usdt - ?, updated_at=? WHERE workspace_id=?").run(
      cost,
      now,
      workspaceId,
    );
    db.prepare(
      "INSERT INTO portfolio_transactions (id, workspace_id, symbol, side, quantity, price_usdt, created_at) VALUES (?, ?, ?, 'buy', ?, ?, ?)",
    ).run(randomUUID(), workspaceId, symbol, quantity, priceUsdt, now);
  });
  tx();

  return { ok: true, portfolio: getPortfolio(workspaceId) };
}

/** 模擬賣出（紙上交易，不會連接真實交易所） */
export function paperSell(workspaceId: string, symbol: string, quantity: number, priceUsdt: number): TradeResult {
  if (quantity <= 0 || priceUsdt <= 0) return { ok: false, error: "數量與價格必須大於 0" };
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM portfolio_holdings WHERE workspace_id = ? AND symbol = ?")
    .get(workspaceId, symbol) as HoldingRow | undefined;
  if (!existing || existing.quantity < quantity) {
    return { ok: false, error: "持有數量不足，無法完成模擬賣出" };
  }

  const now = Date.now();
  const proceeds = quantity * priceUsdt;
  const remaining = existing.quantity - quantity;
  const realizedPnl = (priceUsdt - existing.avg_cost_usdt) * quantity;

  const tx = db.transaction(() => {
    if (remaining <= 1e-12) {
      db.prepare("DELETE FROM portfolio_holdings WHERE id = ?").run(existing.id);
    } else {
      db.prepare("UPDATE portfolio_holdings SET quantity=?, updated_at=? WHERE id=?").run(remaining, now, existing.id);
    }
    ensureCashRow(workspaceId);
    db.prepare("UPDATE portfolio_cash SET cash_usdt = cash_usdt + ?, updated_at=? WHERE workspace_id=?").run(
      proceeds,
      now,
      workspaceId,
    );
    db.prepare(
      "INSERT INTO portfolio_transactions (id, workspace_id, symbol, side, quantity, price_usdt, realized_pnl, created_at) VALUES (?, ?, ?, 'sell', ?, ?, ?, ?)",
    ).run(randomUUID(), workspaceId, symbol, quantity, priceUsdt, realizedPnl, now);
  });
  tx();

  return { ok: true, portfolio: getPortfolio(workspaceId) };
}
