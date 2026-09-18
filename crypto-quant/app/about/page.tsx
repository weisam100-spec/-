import { RiskBanner } from "@/components/common/RiskBanner";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <div className="space-y-2 text-sm leading-relaxed text-[var(--color-text-muted)]">{children}</div>
    </Card>
  );
}

export default function AboutPage() {
  return (
    <div className="flex flex-col gap-4">
      <RiskBanner />
      <h1 className="text-lg font-bold text-[var(--color-text)]">系統說明</h1>

      <Section title="這是什麼網站？">
        <p>
          本網站是一個加密貨幣「量化策略分析」平台，提供行情瀏覽、技術指標、策略訊號、歷史回測、績效分析、策略比較與模擬（紙上）投資組合功能，
          目的是協助使用者研究與理解量化策略的運作方式，屬於資料分析與教育用途的工具。
        </p>
        <p className="font-semibold text-[var(--color-warn)]">
          本網站不構成投資建議、招攬或保證獲利。加密貨幣價格波動劇烈，使用者可能損失全部本金。歷史回測結果不代表未來績效。
        </p>
      </Section>

      <Section title="資料來源與更新頻率">
        <p>
          行情資料預設來自 Binance 公開市場 API（現貨），資料供應層已抽象化，未來可擴充 CoinGecko、CoinMarketCap 或其他交易所來源。
          若資料來源查無某交易對或連線失敗，畫面會明確顯示「目前無法取得資料」，絕不以假資料充當真實行情。
        </p>
        <p>
          開發或展示情境下，若將資料來源切換為 DEMO 模式，所有畫面都會清楚標示「DEMO 模擬資料」，與正式資料完全區隔，不會混淆使用者判斷。
        </p>
        <p>價格同時提供 USDT 與新臺幣（TWD）換算，匯率預設為固定備援匯率，未來可串接即時匯率 API。所有時間顯示皆以 Asia/Taipei 時區呈現，內部計算則統一以 UTC 儲存。</p>
      </Section>

      <Section title="策略與訊號的意義">
        <p>
          第一版提供 EMA 趨勢、RSI 均值回歸、MACD 趨勢與多因子綜合共四種策略，皆以可擴充的共用介面實作，未來可加入突破、網格、動能或機器學習模型策略。
        </p>
        <p>
          訊號一律標示為「偏多候選訊號」「偏空候選訊號」「觀望」或「風險升高」，不會使用「保證獲利」「一定上漲」等字眼。每個訊號都可展開查看觸發原因、信心分數與當時使用的參數；多因子策略更會列出每個因子對總分的貢獻，避免黑箱結論。
        </p>
      </Section>

      <Section title="回測方法與限制">
        <ul className="list-disc space-y-1 pl-5">
          <li>訊號只能在 K 棒收盤後產生，最早於下一根 K 棒開盤成交，避免使用未來資料（防止未來函數）。</li>
          <li>已計入手續費（預設 0.1%）與滑價（預設 0.05%），並分別顯示扣除成本前後的績效差異。</li>
          <li>資料前處理會自動去除重複 K 棒、剔除異常價格，並提示資料缺漏；指標暖機期內不會產生訊號。</li>
          <li>第一版僅支援「現貨多頭」單一持倉模擬回測，尚未支援槓桿、合約、資金費率與強制平倉等功能，介面不會假裝已支援。</li>
          <li>參數敏感度分析與 walk-forward 分析用於觀察策略對參數的穩健程度，但任何「最佳參數」都只代表歷史區間內的結果，不保證未來仍然最佳；樣本數過少或回測期間過短時會顯示警告。</li>
        </ul>
      </Section>

      <Section title="模擬投資組合與真實交易">
        <p>模擬投資組合（紙上交易）僅在本機資料庫中記錄持倉與現金變化，不會連接任何真實交易所帳戶，也不會送出真實訂單。</p>
        <p>
          「真實交易」功能第一版尚未開放。未來若要支援，架構上將由後端安全保存加密後的 API 金鑰、採最低必要權限、禁止提領權限、IP 白名單、操作二次確認、完整稽核紀錄與緊急停止機制；在該功能完整實作並通過安全審查之前，使用者不需要也不應該輸入真實交易所金鑰。
        </p>
      </Section>

      <Section title="安全性與隱私">
        <ul className="list-disc space-y-1 pl-5">
          <li>所有需要金鑰的資料來源皆透過環境變數設定，不會寫死在程式碼或提交紀錄中。</li>
          <li>API 對交易對、週期等參數採白名單驗證，並有速率限制與逾時保護，避免濫用或造成網站無回應。</li>
          <li>第一版尚未實作帳號系統，以瀏覽器端的匿名工作區（cookie）區分不同使用者的策略設定、觀察清單與模擬投資組合；架構已保留未來加入登入功能的彈性。</li>
        </ul>
      </Section>
    </div>
  );
}
