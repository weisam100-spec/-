import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { expireStaleOrders } from "@/lib/inventory";
import { errorResponse } from "@/lib/api";

export async function GET(_req: Request, ctx: RouteContext<"/api/orders/[id]">) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const order = await db.order.findUnique({ where: { id } });
    if (order?.status === "PENDING") await expireStaleOrders(order.eventId);

    const fresh = await db.order.findUnique({
      where: { id },
      include: { items: { include: { ticketType: true } }, event: true },
    });
    if (!fresh || fresh.userId !== user.id) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Order not found" }, { status: 404 });
    }
    return NextResponse.json({ order: fresh });
  } catch (err) {
    return errorResponse(err);
  }
}
