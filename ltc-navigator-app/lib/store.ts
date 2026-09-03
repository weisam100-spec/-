import { randomUUID } from "crypto";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Answers, ChecklistState, OrderRecord, ReportRecord } from "./types";
import { defaultCmsLevel } from "./rules";

export interface Store {
  createReport(answers: Answers, email: string | null): Promise<ReportRecord>;
  getReport(id: string): Promise<ReportRecord | null>;
  updateChecklist(id: string, kind: "doc" | "presubmit" | "progress", state: ChecklistState): Promise<void>;
  updateCmsLevel(id: string, level: number): Promise<void>;
  createOrder(reportId: string, amountTwd: number, merchantTradeNo: string): Promise<OrderRecord>;
  getOrderByMerchantTradeNo(merchantTradeNo: string): Promise<OrderRecord | null>;
  markOrderPaid(merchantTradeNo: string, ecpayTradeNo: string): Promise<ReportRecord | null>;
}

/**
 * FileStore — local-disk JSON store for `npm run dev` and for trying the
 * full quiz → paywall → payment flow without a Supabase project.
 *
 * NOT for production: most hosts (Vercel included) ship an ephemeral or
 * read-only filesystem outside /tmp, so writes here are lost on redeploy
 * or between serverless invocations. Configure SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY (see .env.example) to use SupabaseStore instead.
 */
class FileStore implements Store {
  private filePath: string;

  constructor() {
    this.filePath = path.join(process.cwd(), ".data", "db.json");
  }

  private async read(): Promise<{ reports: Record<string, ReportRecord>; orders: Record<string, OrderRecord> }> {
    const fs = await import("fs/promises");
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return { reports: {}, orders: {} };
    }
  }

  private async write(data: { reports: Record<string, ReportRecord>; orders: Record<string, OrderRecord> }) {
    const fs = await import("fs/promises");
    const path = await import("path");
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  async createReport(answers: Answers, email: string | null): Promise<ReportRecord> {
    const data = await this.read();
    const report: ReportRecord = {
      id: randomUUID(),
      email,
      answers,
      isPaid: false,
      createdAt: new Date().toISOString(),
      paidAt: null,
      docState: {},
      presubmitState: {},
      progressState: {},
      cmsLevel: defaultCmsLevel(answers),
    };
    data.reports[report.id] = report;
    await this.write(data);
    return report;
  }

  async getReport(id: string): Promise<ReportRecord | null> {
    const data = await this.read();
    return data.reports[id] ?? null;
  }

  async updateChecklist(id: string, kind: "doc" | "presubmit" | "progress", state: ChecklistState): Promise<void> {
    const data = await this.read();
    const report = data.reports[id];
    if (!report) return;
    if (kind === "doc") report.docState = state;
    if (kind === "presubmit") report.presubmitState = state;
    if (kind === "progress") report.progressState = state;
    await this.write(data);
  }

  async updateCmsLevel(id: string, level: number): Promise<void> {
    const data = await this.read();
    const report = data.reports[id];
    if (!report) return;
    report.cmsLevel = level;
    await this.write(data);
  }

  async createOrder(reportId: string, amountTwd: number, merchantTradeNo: string): Promise<OrderRecord> {
    const data = await this.read();
    const order: OrderRecord = {
      id: randomUUID(),
      reportId,
      amountTwd,
      status: "pending",
      merchantTradeNo,
      ecpayTradeNo: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    data.orders[order.id] = order;
    await this.write(data);
    return order;
  }

  async getOrderByMerchantTradeNo(merchantTradeNo: string): Promise<OrderRecord | null> {
    const data = await this.read();
    return Object.values(data.orders).find((o) => o.merchantTradeNo === merchantTradeNo) ?? null;
  }

  async markOrderPaid(merchantTradeNo: string, ecpayTradeNo: string): Promise<ReportRecord | null> {
    const data = await this.read();
    const order = Object.values(data.orders).find((o) => o.merchantTradeNo === merchantTradeNo);
    if (!order) return null;
    order.status = "paid";
    order.ecpayTradeNo = ecpayTradeNo;
    order.updatedAt = new Date().toISOString();
    const report = data.reports[order.reportId];
    if (report) {
      report.isPaid = true;
      report.paidAt = new Date().toISOString();
    }
    await this.write(data);
    return report ?? null;
  }
}

/** SupabaseStore — production store backed by the `reports` / `orders` tables in supabase/migrations/0001_init.sql. */
class SupabaseStore implements Store {
  private client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  }

  private rowToReport(row: Record<string, unknown>): ReportRecord {
    return {
      id: row.id as string,
      email: (row.email as string) ?? null,
      answers: (row.answers as Answers) ?? {},
      isPaid: Boolean(row.is_paid),
      createdAt: row.created_at as string,
      paidAt: (row.paid_at as string) ?? null,
      docState: (row.doc_state as ChecklistState) ?? {},
      presubmitState: (row.presubmit_state as ChecklistState) ?? {},
      progressState: (row.progress_state as ChecklistState) ?? {},
      cmsLevel: (row.cms_level as number) ?? 4,
    };
  }

  private rowToOrder(row: Record<string, unknown>): OrderRecord {
    return {
      id: row.id as string,
      reportId: row.report_id as string,
      amountTwd: row.amount_twd as number,
      status: row.status as OrderRecord["status"],
      merchantTradeNo: row.merchant_trade_no as string,
      ecpayTradeNo: (row.ecpay_trade_no as string) ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  async createReport(answers: Answers, email: string | null): Promise<ReportRecord> {
    const { data, error } = await this.client
      .from("reports")
      .insert({ answers, email, cms_level: defaultCmsLevel(answers) })
      .select()
      .single();
    if (error) throw error;
    return this.rowToReport(data);
  }

  async getReport(id: string): Promise<ReportRecord | null> {
    const { data, error } = await this.client.from("reports").select().eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? this.rowToReport(data) : null;
  }

  async updateChecklist(id: string, kind: "doc" | "presubmit" | "progress", state: ChecklistState): Promise<void> {
    const column = kind === "doc" ? "doc_state" : kind === "presubmit" ? "presubmit_state" : "progress_state";
    const { error } = await this.client.from("reports").update({ [column]: state }).eq("id", id);
    if (error) throw error;
  }

  async updateCmsLevel(id: string, level: number): Promise<void> {
    const { error } = await this.client.from("reports").update({ cms_level: level }).eq("id", id);
    if (error) throw error;
  }

  async createOrder(reportId: string, amountTwd: number, merchantTradeNo: string): Promise<OrderRecord> {
    const { data, error } = await this.client
      .from("orders")
      .insert({ report_id: reportId, amount_twd: amountTwd, merchant_trade_no: merchantTradeNo })
      .select()
      .single();
    if (error) throw error;
    return this.rowToOrder(data);
  }

  async getOrderByMerchantTradeNo(merchantTradeNo: string): Promise<OrderRecord | null> {
    const { data, error } = await this.client.from("orders").select().eq("merchant_trade_no", merchantTradeNo).maybeSingle();
    if (error) throw error;
    return data ? this.rowToOrder(data) : null;
  }

  async markOrderPaid(merchantTradeNo: string, ecpayTradeNo: string): Promise<ReportRecord | null> {
    const order = await this.getOrderByMerchantTradeNo(merchantTradeNo);
    if (!order) return null;
    const { error: orderErr } = await this.client
      .from("orders")
      .update({ status: "paid", ecpay_trade_no: ecpayTradeNo, updated_at: new Date().toISOString() })
      .eq("merchant_trade_no", merchantTradeNo);
    if (orderErr) throw orderErr;
    const { error: reportErr } = await this.client
      .from("reports")
      .update({ is_paid: true, paid_at: new Date().toISOString() })
      .eq("id", order.reportId);
    if (reportErr) throw reportErr;
    return this.getReport(order.reportId);
  }
}

let cachedStore: Store | null = null;

export function getStore(): Store {
  if (cachedStore) return cachedStore;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && key) {
    cachedStore = new SupabaseStore(url, key);
  } else {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[ltc-navigator] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set — falling back to FileStore, " +
        "which writes to the local filesystem and will NOT persist reliably on most production hosts. " +
        "Set both env vars (see .env.example) before going live."
      );
    }
    cachedStore = new FileStore();
  }
  return cachedStore;
}
