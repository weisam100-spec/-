"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatCents } from "@/lib/format";

type TicketType = {
  id: string;
  name: string;
  priceCents: number;
  remainingQty: number;
  maxPerOrder: number;
};
type EventDetail = { id: string; title: string; slug: string; ticketTypes: TicketType[] };

export default function CheckoutPage(props: PageProps<"/events/[slug]/checkout">) {
  const { slug } = use(props.params);
  const router = useRouter();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<{ event: EventDetail }>(`/api/events/${slug}`)
      .then((d) => setEvent(d.event))
      .catch((err) => setError(err instanceof ApiError ? err.message : "無法載入活動資料"));
  }, [slug]);

  function setQuantity(ticketTypeId: string, value: number, max: number) {
    setQty((prev) => ({ ...prev, [ticketTypeId]: Math.max(0, Math.min(max, value)) }));
  }

  const totalCents = event
    ? event.ticketTypes.reduce((sum, tt) => sum + (qty[tt.id] ?? 0) * tt.priceCents, 0)
    : 0;
  const totalQty = Object.values(qty).reduce((a, b) => a + b, 0);

  async function submit() {
    if (!event) return;
    setError(null);
    setSubmitting(true);
    try {
      const items = event.ticketTypes
        .filter((tt) => (qty[tt.id] ?? 0) > 0)
        .map((tt) => ({ ticketTypeId: tt.id, quantity: qty[tt.id] }));
      const data = await apiFetch<{ order: { id: string } }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({ eventId: event.id, items }),
      });
      router.push(`/orders/${data.order.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "UNAUTHENTICATED") {
        router.push(`/login?next=${encodeURIComponent(`/events/${slug}/checkout`)}`);
        return;
      }
      if (err instanceof ApiError && err.code === "QUEUE_REQUIRED") {
        router.push(`/events/${slug}/queue`);
        return;
      }
      setError(err instanceof ApiError ? err.message : "建立訂單失敗，請再試一次");
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !event) {
    return <div className="mx-auto max-w-lg px-4 py-16 text-center text-red-600 dark:text-red-400">{error}</div>;
  }

  if (!event) {
    return <div className="mx-auto max-w-lg px-4 py-16 text-center text-black/50 dark:text-white/50">載入中…</div>;
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-xl font-bold">{event.title}</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">請在時限內完成選票，逾時保留席位將被釋出。</p>

      <div className="mt-6 space-y-3">
        {event.ticketTypes.map((tt) => {
          const max = Math.min(tt.maxPerOrder, tt.remainingQty);
          const value = qty[tt.id] ?? 0;
          return (
            <div
              key={tt.id}
              className="flex items-center justify-between rounded-xl border border-black/10 px-4 py-3 dark:border-white/10"
            >
              <div>
                <p className="font-medium">{tt.name}</p>
                <p className="text-sm text-black/60 dark:text-white/60">{formatCents(tt.priceCents)}</p>
                <p className="text-xs text-black/40 dark:text-white/40">
                  {tt.remainingQty > 0 ? `剩餘 ${tt.remainingQty} 張，限購 ${tt.maxPerOrder} 張` : "已售完"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity(tt.id, value - 1, max)}
                  disabled={value <= 0}
                  className="h-8 w-8 rounded-md border border-black/15 disabled:opacity-30 dark:border-white/20"
                >
                  −
                </button>
                <span className="w-6 text-center tabular-nums">{value}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(tt.id, value + 1, max)}
                  disabled={value >= max}
                  className="h-8 w-8 rounded-md border border-black/15 disabled:opacity-30 dark:border-white/20"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-black/10 pt-4 dark:border-white/10">
        <span className="text-sm text-black/60 dark:text-white/60">共 {totalQty} 張</span>
        <span className="text-lg font-bold">{formatCents(totalCents)}</span>
      </div>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        onClick={submit}
        disabled={totalQty === 0 || submitting}
        className="mt-6 w-full rounded-md bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {submitting ? "建立訂單中…" : "確認選購"}
      </button>
    </div>
  );
}
