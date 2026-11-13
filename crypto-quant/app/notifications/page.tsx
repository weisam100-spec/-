"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Select, TextInput } from "@/components/ui/Field";
import { RiskBanner } from "@/components/common/RiskBanner";
import { EmptyState, LoadingState } from "@/components/common/StatusStates";
import {
  useCreatePriceAlert,
  useDeletePriceAlert,
  useNotificationSettings,
  usePriceAlerts,
  useSendTestNotification,
  useSymbols,
  useTogglePriceAlert,
  useUpdateNotificationSettings,
} from "@/lib/client/hooks";
import { subscribeBrowserPush, unsubscribeBrowserPush } from "@/lib/client/push";
import { formatDateTime } from "@/lib/format";
import type { PriceAlertRule } from "@/lib/storage/priceAlertRepo";

function ChannelStatus({ configured }: { configured: boolean }) {
  return configured ? (
    <span className="text-xs font-medium text-[var(--color-up)]">伺服器已設定</span>
  ) : (
    <span className="text-xs font-medium text-[var(--color-down)]">伺服器尚未設定</span>
  );
}

const DIRECTION_LABEL: Record<PriceAlertRule["direction"], string> = {
  both: "不限方向（漲跌皆通知）",
  up: "僅急漲時通知",
  down: "僅急跌時通知",
};

function PriceAlertCard() {
  const { data, isLoading } = usePriceAlerts();
  const { data: symbolsData } = useSymbols();
  const createMutation = useCreatePriceAlert();
  const toggleMutation = useTogglePriceAlert();
  const deleteMutation = useDeletePriceAlert();

  const [symbol, setSymbol] = useState("BTCUSDT");
  const [thresholdPct, setThresholdPct] = useState(5);
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [direction, setDirection] = useState<PriceAlertRule["direction"]>("both");
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = async () => {
    setFormError(null);
    try {
      await createMutation.mutateAsync({ symbol, thresholdPct, windowMinutes, direction });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "新增失敗");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>異常價格波動提醒</CardTitle>
      </CardHeader>
      <div className="flex flex-col gap-3">
        <p className="text-xs text-[var(--color-text-muted)]">
          設定「在多少分鐘內，漲跌幅達到多少百分比」就透過上方已啟用的管道通知你，純粹是價格歷史數字的計算，不是對後市的預測。同一波動在視窗長度內只會通知一次，避免洗版。
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="交易對">
            <Select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {(symbolsData?.symbols ?? []).map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.displayName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="視窗長度（分鐘）" hint="5~1440 之間，5 的倍數">
            <TextInput
              type="number"
              min={5}
              max={1440}
              step={5}
              value={windowMinutes}
              onChange={(e) => setWindowMinutes(Number(e.target.value))}
            />
          </Field>
          <Field label="漲跌幅門檻（%）">
            <TextInput
              type="number"
              min={0.1}
              max={50}
              step={0.1}
              value={thresholdPct}
              onChange={(e) => setThresholdPct(Number(e.target.value))}
            />
          </Field>
          <Field label="方向">
            <Select value={direction} onChange={(e) => setDirection(e.target.value as PriceAlertRule["direction"])}>
              <option value="both">不限方向</option>
              <option value="up">僅急漲</option>
              <option value="down">僅急跌</option>
            </Select>
          </Field>
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            新增規則
          </Button>
        </div>
        {formError && <p className="text-xs text-[var(--color-down)]">{formError}</p>}

        {isLoading && <LoadingState />}
        {!isLoading && (data?.rules.length ?? 0) === 0 && <EmptyState message="目前沒有設定任何異常價格波動規則" />}
        {!isLoading && (data?.rules.length ?? 0) > 0 && (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="text-[var(--color-text-muted)]">
                <tr>
                  <th className="p-2 text-left">交易對</th>
                  <th className="p-2 text-right">視窗</th>
                  <th className="p-2 text-right">門檻</th>
                  <th className="p-2 text-left">方向</th>
                  <th className="p-2 text-left">最近一次觸發</th>
                  <th className="p-2 text-left">啟用</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {data!.rules.map((rule) => (
                  <tr key={rule.id} className="border-t border-[var(--color-border)]">
                    <td className="p-2 font-medium text-[var(--color-text)]">{rule.symbol}</td>
                    <td className="p-2 text-right">{rule.windowMinutes} 分鐘</td>
                    <td className="p-2 text-right">{rule.thresholdPct}%</td>
                    <td className="p-2">{DIRECTION_LABEL[rule.direction]}</td>
                    <td className="p-2 text-[var(--color-text-muted)]">
                      {rule.lastTriggeredAt ? formatDateTime(rule.lastTriggeredAt) : "—"}
                    </td>
                    <td className="p-2">
                      <Checkbox
                        label=""
                        checked={rule.enabled}
                        onChange={(e) => toggleMutation.mutate({ id: rule.id, enabled: e.target.checked })}
                      />
                    </td>
                    <td className="p-2 text-right">
                      <Button
                        variant="ghost"
                        className="!px-2 !py-1 text-[var(--color-down)]"
                        onClick={() => deleteMutation.mutate(rule.id)}
                      >
                        移除
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function NotificationsPage() {
  const { data, isLoading } = useNotificationSettings();
  const updateMutation = useUpdateNotificationSettings();
  const testMutation = useSendTestNotification();
  const [chatId, setChatId] = useState("");
  const [email, setEmail] = useState("");
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const [pushBusy, setPushBusy] = useState(false);

  const settings = data?.settings;
  const chatIdValue = chatId || settings?.telegramChatId || "";
  const emailValue = email || settings?.emailAddress || "";

  const runTest = async (channel: "telegram" | "email" | "push") => {
    setTestResult((prev) => ({ ...prev, [channel]: "發送中…" }));
    try {
      await testMutation.mutateAsync(channel);
      setTestResult((prev) => ({ ...prev, [channel]: "已發送，請確認是否收到" }));
    } catch (err) {
      setTestResult((prev) => ({ ...prev, [channel]: err instanceof Error ? err.message : "發送失敗" }));
    }
  };

  const handlePushToggle = async (enable: boolean) => {
    setPushBusy(true);
    try {
      if (enable) {
        const result = await subscribeBrowserPush();
        if (!result.ok) {
          setTestResult((prev) => ({ ...prev, push: result.error ?? "訂閱失敗" }));
          return;
        }
      } else {
        await unsubscribeBrowserPush();
        await updateMutation.mutateAsync({ pushEnabled: false });
      }
    } finally {
      setPushBusy(false);
    }
  };

  if (isLoading || !data) {
    return <p className="text-sm text-[var(--color-text-muted)]">載入通知設定中…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <RiskBanner compact />
      <h1 className="text-lg font-bold text-[var(--color-text)]">訊號提醒通知</h1>
      <p className="text-sm text-[var(--color-text-muted)]">
        在「策略設定」頁面將已儲存的策略設定開啟「啟用提醒」後，背景排程會定期檢查最新收盤資料，若出現新的策略訊號，會透過下方啟用的管道主動通知你，不需要手動開網站查看。
      </p>

      {!data.alertsEnabled && (
        <div className="rounded-md border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 p-3 text-sm text-[var(--color-warn)]">
          背景排程目前未啟用。請於伺服器的 .env.local 設定 <code>ALERTS_ENABLED=true</code> 並重新啟動伺服器，才會定期檢查訊號並發送通知。
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Telegram</CardTitle>
          <ChannelStatus configured={data.serverConfigured.telegram} />
        </CardHeader>
        <div className="flex flex-col gap-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            需要伺服器端先設定 <code>TELEGRAM_BOT_TOKEN</code>（向 @BotFather 申請機器人並取得 Token）。你只需要提供自己的 Chat ID（可向
            @userinfobot 查詢）。
          </p>
          <Field label="Telegram Chat ID">
            <TextInput value={chatIdValue} onChange={(e) => setChatId(e.target.value)} placeholder="例如：123456789" />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Checkbox
              label="啟用 Telegram 通知"
              checked={settings?.telegramEnabled ?? false}
              onChange={(e) =>
                updateMutation.mutate({ telegramEnabled: e.target.checked, telegramChatId: chatIdValue || null })
              }
            />
            <Button
              variant="secondary"
              className="!px-2 !py-1"
              onClick={() => updateMutation.mutate({ telegramChatId: chatIdValue || null })}
            >
              儲存 Chat ID
            </Button>
            <Button variant="ghost" className="!px-2 !py-1" onClick={() => runTest("telegram")}>
              發送測試通知
            </Button>
            {testResult.telegram && <span className="text-xs text-[var(--color-text-muted)]">{testResult.telegram}</span>}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <ChannelStatus configured={data.serverConfigured.email} />
        </CardHeader>
        <div className="flex flex-col gap-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            需要伺服器端先設定 SMTP 相關變數（<code>SMTP_HOST</code> / <code>SMTP_USER</code> / <code>SMTP_PASSWORD</code> 等）。
          </p>
          <Field label="通知 Email">
            <TextInput value={emailValue} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Checkbox
              label="啟用 Email 通知"
              checked={settings?.emailEnabled ?? false}
              onChange={(e) => updateMutation.mutate({ emailEnabled: e.target.checked, emailAddress: emailValue || null })}
            />
            <Button
              variant="secondary"
              className="!px-2 !py-1"
              onClick={() => updateMutation.mutate({ emailAddress: emailValue || null })}
            >
              儲存 Email
            </Button>
            <Button variant="ghost" className="!px-2 !py-1" onClick={() => runTest("email")}>
              發送測試通知
            </Button>
            {testResult.email && <span className="text-xs text-[var(--color-text-muted)]">{testResult.email}</span>}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>瀏覽器推播</CardTitle>
          <ChannelStatus configured={data.serverConfigured.push} />
        </CardHeader>
        <div className="flex flex-col gap-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            需要伺服器端先設定 <code>VAPID_PUBLIC_KEY</code> / <code>VAPID_PRIVATE_KEY</code>（可執行{" "}
            <code>npx web-push generate-vapid-keys</code> 產生專屬金鑰對）。啟用後，即使沒有開著這個網站的分頁，只要瀏覽器在背景執行，仍可收到系統通知。
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Checkbox
              label="在這個瀏覽器啟用推播"
              checked={settings?.pushEnabled ?? false}
              disabled={pushBusy}
              onChange={(e) => handlePushToggle(e.target.checked)}
            />
            <Button variant="ghost" className="!px-2 !py-1" onClick={() => runTest("push")}>
              發送測試通知
            </Button>
            {testResult.push && <span className="text-xs text-[var(--color-text-muted)]">{testResult.push}</span>}
          </div>
        </div>
      </Card>

      <PriceAlertCard />
    </div>
  );
}
