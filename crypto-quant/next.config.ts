import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3"],
  async headers() {
    // 開發模式下 Next.js 的 Fast Refresh 需要 'unsafe-eval'，正式環境則採更嚴格的政策
    const scriptSrc =
      process.env.NODE_ENV === "production"
        ? "script-src 'self' 'unsafe-inline' https://s3.tradingview.com https://static.tradingview.com"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://s3.tradingview.com https://static.tradingview.com";
    // 嵌入 TradingView 圖表 Widget 需要額外放行其腳本、iframe 與資料連線來源網域，
    // 其餘資源仍維持僅限本站（'self'）的嚴格政策。
    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://s3.tradingview.com https://static.tradingview.com",
      "img-src 'self' data: https://*.tradingview.com",
      "connect-src 'self' https://*.tradingview.com wss://*.tradingview.com",
      "frame-src 'self' https://s.tradingview.com https://www.tradingview.com https://s3.tradingview.com https://static.tradingview.com",
      "frame-ancestors 'none'",
    ].join("; ");
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
