import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { errorResponse } from "@/lib/api";

const ticketTypeSchema = z.object({
  name: z.string().min(1).max(60),
  priceCents: z.number().int().nonnegative(),
  totalQty: z.number().int().positive(),
  maxPerOrder: z.number().int().positive().default(4),
});

const schema = z.object({
  title: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens"),
  description: z.string().max(2000).default(""),
  venue: z.string().min(1).max(120),
  coverColor: z.string().max(20).default("#6366f1"),
  startAt: z.string().datetime(),
  saleStartAt: z.string().datetime(),
  saleEndAt: z.string().datetime(),
  queueEnabled: z.boolean().default(true),
  admitBatchSize: z.number().int().positive().default(20),
  admitIntervalSec: z.number().int().positive().default(5),
  admitWindowMinutes: z.number().int().positive().default(5),
  holdMinutes: z.number().int().positive().default(10),
  ticketTypes: z.array(ticketTypeSchema).min(1),
});

export async function GET() {
  try {
    await requireAdmin();
    const events = await db.event.findMany({
      orderBy: { createdAt: "desc" },
      include: { ticketTypes: true, _count: { select: { orders: true } } },
    });
    return NextResponse.json({ events });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = schema.parse(await request.json());

    const existing = await db.event.findUnique({ where: { slug: body.slug } });
    if (existing) {
      return NextResponse.json({ error: "SLUG_TAKEN", message: "Slug already in use" }, { status: 409 });
    }

    const event = await db.event.create({
      data: {
        title: body.title,
        slug: body.slug,
        description: body.description,
        venue: body.venue,
        coverColor: body.coverColor,
        startAt: new Date(body.startAt),
        saleStartAt: new Date(body.saleStartAt),
        saleEndAt: new Date(body.saleEndAt),
        queueEnabled: body.queueEnabled,
        admitBatchSize: body.admitBatchSize,
        admitIntervalSec: body.admitIntervalSec,
        admitWindowMinutes: body.admitWindowMinutes,
        holdMinutes: body.holdMinutes,
        organizerId: admin.id,
        ticketTypes: {
          create: body.ticketTypes.map((tt) => ({
            name: tt.name,
            priceCents: tt.priceCents,
            totalQty: tt.totalQty,
            remainingQty: tt.totalQty,
            maxPerOrder: tt.maxPerOrder,
          })),
        },
      },
      include: { ticketTypes: true },
    });

    return NextResponse.json({ event });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION", message: err.issues[0]?.message }, { status: 400 });
    }
    return errorResponse(err);
  }
}
