"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatCents } from "@/lib/format";

type Order = {
  id: string;
  status: "PENDING" | "PAID" | "CANCELLED" | "EXPIRED";
  totalCents: number;
  expiresAt: string;
  event: { title: string; slug: string };
  items: { quantity: number; unitCents: number; ticketType: { name: string } }[];
};

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<Order["status"], string> = {
  PENDING: "等待付款",
  PAID: "已完成付款",
  CANCELLED: "已取消",
  EXPIRED: "保留時限已過期",
};

export default function OrderPage(props: PageProps<"/orders/[id]">) {
  const { id } = use(props.params);
  const router = useRouter();
  const now = useNow();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await apiFetch<{ order: Order }>(`/api/orders/${id}`);
        if (!cancelled) setOrder(data.order);
      } catch (err) {
        if (err instanceof ApiError && err.code === "UNAUTHENTICATED") {
          router.push(`/login?next=${encodeURIComponent(`/orders/${id}`)}`);
          return;
        }
        if (!cancelled) setError(err instanceof ApiError ? err.message : "無法載入訂單");
      }
    }
    load();
    const interval = order?.status === "PENDING" ? setInterval(load, 3000) : undefined;
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, order?.status]);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ order: Order }>(`/api/orders/${id}/pay`, { method: "POST" });
      setOrder(data.order);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "付款失敗");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/orders/${id}/cancel`, { method: "POST" });
      const data = await apiFetch<{ order: Order }>(`/api/orders/${id}`);
      setOrder(data.order);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "取消失敗");
    } finally {
      setBusy(false);
    }
  }

  if (error && !order) {
    return <div className="mx-auto max-w-lg px-4 py-16 text-center text-red-600 dark:text-red-400">{error}</div>;
  }
  if (!order) {
    return <div className="mx-auto max-w-lg px-4 py-16 text-center text-black/50 dark:text-white/50">載入中…</div>;
  }

  const remainMs = new Date(order.expiresAt).getTime() - now;

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-xl font-bold">{order.event.title}</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">訂單編號：{order.id}</p>

      <div className="mt-4 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <p className="font-semibold">{STATUS_LABEL[order.status]}</p>
        {order.status === "PENDING" && (
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            請於 <span className="font-mono font-semibold tabular-nums">{formatCountdown(remainMs)}</span> 內完成付款，逾時席位將自動釋出。
          </p>
        )}
      </div>

      <div className="mt-4 divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
        {order.items.map((item, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
            <span>
              {item.ticketType.name} × {item.quantity}
            </span>
            <span>{formatCents(item.unitCents * item.quantity)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-3 font-semibold">
          <span>總計</span>
          <span>{formatCents(order.totalCents)}</span>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {order.status === "PENDING" && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={pay}
            disabled={busy || remainMs <= 0}
            className="flex-1 rounded-md bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? "處理中…" : "模擬付款"}
          </button>
          <button
            onClick={cancel}
            disabled={busy}
            className="rounded-md border border-black/15 px-4 py-3 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
          >
            取消訂單
          </button>
        </div>
      )}

      {order.status === "PAID" && (
        <p className="mt-6 rounded-md bg-emerald-500/15 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          🎉 付款成功！票券已確認。
        </p>
      )}

      <Link href={`/events/${order.event.slug}`} className="mt-6 block text-center text-sm text-indigo-600 hover:underline dark:text-indigo-400">
        返回活動頁面
      </Link>
    </div>
  );
}
