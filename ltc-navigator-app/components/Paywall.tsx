const REPORT_PRICE_TWD = Number(process.env.NEXT_PUBLIC_REPORT_PRICE_TWD || 299);

export default function Paywall({ reportId }: { reportId: string }) {
  return (
    <div className="paywall no-print">
      <div className="price">NT$ {REPORT_PRICE_TWD}</div>
      <h3>解鎖完整申請報告</h3>
      <p>
        免費結果已顯示六大資格方向的可能性總覽。付費解鎖後可看到：完整申請路線的每步詳細說明、
        應備文件清單（含送件單位與效期提醒）、送件前檢查表、申請進度追蹤，以及五種照護方案費用比較試算。
      </p>
      <form action="/api/checkout" method="POST">
        <input type="hidden" name="reportId" value={reportId} />
        <input type="email" name="email" placeholder="收據 Email（付款後用於查詢報告）" required />
        <div>
          <button className="btn-primary" type="submit">前往付款解鎖 →</button>
        </div>
      </form>
    </div>
  );
}
