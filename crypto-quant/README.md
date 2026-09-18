# 加密貨幣量化策略分析網站

一個以 Next.js（App Router）+ TypeScript + Tailwind CSS 打造的加密貨幣量化策略研究平台，提供即時／歷史行情、技術指標、策略訊號、歷史回測、績效分析、策略比較、參數敏感度分析、基礎版 walk-forward 分析、模擬（紙上）投資組合與觀察清單。

> 本網站僅供資料分析、策略研究與教育用途，不構成投資建議、招攬或保證獲利。加密貨幣價格波動劇烈，使用者可能損失全部本金。歷史回測結果不代表未來績效。

## 目錄

- [技術架構](#技術架構)
- [快速開始](#快速開始)
- [環境變數](#環境變數)
- [資料庫初始化](#資料庫初始化)
- [開發模式](#開發模式)
- [測試](#測試)
- [程式碼檢查與型別檢查](#程式碼檢查與型別檢查)
- [正式建置與啟動](#正式建置與啟動)
- [如何切換資料來源](#如何切換資料來源)
- [如何新增一個策略](#如何新增一個策略)
- [部署](#部署)
- [專案目錄結構](#專案目錄結構)
- [已完成項目](#已完成項目)
- [尚未完成／已知限制](#尚未完成已知限制)
- [未來擴充建議](#未來擴充建議)

## 技術架構

- **前端／後端**：Next.js 15（App Router，含 API Routes）、React 19、TypeScript（strict 模式）
- **樣式**：Tailwind CSS v4，深色金融平台風格，紅綠漲跌搭配文字／圖示／正負號（兼顧色弱使用者）
- **圖表**：TradingView `lightweight-charts`（K 線 + 成交量 + EMA/布林通道疊圖 + 訊號標記）、`recharts`（資金曲線、回撤曲線、月報酬熱圖、交易損益分布、敏感度熱圖、RSI/MACD 面板）
- **資料驗證**：`zod`（所有 API 輸入皆經白名單與型別驗證）
- **資料庫**：SQLite（`better-sqlite3`），透過 repository 介面封裝（`lib/storage/*Repo.ts`），未來要換成 PostgreSQL 只需替換這幾個檔案的實作，呼叫端完全不需修改
- **狀態管理**：`@tanstack/react-query`（伺服器資料快取／重新驗證）、`zustand`（單次回測／比較結果的暫存展示狀態）
- **測試**：`vitest`（單元測試 + API 整合測試）

第一版採單一 Next.js 專案同時提供前端與後端 API，**不需要額外啟動第二個服務**，一行指令即可啟動。

## 快速開始

```bash
cd crypto-quant
npm install
cp .env.example .env.local
npm run dev
```

開啟 http://localhost:3000 即可使用。

## 環境變數

複製 `.env.example` 為 `.env.local` 後依需求調整。重要變數：

| 變數 | 說明 | 預設值 |
| --- | --- | --- |
| `DATA_PROVIDER` | `binance`（正式，連線 Binance 公開市場 API）或 `demo`（本機示範用模擬資料，介面會標示「DEMO 模擬資料」） | `binance` |
| `BINANCE_BASE_URL` | Binance 現貨公開 API 網址 | `https://api.binance.com` |
| `FX_USDT_TWD_FALLBACK` | USDT/新臺幣固定備援匯率 | `32.5` |
| `DATABASE_FILE` | SQLite 資料庫檔案路徑 | `./data/app.db` |
| `RATE_LIMIT_PER_MINUTE` | 每個 IP 每分鐘可呼叫 API 次數上限 | `60` |
| `BACKTEST_MAX_BARS` | 單次回測最大 K 棒數（避免計算量失控） | `20000` |
| `ENABLE_LIVE_TRADING` | 真實交易功能開關，第一版必須維持 `false` | `false` |

任何需要 API Key 的資料來源（例如未來串接 CoinMarketCap）都必須透過環境變數設定，**絕不可寫死在程式碼或提交紀錄中**。

## 資料庫初始化

SQLite 資料庫檔案會在應用程式第一次存取時自動建立與建表（見 `lib/storage/db.ts`），無需手動執行遷移指令。若想在啟動前手動初始化，可執行：

```bash
npm run db:init
```

## 開發模式

```bash
npm run dev
```

## 測試

```bash
npm test          # 執行一次所有單元測試與 API 整合測試（vitest run）
npm run test:watch  # 監看模式
```

測試涵蓋：
- 技術指標（EMA / SMA / RSI / MACD / 布林通道 / 波動度 / 量能比）計算正確性與暖機期處理
- 四種策略的參數驗證、訊號產生、**無未來函數驗證**（只用前半段資料時，產生的訊號需與完整資料的對應區間完全一致）
- 回測引擎：進場最早於訊號下一根 K 棒成交、交易成本（手續費／滑價）、停損／停利／移動停損、資料清理（重複 K 棒、資料缺漏、異常價格）
- 績效指標：最大回撤、Sharpe Ratio（含波動度為 0 時不會除以零）、沒有交易時的安全預設值、資料不足時的警告
- 儲存層（策略設定 CRUD、觀察清單、模擬投資組合買賣、現金不足時拒絕交易）
- API 整合測試：`/api/symbols`、`/api/strategies`、`/api/backtest/run`（含不支援交易對、不合法參數、日期區間錯誤的 400 回應，確認不會用假資料頂替）

目前測試結果：**5 個測試檔案、52 項測試全數通過**。

若時間允許，建議下一步以 Playwright 補上端對端測試（例如「選擇 BTC/USDT → 設定 EMA 策略 → 執行回測 → 查看結果」的主要使用流程）；本次開發過程中已使用 Playwright 手動驗證過此流程（見下方「已完成項目」）。

## 程式碼檢查與型別檢查

```bash
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```

## 正式建置與啟動

```bash
npm run build
npm run start
```

## TradingView 圖表整合

行情與技術圖表頁（`/market`，以及首頁的策略分析工作區完整版）在圖表上方提供兩個分頁：

- **本站圖表（含策略訊號）**：以 `lightweight-charts` 繪製，疊加本站計算的 EMA/RSI/MACD 與策略訊號標記
- **TradingView 圖表**：嵌入 [TradingView 官方免費 Advanced Chart Widget](https://www.tradingview.com/widget/advanced-chart/)（`components/charts/TradingViewWidget.tsx`），對照參考用，不會顯示本站策略訊號，資料來源與更新時間可能與本站略有差異

實作方式是動態載入 TradingView 官方腳本 `https://s3.tradingview.com/tv.js` 並以 `BINANCE:<symbol>` 格式建立 widget，**不需要任何 API 金鑰**，僅使用其公開免費的嵌入元件。`next.config.ts` 的 CSP 已額外放行 `s3.tradingview.com` / `static.tradingview.com`（script-src）、`*.tradingview.com`（connect-src / img-src）與 `www.tradingview.com`、`s.tradingview.com`（frame-src），其餘資源仍維持僅限本站的嚴格政策。若 TradingView 資源載入失敗（例如網路無法連線到 tradingview.com），畫面會顯示友善的錯誤提示，不會讓頁面壞掉或空白。

> 本次開發沙箱環境同樣封鎖了對 tradingview.com 的對外連線，因此僅能確認元件程式碼正確載入腳本、CSP 設定正確放行、並在連線失敗時正確顯示錯誤狀態；實際圖表渲染畫面請在你自己可連外網的機器上確認。

## 如何切換資料來源

在 `.env.local` 設定：

```bash
DATA_PROVIDER=binance   # 正式：連線 Binance 公開市場 API
# 或
DATA_PROVIDER=demo      # 本機展示：使用確定性亂數產生的模擬資料，畫面會清楚標示「DEMO 模擬資料」
```

資料供應層已抽象化（`lib/market/providers/`，實作 `DataProvider` 介面），未來新增 CoinGecko、CoinMarketCap 或其他交易所，只需：

1. 在 `lib/market/providers/` 新增一個實作 `DataProvider` 介面的檔案（`getTicker24h`、`getKlines`）
2. 在 `lib/market/providers/index.ts` 的 `providers` 物件中註冊
3. 若該來源需要 API Key，於 `.env.example` 新增對應變數並在程式中以 `process.env.X` 讀取，不可寫死金鑰

> **注意**：本次開發所在的沙箱環境因網路政策封鎖了對外部交易所 API（含 Binance、CoinGecko 等）的連線，因此無法在此環境內實際驗證 `DATA_PROVIDER=binance` 的即時連線結果；程式碼已依 Binance 公開 API 官方格式（`/api/v3/klines`、`/api/v3/ticker/24hr`、`/api/v3/exchangeInfo`）實作，並以 `DATA_PROVIDER=demo` 模式完整驗證過整站所有頁面與功能（含回測、比較、敏感度分析、walk-forward、模擬交易）。請在你自己可連線外部網路的機器上，將 `DATA_PROVIDER` 設為 `binance` 後再次確認即時資料串接正常。

## 如何新增一個策略

1. 在 `lib/strategies/` 新增檔案（可參考 `emaTrend.ts`），實作 `Strategy<P>` 介面（`lib/strategies/types.ts`）：
   - `defaultParams`：預設參數
   - `validateParams(params)`：回傳 `{ valid, errors }`，需檢查參數合理範圍
   - `generateSignals(candles, params, ctx)`：**只能使用 `candles[0..i]` 計算第 i 根的訊號**，回傳 `StrategySignal[]`（訊號類型限定為 `bullish_candidate` / `bearish_candidate` / `watch` / `risk_up`，不可使用「保證獲利」等字眼）
2. 在 `lib/strategies/registry.ts` 的 `strategyRegistry` 註冊該策略
3. 在 `components/strategy/StrategyParamsForm.tsx` 新增對應的參數表單區塊（若有需要）
4. API 路由（回測、比較、敏感度分析、walk-forward）、策略下拉選單、行情頁的策略選擇皆會自動支援新策略，不需要額外修改

## 部署

### 部署至 Vercel

1. 將專案推送到 GitHub／GitLab
2. 在 Vercel 建立新專案並選擇 `crypto-quant` 目錄
3. 在 Vercel 專案的 Environment Variables 設定 `.env.example` 中列出的變數（至少 `DATA_PROVIDER=binance`）
4. **注意 SQLite 限制**：Vercel Serverless 環境檔案系統唯讀（除 `/tmp` 外）且不持久化，`better-sqlite3` 寫檔在此環境下無法正常運作。上線前請將 `lib/storage/db.ts` 與各 `*Repo.ts` 替換為連線 Vercel Postgres / Supabase / PlanetScale 等雲端資料庫的實作（介面已設計為可平移，工作量僅限資料存取層）。單純瀏覽行情、K 線、回測（不需儲存設定／觀察清單／模擬投資組合）的功能在 Serverless 環境下可直接運作。
5. 執行 `npm run build` 確認建置成功後即可部署

### 部署至具持久化磁碟的平台（Docker / VM / Railway / Fly.io 等）

這類平台可直接使用 SQLite：

```bash
npm run build
npm run start
```

搭配 reverse proxy（Nginx / Caddy）處理 HTTPS 憑證即可。建議掛載一個持久化磁碟卷到 `DATABASE_FILE` 所在目錄。

## 專案目錄結構

```
crypto-quant/
├── app/                      # Next.js App Router：頁面與 API Routes
│   ├── api/                  # 後端 API（symbols / market / backtest / strategy-configs / watchlist / portfolio ...）
│   ├── market/ strategy/ backtest/ compare/ portfolio/ watchlist/ about/
│   └── page.tsx              # 首頁儀表板
├── components/                # UI 元件（ui / common / layout / charts / workspace / strategy / backtest / market）
├── lib/
│   ├── market/                # 資料供應層（Binance / Demo provider、快取、重試、標準化 OHLCV）
│   ├── indicators/            # EMA / RSI / MACD / 布林通道 / 波動度（純函式）
│   ├── strategies/            # 四種策略 + 可擴充的策略介面與註冊表
│   ├── backtest/              # 回測引擎、績效指標、敏感度分析、walk-forward、資料清理
│   ├── storage/                # SQLite repository（策略設定 / 觀察清單 / 模擬投資組合）
│   ├── api/                    # API 共用工具（回應格式、速率限制、zod schema）
│   └── client/                  # 前端 API 呼叫、react-query hooks、zustand store
├── tests/                      # vitest 單元測試 + API 整合測試 + 固定測試資料
└── scripts/init-db.ts          # 手動初始化資料庫
```

## 已完成項目

- 資料供應層抽象化，內建 Binance 現貨公開 API 實作與 DEMO 模擬資料實作，兩者明確區分且互不混淆
- 首頁儀表板（市場摘要 + 策略分析工作區）、行情與技術圖表頁、策略設定頁、回測結果頁、策略比較頁、模擬投資組合頁、觀察清單頁、系統說明頁，共 8 個主要頁面全數完成並可實際操作
- EMA 趨勢、RSI 均值回歸、MACD 趨勢、多因子綜合（含透明可解釋的因子貢獻與權重驗證）共四種策略，皆透過可擴充介面實作
- 完整回測引擎：防未來函數、次一根 K 棒成交、手續費／滑價、停損／停利／移動停損、資料清理與警告、扣成本前後績效比較
- 22 項績效指標（含中文說明）、資金曲線、回撤曲線、月報酬熱圖、交易損益分布、可篩選排序並匯出 CSV 的交易紀錄表
- 策略比較（多策略同條件比較，可依報酬／風險／風險調整後報酬排序）
- 參數敏感度分析（雙軸熱圖）與基礎版 walk-forward 分析（訓練／測試期切分，樣本不足時顯示警告）
- 策略設定可儲存、重新命名、複製、刪除（二次確認）、重新載入，以匿名工作區（cookie）區分使用者
- 觀察清單與模擬（紙上）投資組合（含已實現／未實現損益），真實交易功能維持停用並清楚標示尚未開放
- 首頁與回測結果頁醒目風險聲明；小樣本、回測期過短、最大回撤過高時顯示風險警告
- 行情頁整合 TradingView 官方免費圖表 Widget（與本站自製策略圖表並列分頁切換），CSP 已針對性放行所需網域
- API 輸入白名單驗證（zod）、速率限制、回測資料量與逾時上限、CSP／安全標頭、不使用 `eval`
- 52 項單元測試／整合測試全數通過；ESLint、`tsc --noEmit`、`next build`（正式建置）皆執行成功並修正所有錯誤
- 以 Playwright 實際啟動應用程式並操作：首頁 → 策略設定頁 → 執行回測 → 查看回測結果 → 執行敏感度分析／walk-forward → 策略比較 → 觀察清單新增 → 模擬投資組合下單，全流程無主控台錯誤、無 HTTP 4xx/5xx；同時驗證手機（390px）與桌機寬度下的響應式版面

## 尚未完成／已知限制

- **本沙箱環境無法連線 Binance 等外部交易所 API**（組織網路政策封鎖），因此 `DATA_PROVIDER=binance` 的即時資料串接僅完成程式碼實作與官方 API 格式比對，未能在本環境實際驗證；請在有網路對外連線的環境測試。
- 尚未實作帳號登入系統，第一版以瀏覽器 cookie 匿名工作區區分使用者資料（架構已保留未來加入登入功能的彈性）
- 尚未串接即時匯率 API（USDT/TWD 使用固定備援匯率）
- Walk-forward 分析與敏感度分析為「基礎版」，一次僅支援 1～2 個參數的網格搜尋，未實作更進階的最佳化演算法
- 尚未加入 Playwright 自動化端對端測試檔案（已用 Playwright 手動驗證主要流程，但未寫成可重複執行的測試套件）
- SQLite 僅適合本機／單機部署；Serverless（如 Vercel）環境需另接雲端資料庫才能使用策略設定／觀察清單／模擬投資組合的持久化功能
- 真實交易功能第一版完全未開放（依需求刻意保留為停用狀態）

## 未來擴充建議

- 將 `lib/storage` 換成 PostgreSQL（或其他雲端資料庫）實作，以支援 Serverless 部署與多使用者
- 加入帳號系統（Email/OAuth 登入），並將匿名工作區資料遷移至登入帳號
- 串接更多資料來源（CoinGecko、CoinMarketCap）並提供使用者選擇偏好來源
- 新增更多策略模組：突破策略、網格策略、動能策略、機器學習模型（皆可透過現有 `Strategy` 介面擴充）
- 補上 Playwright 端對端測試套件並整合進 CI
- 真實交易功能：後端安全保存加密後的 API 金鑰、最低必要權限、禁止提領權限、IP 白名單、操作二次確認、稽核紀錄、緊急停止機制
