import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { errorResponse } from "@/lib/api";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    const user = await db.user.findUnique({ where: { email: body.email } });
    const valid = user ? await verifyPassword(body.password, user.passwordHash) : false;

    if (!user || !valid) {
      return NextResponse.json(
        { error: "INVALID_CREDENTIALS", message: "Incorrect email or password" },
        { status: 401 },
      );
    }

    await createSession(user.id);
    return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION", message: err.issues[0]?.message }, { status: 400 });
    }
    return errorResponse(err);
  }
}
