import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { payOrder } from "@/lib/inventory";
import { errorResponse } from "@/lib/api";

export async function POST(_req: Request, ctx: RouteContext<"/api/orders/[id]/pay">) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const order = await payOrder(user.id, id);
    return NextResponse.json({ order });
  } catch (err) {
    return errorResponse(err);
  }
}
