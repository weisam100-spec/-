import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents, formatDateTime } from "@/lib/format";

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "等待付款",
  PAID: "已付款",
  CANCELLED: "已取消",
  EXPIRED: "已逾時",
};

export default async function AdminEventDetailPage(props: PageProps<"/admin/events/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") redirect("/");

  const { id } = await props.params;
  const event = await db.event.findUnique({
    where: { id },
    include: {
      ticketTypes: true,
      orders: {
        orderBy: { createdAt: "desc" },
        include: { user: true, items: { include: { ticketType: true } } },
      },
    },
  });
  if (!event) notFound();

  const paidOrders = event.orders.filter((o) => o.status === "PAID");
  const revenueCents = paidOrders.reduce((s, o) => s + o.totalCents, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/admin" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
        ← 返回後台
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{event.title}</h1>
      <p className="text-sm text-black/60 dark:text-white/60">
        {event.venue} · {formatDateTime(event.startAt)}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="已付款訂單" value={String(paidOrders.length)} />
        <Stat label="營收" value={formatCents(revenueCents)} />
        <Stat label="候位機制" value={event.queueEnabled ? `啟用（每 ${event.admitIntervalSec}s 放行 ${event.admitBatchSize} 人）` : "停用"} />
      </div>

      <h2 className="mt-8 font-semibold">票種庫存</h2>
      <div className="mt-3 divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
        {event.ticketTypes.map((tt) => (
          <div key={tt.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <span>{tt.name}</span>
            <span>
              已售 {tt.totalQty - tt.remainingQty} / {tt.totalQty}（{formatCents(tt.priceCents)}）
            </span>
          </div>
        ))}
      </div>

      <h2 className="mt-8 font-semibold">訂單列表</h2>
      <div className="mt-3 divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
        {event.orders.map((order) => (
          <div key={order.id} className="px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{order.user.name}</span>
              <span>{ORDER_STATUS_LABEL[order.status] ?? order.status}</span>
            </div>
            <p className="text-black/50 dark:text-white/50">
              {order.items.map((i) => `${i.ticketType.name} x${i.quantity}`).join("、")} ·{" "}
              {formatCents(order.totalCents)} · {formatDateTime(order.createdAt)}
            </p>
          </div>
        ))}
        {event.orders.length === 0 && (
          <p className="px-4 py-3 text-sm text-black/50 dark:text-white/50">尚無訂單</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/10 p-4 dark:border-white/10">
      <p className="text-xs text-black/50 dark:text-white/50">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
