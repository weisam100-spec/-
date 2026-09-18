import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { env } from "@/lib/env";

// 資料存取層使用 SQLite，僅供本機／展示環境使用。
// 所有資料庫操作皆透過下方各 repository 模組的函式進行，
// 未來若要改用 PostgreSQL，只需替換這些函式的實作，呼叫端（API routes）完全不需修改。

let instance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (instance) return instance;

  const dbPath = env.databaseFile;
  const dir = path.dirname(dbPath);
  if (dir && dir !== "." && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  instance = db;
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS strategy_configs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      strategy_id TEXT NOT NULL,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      interval TEXT NOT NULL,
      params_json TEXT NOT NULL,
      backtest_config_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_strategy_configs_workspace ON strategy_configs(workspace_id);

    CREATE TABLE IF NOT EXISTS watchlist_items (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE(workspace_id, symbol)
    );
    CREATE INDEX IF NOT EXISTS idx_watchlist_workspace ON watchlist_items(workspace_id);

    CREATE TABLE IF NOT EXISTS portfolio_cash (
      workspace_id TEXT PRIMARY KEY,
      cash_usdt REAL NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS portfolio_holdings (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      quantity REAL NOT NULL,
      avg_cost_usdt REAL NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(workspace_id, symbol)
    );
    CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_workspace ON portfolio_holdings(workspace_id);

    CREATE TABLE IF NOT EXISTS portfolio_transactions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      quantity REAL NOT NULL,
      price_usdt REAL NOT NULL,
      realized_pnl REAL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_portfolio_tx_workspace ON portfolio_transactions(workspace_id);
  `);
}
