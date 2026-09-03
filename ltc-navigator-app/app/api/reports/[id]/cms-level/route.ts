import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { level?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (typeof body.level !== "number" || body.level < 2 || body.level > 8) {
    return NextResponse.json({ error: "level must be an integer between 2 and 8" }, { status: 400 });
  }

  const store = getStore();
  const report = await store.getReport(id);
  if (!report) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!report.isPaid) return NextResponse.json({ error: "report is not unlocked" }, { status: 403 });

  await store.updateCmsLevel(id, body.level);
  return NextResponse.json({ ok: true });
}
