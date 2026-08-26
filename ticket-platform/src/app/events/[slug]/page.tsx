import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { expireStaleOrders } from "@/lib/inventory";
import { formatCents, formatDateTime } from "@/lib/format";
import { EventActions } from "./EventActions";

export default async function EventPage(props: PageProps<"/events/[slug]">) {
  const { slug } = await props.params;

  const eventRow = await db.event.findUnique({ where: { slug } });
  if (!eventRow) notFound();
  await expireStaleOrders(eventRow.id);

  const event = await db.event.findUnique({ where: { slug }, include: { ticketTypes: true } });
  if (!event) notFound();

  const user = await getCurrentUser();
  const totalRemaining = event.ticketTypes.reduce((sum, tt) => sum + tt.remainingQty, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="h-40 rounded-xl" style={{ background: event.coverColor }} />
      <h1 className="mt-6 text-2xl font-bold">{event.title}</h1>
      <dl className="mt-2 space-y-1 text-sm text-black/60 dark:text-white/60">
        <div>📍 {event.venue}</div>
        <div>🗓️ 演出時間：{formatDateTime(event.startAt)}</div>
        <div>🛒 開賣時間：{formatDateTime(event.saleStartAt)} － {formatDateTime(event.saleEndAt)}</div>
      </dl>
      {event.description && <p className="mt-4 whitespace-pre-line text-sm">{event.description}</p>}

      <h2 className="mt-8 text-lg font-semibold">票種</h2>
      <div className="mt-3 divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
        {event.ticketTypes.map((tt) => (
          <div key={tt.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">{tt.name}</p>
              <p className="text-xs text-black/50 dark:text-white/50">每人限購 {tt.maxPerOrder} 張</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{formatCents(tt.priceCents)}</p>
              <p className="text-xs text-black/50 dark:text-white/50">
                {tt.remainingQty > 0 ? `剩餘 ${tt.remainingQty} 張` : "已售完"}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <EventActions
          slug={event.slug}
          isLoggedIn={!!user}
          queueEnabled={event.queueEnabled}
          saleStartAt={event.saleStartAt.toISOString()}
          saleEndAt={event.saleEndAt.toISOString()}
          soldOut={totalRemaining <= 0}
        />
      </div>
    </div>
  );
}
