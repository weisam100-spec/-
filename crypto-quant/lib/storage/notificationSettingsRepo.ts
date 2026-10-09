import { getDb } from "./db";

export interface NotificationSettings {
  workspaceId: string;
  telegramEnabled: boolean;
  telegramChatId: string | null;
  emailEnabled: boolean;
  emailAddress: string | null;
  pushEnabled: boolean;
}

interface Row {
  workspace_id: string;
  telegram_enabled: number;
  telegram_chat_id: string | null;
  email_enabled: number;
  email_address: string | null;
  push_enabled: number;
}

function rowToSettings(row: Row): NotificationSettings {
  return {
    workspaceId: row.workspace_id,
    telegramEnabled: Boolean(row.telegram_enabled),
    telegramChatId: row.telegram_chat_id,
    emailEnabled: Boolean(row.email_enabled),
    emailAddress: row.email_address,
    pushEnabled: Boolean(row.push_enabled),
  };
}

const DEFAULTS: Omit<NotificationSettings, "workspaceId"> = {
  telegramEnabled: false,
  telegramChatId: null,
  emailEnabled: false,
  emailAddress: null,
  pushEnabled: false,
};

export function getNotificationSettings(workspaceId: string): NotificationSettings {
  const db = getDb();
  const row = db.prepare("SELECT * FROM notification_settings WHERE workspace_id = ?").get(workspaceId) as
    | Row
    | undefined;
  if (!row) return { workspaceId, ...DEFAULTS };
  return rowToSettings(row);
}

export function updateNotificationSettings(
  workspaceId: string,
  patch: Partial<Omit<NotificationSettings, "workspaceId">>,
): NotificationSettings {
  const db = getDb();
  const current = getNotificationSettings(workspaceId);
  const merged = { ...current, ...patch };
  const now = Date.now();
  db.prepare(
    `INSERT INTO notification_settings (workspace_id, telegram_enabled, telegram_chat_id, email_enabled, email_address, push_enabled, updated_at)
     VALUES (@workspaceId, @telegramEnabled, @telegramChatId, @emailEnabled, @emailAddress, @pushEnabled, @updatedAt)
     ON CONFLICT(workspace_id) DO UPDATE SET
       telegram_enabled=excluded.telegram_enabled,
       telegram_chat_id=excluded.telegram_chat_id,
       email_enabled=excluded.email_enabled,
       email_address=excluded.email_address,
       push_enabled=excluded.push_enabled,
       updated_at=excluded.updated_at`,
  ).run({
    workspaceId,
    telegramEnabled: merged.telegramEnabled ? 1 : 0,
    telegramChatId: merged.telegramChatId,
    emailEnabled: merged.emailEnabled ? 1 : 0,
    emailAddress: merged.emailAddress,
    pushEnabled: merged.pushEnabled ? 1 : 0,
    updatedAt: now,
  });
  return getNotificationSettings(workspaceId);
}

/** 列出所有已啟用至少一種通知管道的工作區設定，供背景排程掃描使用 */
export function listActiveNotificationSettings(): NotificationSettings[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM notification_settings WHERE telegram_enabled = 1 OR email_enabled = 1 OR push_enabled = 1")
    .all() as Row[];
  return rows.map(rowToSettings);
}
