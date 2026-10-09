import nodemailer from "nodemailer";
import { env } from "@/lib/env";
import type { SendResult } from "./telegram";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPassword } : undefined,
  });
  return transporter;
}

/**
 * 透過 SMTP 發送 Email 通知。需要先在 .env.local 設定 SMTP_HOST / SMTP_USER / SMTP_PASSWORD 等。
 * 若使用 Gmail，SMTP_PASSWORD 須為「應用程式密碼」，不可直接用登入密碼。
 */
export async function sendEmail(to: string, subject: string, text: string): Promise<SendResult> {
  if (!env.smtpHost) {
    return { ok: false, error: "尚未設定 SMTP_HOST，請於 .env.local 設定 SMTP 相關變數後重新啟動伺服器" };
  }
  if (!to) {
    return { ok: false, error: "尚未設定通知收件 Email" };
  }

  try {
    await getTransporter().sendMail({
      from: env.smtpFrom || env.smtpUser,
      to,
      subject,
      text,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Email 發送失敗" };
  }
}
