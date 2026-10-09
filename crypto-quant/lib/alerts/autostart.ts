import { env } from "@/lib/env";

// 背景排程啟動器。
//
// 原本透過 Next.js 官方的 instrumentation.ts hook 啟動，但該檔案會被 Next.js 同時編譯成
// edge-相容的版本（即使本專案完全沒有使用 edge runtime），而 edge 編譯環境沒有 Node.js 的
// 'fs' 等內建模組，會導致 better-sqlite3 相關的匯入鏈（scheduler -> strategyConfigRepo -> db）
// 編譯失敗，使整個 dev server 回應 500。
// 改為由本模組以 globalThis 旗標確保「只啟動一次」，並從保證只在 Node.js runtime 執行的
// 伺服器端模組（app/layout.tsx）呼叫，避開 instrumentation hook 的雙重編譯問題。
declare global {
  var __cqAlertsSchedulerStarted: boolean | undefined;
}

export function ensureAlertsSchedulerStarted(): void {
  if (!env.alertsEnabled) return;
  if (globalThis.__cqAlertsSchedulerStarted) return;
  globalThis.__cqAlertsSchedulerStarted = true;

  const intervalMs = Math.max(15, env.alertPollIntervalSeconds) * 1000;

  const runCheck = async () => {
    try {
      const { checkAlertsOnce } = await import("./scheduler");
      const summary = await checkAlertsOnce();
      if (summary.notifiedConfigs > 0 || summary.errors.length > 0) {
        console.log(
          `[alerts] 檢查 ${summary.checkedConfigs} 筆設定，發送 ${summary.notifiedConfigs} 筆通知，${summary.errors.length} 筆錯誤`,
        );
      }
    } catch (err) {
      console.error("[alerts] 背景排程執行失敗：", err);
    }
  };

  console.log(`[alerts] 訊號提醒背景排程已啟動，每 ${env.alertPollIntervalSeconds} 秒檢查一次`);
  void runCheck();
  setInterval(runCheck, intervalMs);
}
