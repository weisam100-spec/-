import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { withRateLimit } from "@/lib/api/withRateLimit";
import { symbolSchema } from "@/lib/api/backtestSchema";
import { addWatchlistItem, listWatchlist } from "@/lib/storage/watchlistRepo";
import { getOrCreateWorkspaceId } from "@/lib/storage/workspace";

const createSchema = z.object({
  symbol: symbolSchema,
  note: z.string().max(200).optional(),
});

export const GET = withRateLimit(async () => {
  const workspaceId = await getOrCreateWorkspaceId();
  return apiOk({ items: listWatchlist(workspaceId) });
});

export const POST = withRateLimit(async (request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("請求內容必須是合法的 JSON", 400, "invalid_json");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("請求參數不合法：" + parsed.error.issues.map((i) => i.message).join("；"), 400, "invalid_params");
  }
  const workspaceId = await getOrCreateWorkspaceId();
  const item = addWatchlistItem(workspaceId, parsed.data.symbol, parsed.data.note);
  return apiOk({ item }, 201);
});
