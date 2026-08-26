import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { cancelOrder } from "@/lib/inventory";
import { errorResponse } from "@/lib/api";

export async function POST(_req: Request, ctx: RouteContext<"/api/orders/[id]/cancel">) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    await cancelOrder(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
