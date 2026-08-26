import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { joinQueue, getQueueStatus } from "@/lib/queue";
import { errorResponse } from "@/lib/api";

async function loadEvent(slug: string) {
  const event = await db.event.findUnique({ where: { slug } });
  if (!event) throw new Error("NOT_FOUND_EVENT");
  return event;
}

export async function POST(_req: Request, ctx: RouteContext<"/api/events/[slug]/queue">) {
  try {
    const user = await requireUser();
    const { slug } = await ctx.params;
    const event = await loadEvent(slug);
    const ticket = await joinQueue(event.id, user.id);
    return NextResponse.json({ ticket });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND_EVENT") {
      return NextResponse.json({ error: "NOT_FOUND", message: "Event not found" }, { status: 404 });
    }
    return errorResponse(err);
  }
}

export async function GET(_req: Request, ctx: RouteContext<"/api/events/[slug]/queue">) {
  try {
    const user = await requireUser();
    const { slug } = await ctx.params;
    const event = await loadEvent(slug);
    const status = await getQueueStatus(event.id, user.id);
    return NextResponse.json({ status });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND_EVENT") {
      return NextResponse.json({ error: "NOT_FOUND", message: "Event not found" }, { status: 404 });
    }
    return errorResponse(err);
  }
}
