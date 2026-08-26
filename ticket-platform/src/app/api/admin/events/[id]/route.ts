import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { errorResponse } from "@/lib/api";

export async function GET(_req: Request, ctx: RouteContext<"/api/admin/events/[id]">) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
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
    if (!event) return NextResponse.json({ error: "NOT_FOUND", message: "Event not found" }, { status: 404 });
    return NextResponse.json({ event });
  } catch (err) {
    return errorResponse(err);
  }
}
