import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { buildCheckoutHtml, generateMerchantTradeNo } from "@/lib/ecpay";

const REPORT_PRICE_TWD = Number(process.env.REPORT_PRICE_TWD || 299);

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const reportId = String(form.get("reportId") || "");
  const email = String(form.get("email") || "").trim();

  if (!reportId) return NextResponse.json({ error: "reportId is required" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "請輸入有效的 Email" }, { status: 400 });
  }

  const store = getStore();
  const report = await store.getReport(reportId);
  if (!report) return NextResponse.json({ error: "report not found" }, { status: 404 });
  if (report.isPaid) {
    return NextResponse.redirect(new URL(`/report/${reportId}`, req.url));
  }

  const appUrl = process.env.APP_URL || req.nextUrl.origin;
  const merchantTradeNo = generateMerchantTradeNo();
  await store.createOrder(reportId, REPORT_PRICE_TWD, merchantTradeNo);

  const html = buildCheckoutHtml({
    merchantTradeNo,
    amountTwd: REPORT_PRICE_TWD,
    itemName: "安心長照導航完整報告",
    returnUrl: `${appUrl}/api/webhooks/ecpay`,
    clientBackUrl: `${appUrl}/report/${reportId}`,
  });

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
