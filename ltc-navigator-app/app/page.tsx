import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function HomePage() {
  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">安</div>
          <div>
            <div className="brand-name">安心長照導航</div>
            <div className="brand-sub">長照・外籍看護申請資格快速試算</div>
          </div>
        </div>
        <ThemeToggle />
      </div>

      <div className="panel">
        <span className="eyebrow">免費資格試算</span>
        <h1>只要回答 10 個問題，立即找出家人可申請的長照、看護與補助方案</h1>
        <p className="lede">
          依家人年齡、失智狀況、生活自理能力與經濟狀況，一次評估「外籍家庭看護工」「巴氏量表免評」「長照 2.0 服務」
          「住宿式機構補助」「身心障礙鑑定」「輔具及居家無障礙補助」六大方向的申請可能性，
          並自動整理個人化申請路線、應備文件清單與五種照護方案費用比較。
        </p>

        <div className="notice">
          📌 本工具僅根據您填答的資訊，依現行長照與外籍看護工申請的一般性規則，提供「可能性」方向參考，
          <b>並非正式資格審查結果</b>。實際資格認定仍以醫療機構專業評估、長期照顧管理中心（照管中心）評估
          及勞動部、地方政府主管機關最終審查為準。補助金額與地方政府方案可能逐年調整，請以最新公告為準。
        </div>

        <div className="feature-grid">
          <div className="feature"><b>六大資格試算</b>看護 / 長照2.0 / 機構補助 / 身障 / 輔具</div>
          <div className="feature"><b>個人化申請路線</b>第一步到最後一步，逐步指引</div>
          <div className="feature"><b>費用比較試算</b>五種照護方案的月支出估算</div>
          <div className="feature"><b>完整報告</b>文件清單、進度追蹤，可長期保存查閱</div>
        </div>

        <Link href="/quiz" className="btn btn-primary">開始測驗 →</Link>
      </div>

      <div className="footer-note">
        安心長照導航 是提供一般性資訊之工具，非醫療、法律或政府機關正式服務。<br />
        長照專線：1966（長期照顧管理中心）｜外籍勞工諮詢保護專線：1955
      </div>
    </div>
  );
}
