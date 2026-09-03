import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { verifyEcpayCallback } from "@/lib/ecpay";

/**
 * ECPay's server-to-server payment notification (ReturnURL).
 * Must respond with the exact plain-text body "1|OK" or ECPay will retry
 * this callback on a schedule for up to ~7 days.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const fields: Record<string, string> = {};
  for (const [key, value] of form.entries()) fields[key] = String(value);

  const result = verifyEcpayCallback(fields);

  if (!result.isValid) {
    console.error("[ecpay webhook] CheckMacValue mismatch — possible forged notification", fields.MerchantTradeNo);
    return new NextResponse("0|CheckMacValue Error", { status: 400 });
  }

  if (result.isSuccess) {
    const store = getStore();
    const order = await store.getOrderByMerchantTradeNo(result.merchantTradeNo);
    if (!order) {
      console.error("[ecpay webhook] no matching order for", result.merchantTradeNo);
      return new NextResponse("0|Order Not Found", { status: 404 });
    }
    if (order.status !== "paid") {
      await store.markOrderPaid(result.merchantTradeNo, result.ecpayTradeNo);
    }
  } else {
    console.warn("[ecpay webhook] payment not successful, RtnCode=", result.rtnCode, result.merchantTradeNo);
  }

  return new NextResponse("1|OK", { headers: { "Content-Type": "text/plain" } });
}
