import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { expireStaleOrders } from "@/lib/inventory";

export async function GET(_req: Request, ctx: RouteContext<"/api/events/[slug]">) {
  const { slug } = await ctx.params;
  const event = await db.event.findUnique({
    where: { slug },
    include: { ticketTypes: true },
  });
  if (!event) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Event not found" }, { status: 404 });
  }

  await expireStaleOrders(event.id);
  const fresh = await db.event.findUnique({ where: { slug }, include: { ticketTypes: true } });
  return NextResponse.json({ event: fresh });
}
