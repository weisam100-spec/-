"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";

type TicketTypeForm = { name: string; priceCents: number; totalQty: number; maxPerOrder: number };

const emptyTicketType = (): TicketTypeForm => ({ name: "", priceCents: 0, totalQty: 100, maxPerOrder: 4 });

export function NewEventForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [coverColor, setCoverColor] = useState("#6366f1");
  const [startAt, setStartAt] = useState("");
  const [saleStartAt, setSaleStartAt] = useState("");
  const [saleEndAt, setSaleEndAt] = useState("");
  const [queueEnabled, setQueueEnabled] = useState(true);
  const [admitBatchSize, setAdmitBatchSize] = useState(20);
  const [admitIntervalSec, setAdmitIntervalSec] = useState(5);
  const [holdMinutes, setHoldMinutes] = useState(10);
  const [ticketTypes, setTicketTypes] = useState<TicketTypeForm[]>([emptyTicketType()]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateTicketType(i: number, patch: Partial<TicketTypeForm>) {
    setTicketTypes((prev) => prev.map((tt, idx) => (idx === i ? { ...tt, ...patch } : tt)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ event: { id: string } }>("/api/admin/events", {
        method: "POST",
        body: JSON.stringify({
          title,
          slug,
          venue,
          description,
          coverColor,
          startAt: new Date(startAt).toISOString(),
          saleStartAt: new Date(saleStartAt).toISOString(),
          saleEndAt: new Date(saleEndAt).toISOString(),
          queueEnabled,
          admitBatchSize,
          admitIntervalSec,
          admitWindowMinutes: 5,
          holdMinutes,
          ticketTypes,
        }),
      });
      router.push(`/admin/events/${data.event.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "建立失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-bold">新增活動</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="活動名稱">
            <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </Field>
          <Field label="網址代稱 (slug)">
            <input
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="例如：summer-concert-2026"
              className={inputClass}
            />
          </Field>
          <Field label="場地">
            <input required value={venue} onChange={(e) => setVenue(e.target.value)} className={inputClass} />
          </Field>
          <Field label="封面顏色">
            <input type="color" value={coverColor} onChange={(e) => setCoverColor(e.target.value)} className="h-10 w-full rounded-md" />
          </Field>
        </div>

        <Field label="活動說明">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="演出時間">
            <input required type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className={inputClass} />
          </Field>
          <Field label="開賣開始">
            <input required type="datetime-local" value={saleStartAt} onChange={(e) => setSaleStartAt(e.target.value)} className={inputClass} />
          </Field>
          <Field label="開賣結束">
            <input required type="datetime-local" value={saleEndAt} onChange={(e) => setSaleEndAt(e.target.value)} className={inputClass} />
          </Field>
        </div>

        <div className="rounded-xl border border-black/10 p-4 dark:border-white/10">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={queueEnabled} onChange={(e) => setQueueEnabled(e.target.checked)} />
            啟用虛擬候位區（開賣時排隊依序放行，避免結帳頁被瞬間衝垮）
          </label>
          {queueEnabled && (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="每批放行人數">
                <input
                  type="number"
                  min={1}
                  value={admitBatchSize}
                  onChange={(e) => setAdmitBatchSize(Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
              <Field label="放行間隔（秒）">
                <input
                  type="number"
                  min={1}
                  value={admitIntervalSec}
                  onChange={(e) => setAdmitIntervalSec(Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
            </div>
          )}
          <div className="mt-3">
            <Field label="訂單保留時限（分鐘）">
              <input
                type="number"
                min={1}
                value={holdMinutes}
                onChange={(e) => setHoldMinutes(Number(e.target.value))}
                className={inputClass}
              />
            </Field>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">票種</h2>
            <button
              type="button"
              onClick={() => setTicketTypes((prev) => [...prev, emptyTicketType()])}
              className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
            >
              + 新增票種
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {ticketTypes.map((tt, i) => (
              <div key={i} className="grid gap-3 rounded-xl border border-black/10 p-3 sm:grid-cols-4 dark:border-white/10">
                <Field label="名稱">
                  <input
                    required
                    value={tt.name}
                    onChange={(e) => updateTicketType(i, { name: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="票價 (元)">
                  <input
                    required
                    type="number"
                    min={0}
                    value={tt.priceCents / 100}
                    onChange={(e) => updateTicketType(i, { priceCents: Math.round(Number(e.target.value) * 100) })}
                    className={inputClass}
                  />
                </Field>
                <Field label="總張數">
                  <input
                    required
                    type="number"
                    min={1}
                    value={tt.totalQty}
                    onChange={(e) => updateTicketType(i, { totalQty: Number(e.target.value) })}
                    className={inputClass}
                  />
                </Field>
                <Field label="每人限購">
                  <input
                    required
                    type="number"
                    min={1}
                    value={tt.maxPerOrder}
                    onChange={(e) => updateTicketType(i, { maxPerOrder: Number(e.target.value) })}
                    className={inputClass}
                  />
                </Field>
                {ticketTypes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setTicketTypes((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-left text-xs text-red-600 hover:underline dark:text-red-400 sm:col-span-4"
                  >
                    移除此票種
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "建立中…" : "建立活動"}
        </button>
      </form>
    </div>
  );
}

const inputClass = "mt-1 w-full rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
