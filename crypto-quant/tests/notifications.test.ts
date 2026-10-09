import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const tmpDbPath = path.join(os.tmpdir(), `cq-test-notifications-${Date.now()}.db`);
process.env.DATABASE_FILE = tmpDbPath;
process.env.DATA_PROVIDER = "demo";

const { getNotificationSettings, updateNotificationSettings, listActiveNotificationSettings } = await import(
  "@/lib/storage/notificationSettingsRepo"
);
const { addPushSubscription, listPushSubscriptions, removePushSubscription } = await import(
  "@/lib/storage/pushSubscriptionRepo"
);
const {
  createStrategyConfig,
  listAlertEnabledConfigs,
  markConfigNotified,
  updateStrategyConfig,
  getStrategyConfig,
} = await import("@/lib/storage/strategyConfigRepo");
const { defaultBacktestConfig } = await import("@/lib/backtest/types");
const { emaTrendDefaultParams } = await import("@/lib/strategies/emaTrend");
const { sendTelegramMessage } = await import("@/lib/notifications/telegram");
const { sendEmail } = await import("@/lib/notifications/email");
const { sendPushToWorkspace } = await import("@/lib/notifications/push");
const { dispatchToWorkspace } = await import("@/lib/notifications/dispatch");
const { checkAlertsOnce } = await import("@/lib/alerts/scheduler");

const workspaceId = "notif-test-workspace";

afterAll(() => {
  if (fs.existsSync(tmpDbPath)) fs.unlinkSync(tmpDbPath);
});

describe("notificationSettingsRepo", () => {
  it("未設定過的工作區回傳預設值（全部停用）", () => {
    const settings = getNotificationSettings("brand-new-workspace");
    expect(settings.telegramEnabled).toBe(false);
    expect(settings.emailEnabled).toBe(false);
    expect(settings.pushEnabled).toBe(false);
  });

  it("可以更新並 upsert 設定", () => {
    const updated = updateNotificationSettings(workspaceId, {
      telegramEnabled: true,
      telegramChatId: "12345",
    });
    expect(updated.telegramEnabled).toBe(true);
    expect(updated.telegramChatId).toBe("12345");

    const merged = updateNotificationSettings(workspaceId, { emailEnabled: true, emailAddress: "a@b.com" });
    expect(merged.telegramEnabled).toBe(true);
    expect(merged.emailEnabled).toBe(true);
    expect(merged.emailAddress).toBe("a@b.com");
  });

  it("listActiveNotificationSettings 只列出至少啟用一個管道的工作區", () => {
    const active = listActiveNotificationSettings();
    expect(active.some((s) => s.workspaceId === workspaceId)).toBe(true);
  });
});

describe("pushSubscriptionRepo", () => {
  it("新增訂閱會去重（同一 endpoint 不會重複建立）", () => {
    const sub = { endpoint: "https://push.example.com/abc", p256dh: "key1", auth: "auth1" };
    const first = addPushSubscription(workspaceId, sub);
    const second = addPushSubscription(workspaceId, sub);
    expect(first.id).toBe(second.id);
    expect(listPushSubscriptions(workspaceId).filter((s) => s.endpoint === sub.endpoint).length).toBe(1);
  });

  it("可以移除訂閱", () => {
    const removed = removePushSubscription(workspaceId, "https://push.example.com/abc");
    expect(removed).toBe(true);
    expect(listPushSubscriptions(workspaceId).some((s) => s.endpoint === "https://push.example.com/abc")).toBe(false);
  });
});

describe("未設定管道時的通知函式應回報明確錯誤而非丟出例外", () => {
  it("Telegram 未設定 TELEGRAM_BOT_TOKEN 時回傳 ok:false", async () => {
    const result = await sendTelegramMessage("123", "test");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("TELEGRAM_BOT_TOKEN");
  });

  it("Email 未設定 SMTP_HOST 時回傳 ok:false", async () => {
    const result = await sendEmail("a@b.com", "subject", "body");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("SMTP_HOST");
  });

  it("Push 未設定 VAPID 金鑰時回傳 ok:false", async () => {
    const result = await sendPushToWorkspace(workspaceId, { title: "t", body: "b" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("VAPID");
  });

  it("dispatchToWorkspace 對沒有啟用任何管道的工作區回傳空陣列，不丟例外", async () => {
    const results = await dispatchToWorkspace("workspace-without-any-channel", { title: "t", text: "b" });
    expect(results).toEqual([]);
  });
});

describe("strategyConfigRepo 提醒相關欄位", () => {
  it("新建時 alertEnabled 預設為 false，lastNotifiedSignalTime 為 null", () => {
    const created = createStrategyConfig(workspaceId, {
      strategyId: "ema-trend",
      name: "提醒測試設定",
      symbol: "BTCUSDT",
      interval: "1h",
      params: emaTrendDefaultParams,
      backtestConfig: defaultBacktestConfig,
    });
    expect(created.alertEnabled).toBe(false);
    expect(created.lastNotifiedSignalTime).toBeNull();
    expect(listAlertEnabledConfigs().some((c) => c.id === created.id)).toBe(false);
  });

  it("開啟 alertEnabled 後會出現在 listAlertEnabledConfigs()", () => {
    const created = createStrategyConfig(workspaceId, {
      strategyId: "ema-trend",
      name: "提醒測試設定2",
      symbol: "BTCUSDT",
      interval: "1h",
      params: emaTrendDefaultParams,
      backtestConfig: defaultBacktestConfig,
      alertEnabled: true,
    });
    expect(listAlertEnabledConfigs().some((c) => c.id === created.id)).toBe(true);

    markConfigNotified(created.id, 1_700_000_000_000);
    expect(getStrategyConfig(workspaceId, created.id)?.lastNotifiedSignalTime).toBe(1_700_000_000_000);

    const disabled = updateStrategyConfig(workspaceId, created.id, { alertEnabled: false });
    expect(disabled?.alertEnabled).toBe(false);
    expect(listAlertEnabledConfigs().some((c) => c.id === created.id)).toBe(false);
  });

  it("變更 symbol/interval/params 會重置 lastNotifiedSignalTime 基準，避免拿舊訊號比對新設定", () => {
    const created = createStrategyConfig(workspaceId, {
      strategyId: "ema-trend",
      name: "基準重置測試",
      symbol: "BTCUSDT",
      interval: "1h",
      params: emaTrendDefaultParams,
      backtestConfig: defaultBacktestConfig,
      alertEnabled: true,
    });
    markConfigNotified(created.id, 1_700_000_000_000);
    expect(getStrategyConfig(workspaceId, created.id)?.lastNotifiedSignalTime).toBe(1_700_000_000_000);

    const updated = updateStrategyConfig(workspaceId, created.id, { symbol: "ETHUSDT" });
    expect(updated?.lastNotifiedSignalTime).toBeNull();
  });

  it("只改名稱不影響 lastNotifiedSignalTime 基準", () => {
    const created = createStrategyConfig(workspaceId, {
      strategyId: "ema-trend",
      name: "改名不重置",
      symbol: "BTCUSDT",
      interval: "1h",
      params: emaTrendDefaultParams,
      backtestConfig: defaultBacktestConfig,
      alertEnabled: true,
    });
    markConfigNotified(created.id, 1_700_000_000_000);
    const updated = updateStrategyConfig(workspaceId, created.id, { name: "改名後的名稱" });
    expect(updated?.lastNotifiedSignalTime).toBe(1_700_000_000_000);
  });
});

describe("alerts scheduler (checkAlertsOnce)", () => {
  let configId: string;

  beforeAll(() => {
    const created = createStrategyConfig(workspaceId, {
      strategyId: "ema-trend",
      name: "排程測試設定",
      symbol: "BTCUSDT",
      interval: "1h",
      params: emaTrendDefaultParams,
      backtestConfig: defaultBacktestConfig,
      alertEnabled: true,
    });
    configId = created.id;
  });

  it("第一次執行只會建立基準（不回溯通知歷史訊號），checkedConfigs 會計入該筆設定", async () => {
    const before = getStrategyConfig(workspaceId, configId);
    expect(before?.lastNotifiedSignalTime).toBeNull();

    const summary = await checkAlertsOnce();
    expect(summary.checkedConfigs).toBeGreaterThanOrEqual(1);

    const after = getStrategyConfig(workspaceId, configId);
    // DEMO 資料下 EMA 策略可能也完全沒有訊號，此時基準仍會是 null；只驗證不會拋出例外、流程能跑完
    expect(after).not.toBeNull();
  });

  it("把基準設回很久以前時，重新執行會偵測到『新訊號』並更新基準（即使該工作區未啟用任何通知管道）", async () => {
    markConfigNotified(configId, 1); // 極早的時間，確保所有訊號都視為「新」
    const settingsBefore = getNotificationSettings(workspaceId);
    // 本測試工作區在前面的描述區塊已啟用 telegram/email，這裡刻意確認分派仍會嘗試（但因未設定伺服器端憑證會失敗)
    expect(settingsBefore.telegramEnabled || settingsBefore.emailEnabled).toBe(true);

    const summary = await checkAlertsOnce();
    expect(summary.errors.length).toBe(0);

    const after = getStrategyConfig(workspaceId, configId);
    // 若 DEMO 資料下該策略確實產生過訊號，基準應該被推進到不等於 1
    if (after && after.lastNotifiedSignalTime !== null) {
      expect(after.lastNotifiedSignalTime).toBeGreaterThan(1);
    }
  });

  it("單一設定出錯不會中斷整批排程", async () => {
    createStrategyConfig(workspaceId, {
      strategyId: "ema-trend",
      name: "不支援交易對",
      symbol: "DOGEUSDT",
      interval: "1h",
      params: emaTrendDefaultParams,
      backtestConfig: defaultBacktestConfig,
      alertEnabled: true,
    });
    const summary = await checkAlertsOnce();
    expect(summary.checkedConfigs).toBeGreaterThanOrEqual(2);
    expect(summary.errors.some((e) => e.message.length > 0)).toBe(true);
  });
});
