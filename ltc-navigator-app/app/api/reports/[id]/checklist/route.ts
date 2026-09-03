import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import type { ChecklistState } from "@/lib/types";

const VALID_KINDS = ["doc", "presubmit", "progress"] as const;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { kind?: string; state?: ChecklistState };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const kind = body.kind as (typeof VALID_KINDS)[number];
  if (!VALID_KINDS.includes(kind) || typeof body.state !== "object") {
    return NextResponse.json({ error: "kind and state are required" }, { status: 400 });
  }

  const store = getStore();
  const report = await store.getReport(id);
  if (!report) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Document / pre-submission / progress checklists are all part of the
  // paid report — only a paid report's state can be updated server-side.
  if (!report.isPaid) return NextResponse.json({ error: "report is not unlocked" }, { status: 403 });

  await store.updateChecklist(id, kind, body.state);
  return NextResponse.json({ ok: true });
}
