import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import type { Answers } from "@/lib/types";

export async function POST(req: NextRequest) {
  let body: { answers?: Answers };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body.answers || typeof body.answers !== "object") {
    return NextResponse.json({ error: "answers is required" }, { status: 400 });
  }
  const store = getStore();
  const report = await store.createReport(body.answers, null);
  return NextResponse.json({ id: report.id });
}
