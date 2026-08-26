import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export default async function AdminDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") redirect("/");

  const events = await db.event.findMany({
    orderBy: { createdAt: "desc" },
    include: { ticketTypes: true, _count: { select: { orders: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">後台管理</h1>
        <Link href="/admin/events/new" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          + 新增活動
        </Link>
      </div>

      <div className="mt-8 space-y-3">
        {events.map((event) => {
          const totalQty = event.ticketTypes.reduce((s, t) => s + t.totalQty, 0);
          const remaining = event.ticketTypes.reduce((s, t) => s + t.remainingQty, 0);
          return (
            <Link
              key={event.id}
              href={`/admin/events/${event.id}`}
              className="block rounded-xl border border-black/10 px-4 py-3 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium">{event.title}</p>
                <p className="text-sm text-black/60 dark:text-white/60">{event._count.orders} 筆訂單</p>
              </div>
              <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                開賣 {formatDateTime(event.saleStartAt)} · 已售出 {totalQty - remaining}/{totalQty}
                {event.queueEnabled ? " · 候位機制已啟用" : ""}
              </p>
            </Link>
          );
        })}
        {events.length === 0 && <p className="text-black/50 dark:text-white/50">尚未建立任何活動。</p>}
      </div>
    </div>
  );
}
