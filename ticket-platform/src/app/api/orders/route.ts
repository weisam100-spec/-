import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createOrder } from "@/lib/inventory";
import { errorResponse } from "@/lib/api";

const schema = z.object({
  eventId: z.string().min(1),
  items: z
    .array(
      z.object({
        ticketTypeId: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = schema.parse(await request.json());
    const order = await createOrder(user.id, body.eventId, body.items);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION", message: err.issues[0]?.message }, { status: 400 });
    }
    return errorResponse(err);
  }
}
