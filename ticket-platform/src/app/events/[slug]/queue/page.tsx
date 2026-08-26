"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";

type QueueStatus = {
  status: "WAITING" | "ADMITTED" | "EXPIRED" | "USED";
  position: number;
  peopleAhead: number;
  expiresAt: string | null;
} | null;

export default function QueuePage(props: PageProps<"/events/[slug]/queue">) {
  const { slug } = use(props.params);
  const router = useRouter();
  const [status, setStatus] = useState<QueueStatus>(null);
  const [error, setError] = useState<string | null>(null);
  const redirected = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await apiFetch<{ status: QueueStatus }>(`/api/events/${slug}/queue`);
        if (cancelled) return;
        setStatus(data.status);
        if (data.status?.status === "ADMITTED" && !redirected.current) {
          redirected.current = true;
          router.push(`/events/${slug}/checkout`);
        }
      } catch (err) {
        if (err instanceof ApiError && err.code === "UNAUTHENTICATED") {
          router.push(`/login?next=${encodeURIComponent(`/events/${slug}/queue`)}`);
          return;
        }
        if (!cancelled) setError(err instanceof ApiError ? err.message : "無法取得候位狀態");
      }
    }

    poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [slug, router]);

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center text-black/50 dark:text-white/50">
        正在加入候位…
      </div>
    );
  }

  if (status.status === "EXPIRED") {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-lg font-semibold">候位資格已逾時</p>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">請重新整理頁面以再次加入候位。</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500"
        >
          重新加入候位
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <div className="h-16 w-16 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      <h1 className="mt-6 text-xl font-bold">您正在候位區排隊</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        請勿關閉此頁面，系統會依序自動放行進入購票頁。
      </p>
      <p className="mt-6 text-4xl font-bold tabular-nums">{status.peopleAhead}</p>
      <p className="text-sm text-black/50 dark:text-white/50">人排在您前面</p>
    </div>
  );
}
