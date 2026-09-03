import { randomBytes } from "crypto";
import ECPayPayment from "ecpay_aio_nodejs";

/**
 * Thin wrapper around `ecpay_aio_nodejs` (綠界 ECPay's official Node SDK).
 * We use the SDK rather than hand-rolling the CheckMacValue algorithm —
 * that checksum has famously fiddly .NET-style URL-encoding rules, and
 * getting it wrong either fails silently or (worse) accepts a forged
 * payment notification. The SDK's `helper.gen_chk_mac_value` is reused
 * on the receiving end (verifyEcpayCallback) for exactly that reason.
 *
 * Defaults below are ECPay's own published sandbox test 特店 credentials
 * (OperationMode "Test"), safe to commit and use out of the box against
 * https://payment-stage.ecpay.com.tw. Replace with your real 特店編號 /
 * HashKey / HashIV and set ECPAY_MODE=Production before going live —
 * see .env.example and README.md.
 */

function getClient() {
  const options = {
    OperationMode: process.env.ECPAY_MODE || "Test",
    MercProfile: {
      MerchantID: process.env.ECPAY_MERCHANT_ID || "2000132",
      HashKey: process.env.ECPAY_HASH_KEY || "5294y06JbISpM5x9",
      HashIV: process.env.ECPAY_HASH_IV || "v77hoKGq4kWxNNIS",
    },
    IgnorePayment: [],
    IsProjectContractor: false,
  };
  return new ECPayPayment(options);
}

/** ECPay requires MerchantTradeNo to be alphanumeric, <=20 chars, unique per merchant. */
export function generateMerchantTradeNo(): string {
  const stamp = Date.now().toString(36);
  const rand = randomBytes(4).toString("hex");
  return ("LTC" + stamp + rand).slice(0, 20);
}

function formatTaipeiDate(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}/${get("month")}/${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

export type CheckoutParams = {
  merchantTradeNo: string;
  amountTwd: number;
  itemName: string;
  returnUrl: string; // server-to-server webhook (must be a publicly reachable HTTPS URL)
  clientBackUrl: string; // browser redirect target after payment
};

/** Returns a self-submitting HTML `<form>` that POSTs the buyer to ECPay's checkout page. */
export function buildCheckoutHtml(params: CheckoutParams): string {
  const client = getClient();
  const base_param = {
    MerchantTradeNo: params.merchantTradeNo,
    MerchantTradeDate: formatTaipeiDate(new Date()),
    TotalAmount: String(Math.round(params.amountTwd)),
    TradeDesc: "安心長照導航 - 完整申請報告",
    ItemName: params.itemName,
    ReturnURL: params.returnUrl,
    ClientBackURL: params.clientBackUrl,
    ChoosePayment: "ALL",
  };
  return client.payment_client.aio_check_out_all(base_param, {});
}

export type EcpayCallback = {
  merchantTradeNo: string;
  ecpayTradeNo: string;
  rtnCode: string;
  isSuccess: boolean;
  isValid: boolean;
};

/** Verifies the CheckMacValue on an incoming ECPay server-to-server notification. */
export function verifyEcpayCallback(fields: Record<string, string>): EcpayCallback {
  const client = getClient();
  const { CheckMacValue, ...rest } = fields;
  let isValid = false;
  try {
    // EncryptType=1 (set in buildCheckoutHtml) means ECPay signs with SHA256
    // (64 hex chars); mode 0 (MD5, 32 chars) only appears on older/legacy
    // integrations. Detect from the received value's length, same as the
    // SDK's own `valid_chkmc_string` helper does, rather than hardcoding one.
    const mode = CheckMacValue?.length === 32 ? 0 : 1;
    const expected = client.payment_client.helper.gen_chk_mac_value(rest, mode);
    if (process.env.ECPAY_DEBUG) console.error("[ecpay debug]", { rest, mode, expected, received: CheckMacValue?.toUpperCase() });
    isValid = Boolean(CheckMacValue) && expected === CheckMacValue.toUpperCase();
  } catch (e) {
    if (process.env.ECPAY_DEBUG) console.error("[ecpay debug] threw", e);
    isValid = false;
  }
  return {
    merchantTradeNo: fields.MerchantTradeNo,
    ecpayTradeNo: fields.TradeNo,
    rtnCode: fields.RtnCode,
    isSuccess: fields.RtnCode === "1",
    isValid,
  };
}
