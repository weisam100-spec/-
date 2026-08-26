# TicketNow — 售票平台範例

一個完整的自建售票系統範例：活動列表、票種管理、**虛擬候位排隊機制**、**防超賣訂單流程**、模擬付款與後台管理。使用 Next.js 16 (App Router) + Prisma 7 (SQLite) + Tailwind CSS 4 打造。

> 這是給活動主辦方使用的售票平台，不是用來搶購第三方售票網站（拓元、KKTIX、Ticketmaster…）票券的機器人。

## 功能

- **會員系統**：Email/密碼註冊登入，JWT session（httpOnly cookie）。
- **活動與票種管理**：後台可建立活動、多種票種（價格、總量、每人限購張數）。
- **虛擬候位區**：開賣時若流量過大，使用者先進入排隊區；系統每隔 N 秒放行一批人進入結帳頁，逾時未完成結帳會釋出名額給下一位。避免結帳頁被瞬間流量衝垮，也讓搶票公平（先到先排）。
- **防超賣訂單流程**：選票送出時用「條件式 UPDATE（compare-and-swap）」原子扣庫存，多人同時搶最後幾張票也不會超賣；未付款訂單逾時會自動釋出保留庫存。
- **模擬付款**：訂單狀態機 `PENDING → PAID / CANCELLED / EXPIRED`（示範用，未串接真實金流）。
- **後台管理**：活動列表、庫存與訂單總覽。

## 核心機制說明

### 1. 排隊放行（`src/lib/queue.ts`）

每個使用者對每個活動只有一筆 `QueueTicket`：

1. 加入候位 → 狀態 `WAITING`，依加入順序取得 `position`。
2. 每次查詢狀態時（前端每 2 秒 poll 一次）都會呼叫 `admitNext()`：
   - 先把逾時未完成結帳的 `ADMITTED` 名額標記為 `EXPIRED`，釋出容量。
   - 若目前 `ADMITTED` 人數 < `admitBatchSize`，且距離上次放行已超過 `admitIntervalSec` 秒，就從 `WAITING` 佇列依 `position` 放行下一批人，給予 `admitWindowMinutes` 分鐘的結帳時限。
3. 建立訂單前會檢查該使用者是否為有效的 `ADMITTED` 狀態，否則回傳 `QUEUE_REQUIRED`。

這個設計不需要額外的 Redis 或排程系統，用輪詢 + 資料庫狀態即可運作，足以示範概念；若要應付真正大流量，建議把候位狀態換成 Redis/佇列服務。

### 2. 防超賣（`src/lib/inventory.ts`）

```ts
tx.ticketType.updateMany({
  where: { id: ticketTypeId, remainingQty: { gte: quantity } },
  data: { remainingQty: { decrement: quantity } },
})
```

這是一句原子的條件式更新：只有「目前剩餘量足夠」時才會真的扣庫存並回傳 `count === 1`。多個請求同時打進來，資料庫層保證這句 SQL 是序列化執行的，所以不會有兩個人同時搶到同一張票的競態問題（race condition）。若 `count === 0` 就代表庫存不足，直接回傳 `SOLD_OUT` 並 rollback。

未付款訂單有 `expiresAt`（`holdMinutes` 分鐘），逾時由 `expireStaleOrders()` 釋回庫存 —— 每次讀取活動/建立訂單前都會先執行一次，屬於「lazy expiry」，不需要背景排程。

## 開發

```bash
npm install
npx prisma migrate dev   # 建立/更新資料庫 schema
npx prisma db seed       # 建立示範帳號與活動
npm run dev
```

開發完成後打開 http://localhost:3000

### 示範帳號（由 `prisma/seed.ts` 建立）

| 角色 | Email | 密碼 |
| --- | --- | --- |
| 後台管理者 | admin@example.com | admin1234 |
| 一般會員 | user@example.com | user1234 |

種子資料包含一個「開賣中」活動（`demo-concert-2026`，候位每 10 秒放行 5 人，方便測試排隊機制）與一個「尚未開賣」活動（可觀察倒數計時）。

### 環境變數（`.env`）

- `DATABASE_URL`：SQLite 檔案位置，預設 `file:./dev.db`
- `AUTH_SECRET`：JWT 簽章密鑰（已自動產生一組隨機值，正式環境請自行更換並妥善保管）

## 專案結構

```
prisma/schema.prisma       資料模型（User / Event / TicketType / Order / OrderItem / QueueTicket）
src/lib/db.ts               Prisma Client 單例
src/lib/auth.ts             密碼雜湊、JWT session
src/lib/queue.ts            虛擬候位排隊邏輯
src/lib/inventory.ts        訂單建立、防超賣、逾時釋放
src/app/api/**              REST API routes
src/app/**                  頁面（活動列表、活動詳情、候位頁、結帳頁、訂單頁、後台）
```

## 尚未涵蓋（正式上線前需要補強）

- 真實金流串接（目前是「模擬付款」按鈕）
- Email 驗證 / 忘記密碼
- 大流量下建議把候位狀態、庫存快取搬到 Redis，並用真正的訊息佇列取代輪詢
- 圖形驗證碼 / 風控（防止單一使用者用多帳號重複排隊）
- 更完整的權限管理（多位後台管理者、活動共編）
