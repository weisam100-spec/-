import Link from "next/link";
import { db } from "@/lib/db";
import { formatCents, formatDateTime } from "@/lib/format";

// Ticket counts and sale windows change constantly; never serve a stale
// prerendered snapshot of this list.
export const dynamic = "force-dynamic";

function saleStatus(event: { saleStartAt: Date; saleEndAt: Date; ticketTypes: { remainingQty: number }[] }) {
  const now = new Date();
  const totalRemaining = event.ticketTypes.reduce((sum, tt) => sum + tt.remainingQty, 0);
  if (now < event.saleStartAt) return { label: "即將開賣", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
  if (now > event.saleEndAt) return { label: "已結束", tone: "bg-black/10 text-black/50 dark:bg-white/10 dark:text-white/50" };
  if (totalRemaining <= 0) return { label: "已售完", tone: "bg-red-500/15 text-red-600 dark:text-red-400" };
  return { label: "熱賣中", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" };
}

export default async function HomePage() {
  const events = await db.event.findMany({
    orderBy: { startAt: "asc" },
    include: { ticketTypes: true },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold">近期活動</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        選擇活動查看詳情；熱門場次開賣時會進入虛擬候位區，依序放行購票。
      </p>

      {events.length === 0 ? (
        <p className="mt-10 text-black/50 dark:text-white/50">目前沒有活動，請至後台管理新增。</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {events.map((event) => {
            const status = saleStatus(event);
            const minPrice = Math.min(...event.ticketTypes.map((tt) => tt.priceCents));
            return (
              <Link
                key={event.id}
                href={`/events/${event.slug}`}
                className="group overflow-hidden rounded-xl border border-black/10 transition hover:shadow-lg dark:border-white/10"
              >
                <div className="h-28" style={{ background: event.coverColor }} />
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      {event.title}
                    </h2>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.tone}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-black/60 dark:text-white/60">{event.venue}</p>
                  <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                    {formatDateTime(event.startAt)}
                  </p>
                  <p className="mt-3 text-sm font-medium">
                    {Number.isFinite(minPrice) ? `${formatCents(minPrice)} 起` : "票價未定"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
