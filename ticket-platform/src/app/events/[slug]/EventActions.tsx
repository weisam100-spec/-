"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function EventActions(props: {
  slug: string;
  isLoggedIn: boolean;
  queueEnabled: boolean;
  saleStartAt: string;
  saleEndAt: string;
  soldOut: boolean;
}) {
  const router = useRouter();
  const now = useNow();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saleStart = new Date(props.saleStartAt).getTime();
  const saleEnd = new Date(props.saleEndAt).getTime();
  const notStarted = now < saleStart;
  const ended = now > saleEnd;

  async function start() {
    if (!props.isLoggedIn) {
      router.push(`/login?next=${encodeURIComponent(`/events/${props.slug}`)}`);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (props.queueEnabled) {
        await apiFetch(`/api/events/${props.slug}/queue`, { method: "POST" });
        router.push(`/events/${props.slug}/queue`);
      } else {
        router.push(`/events/${props.slug}/checkout`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "發生錯誤，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  if (notStarted) {
    return (
      <div className="rounded-xl border border-black/10 p-4 text-center dark:border-white/10">
        <p className="text-sm text-black/60 dark:text-white/60">距離開賣還有</p>
        <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
          {formatCountdown(saleStart - now)}
        </p>
      </div>
    );
  }

  if (ended) {
    return (
      <button disabled className="w-full rounded-md bg-black/10 py-3 font-medium text-black/40 dark:bg-white/10 dark:text-white/40">
        售票已結束
      </button>
    );
  }

  if (props.soldOut) {
    return (
      <button disabled className="w-full rounded-md bg-black/10 py-3 font-medium text-black/40 dark:bg-white/10 dark:text-white/40">
        已售完
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={start}
        disabled={loading}
        className="w-full rounded-md bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading ? "處理中…" : props.queueEnabled ? "加入候位購票" : "立即購票"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
