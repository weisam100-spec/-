# 安心長照導航（正式架構版）

Next.js + Supabase + ECPay 版本的長照申請導航工具。免費區塊（六大資格方向試算）
對所有人開放；付費解鎖（NT$299，可於 `.env` 調整）後開放完整申請路線、文件清單、
送件前檢查表、申請進度追蹤與五種照護方案費用比較，且解鎖狀態由伺服器端資料庫判斷，
不是前端 localStorage 能繞過的。

這份 README 假設你要從零把它跑起來、部署上線、接上真的金流。

## 1. 本機開發（不需要任何帳號）

```bash
npm install
npm run dev
```

打開 http://localhost:3000。沒有設定 `SUPABASE_URL` 時，資料會寫進本機的
`.data/db.json`（已加進 `.gitignore`，不會被提交）。付款流程預設接到 ECPay
官方公開的「測試特店」沙盒（`payment-stage.ecpay.com.tw`），可以完整跑過
「測驗 → 免費結果 → 付款解鎖 → 完整報告」，但因為沒有設定 `APP_URL` 對外可連線，
ECPay 沙盒伺服器沒辦法回呼你本機的 webhook——要驗證整個閉環，請部署到有公開網址
的環境（見下方第 3 節），或用 ngrok 之類的工具把本機暫時開一個公開網址。

## 2. 上線前要準備的三個帳號

1. **Supabase**（資料庫）
   - 到 https://supabase.com 建一個新專案。
   - 打開 SQL Editor，貼上 `supabase/migrations/0001_init.sql` 的內容並執行，
     會建立 `reports` 和 `orders` 兩張表。
   - 到 Project Settings → API，複製 `Project URL` 和 `service_role` 金鑰
     （不是 `anon` 金鑰——service_role 才有寫入權限，而且絕對不能出現在
     瀏覽器端程式碼中）。

2. **ECPay 綠界金流**（收款）
   - 這是目前唯一真正的商業門檻：要開「特約商店」帳號，需要**已登記的行號或
     公司統一編號**，個人身分無法申請正式特店。
   - 如果還沒有統編：可以先用 `.env.example` 內建的官方沙盒帳密無限測試整個
     流程，等有登記之後再換成正式帳密即可，程式碼不用改。
   - 申請通過後，從綠界商店後台拿到正式的 `MerchantID` / `HashKey` / `HashIV`。

3. **Vercel**（或其他支援 Next.js 的主機）
   - 建議直接用 Vercel：免費額度通常夠這種流量規模。
   - 也可以用任何支援 Next.js SSR/API Routes 的主機，但要確認檔案系統是
     ephemeral（不能依賴 FileStore，一定要接 Supabase）。

## 3. 部署設定

把 `.env.example` 裡的每一項，在 Vercel 專案的 Environment Variables 設定：

| 變數 | 說明 |
|---|---|
| `APP_URL` | 部署後的正式網址，例如 `https://ltc.yourdomain.com` |
| `REPORT_PRICE_TWD` / `NEXT_PUBLIC_REPORT_PRICE_TWD` | 報告售價，兩個要填一樣的數字 |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | 見上方第 2 節 |
| `ECPAY_MODE` | 上線前改成 `Production` |
| `ECPAY_MERCHANT_ID` / `ECPAY_HASH_KEY` / `ECPAY_HASH_IV` | 綠界正式特店的三組值 |

部署後務必用小額真實付款測試一次完整流程（測驗 → 付款 → 收到 ECPay 通知 →
`/report/[id]` 自動顯示已解鎖），確認 `ECPAY_MODE=Production` 且
`APP_URL` 對外可連線，否則 ECPay 的付款完成通知（webhook）送不到你的網站，
使用者付了錢但報告不會自動解鎖。

## 4. 為什麼是這個技術選擇

- **Next.js**：跟這個 repo 裡的 `web/`（AI 股票助手）用同一套框架，維護成本一致。
- **Supabase**：Postgres + 免費額度，不需要自己管資料庫伺服器。
- **綠界 ECPay**：比 Stripe 更貼近台灣使用者的付款習慣（信用卡、ATM、超商代碼、
  LINE Pay 等），且串接套件 `ecpay_aio_nodejs` 是官方檢查碼演算法的現成實作，
  比自己重寫 CheckMacValue 安全。
- **不需要帳號登入**：用 Email 收據代替帳密登入，降低付費轉換的摩擦——報告網址
  本身就是存取憑證（類似 Google Docs 的分享連結），這對一次性單品報告是合理的
  取捨；如果之後要做訂閱制或多份報告管理，才需要真正的帳號系統。

## 5. 這個版本還沒做的事

- 沒有正式的使用者帳號／登入系統（見上方取捨說明）。
- 沒有 AI 文件檢查、智慧提醒、家庭共享（這些需要另外規劃 AI API 或即時協作的
  架構，屬於下一階段）。
- 發票（電子發票）目前沒有串接，正式上線做生意需要另外處理稅務發票義務。
- ECPay 串接目前只開 `ChoosePayment: 'ALL'`（開放所有付款方式），如果想限制或
  客製顯示的付款選項，改 `lib/ecpay.ts` 的 `buildCheckoutHtml`。
