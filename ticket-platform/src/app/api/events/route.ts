import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const events = await db.event.findMany({
    orderBy: { startAt: "asc" },
    include: { ticketTypes: true },
  });
  return NextResponse.json({ events });
}
