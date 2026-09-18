import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const metadata: Metadata = {
  title: "加密貨幣量化策略分析",
  description: "加密貨幣量化策略研究、回測與模擬投資組合分析平台（僅供教育與研究用途）",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant-TW">
      <body className="flex min-h-screen flex-col antialiased">
        <Providers>
          <SiteHeader />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
