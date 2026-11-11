import { apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { listSignalTracks } from "@/lib/storage/signalTrackRepo";
import { getOrCreateWorkspaceId } from "@/lib/storage/workspace";

// 即時訊號追蹤記錄：只讀，不分頁參數（第一版固定回傳最新 200 筆）。
// 資料由背景排程（lib/alerts/scheduler.ts + lib/alerts/trackResolver.ts）寫入，
// 此路由純粹讀取，不提供任何寫入或刪除操作。
export const GET = withRateLimit(async () => {
  const workspaceId = await getOrCreateWorkspaceId();
  const records = listSignalTracks(workspaceId);
  return apiOk({ records });
});
