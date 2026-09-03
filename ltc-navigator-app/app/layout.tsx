import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "安心長照導航",
  description: "10 題快速試算長照、外籍看護與補助申請方向，並產生個人化申請報告。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
