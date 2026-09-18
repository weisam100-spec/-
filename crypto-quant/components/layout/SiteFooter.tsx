export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--color-border)] py-6">
      <div className="mx-auto max-w-7xl px-4 text-xs text-[var(--color-text-muted)]">
        <p>
          本網站僅供資料分析、策略研究與教育用途，不構成投資建議、招攬或保證獲利。加密貨幣價格波動劇烈，使用者可能損失全部本金。歷史回測結果不代表未來績效。
        </p>
        <p className="mt-2">資料來源：Binance 公開市場 API（現貨）。時區顯示：Asia/Taipei。</p>
      </div>
    </footer>
  );
}
