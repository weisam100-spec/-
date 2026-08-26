import { NextResponse } from "next/server";
import { OrderError } from "@/lib/inventory";

export function errorResponse(err: unknown) {
  if (err instanceof OrderError) {
    const status =
      err.code === "NOT_FOUND"
        ? 404
        : err.code === "SOLD_OUT" || err.code === "QUEUE_REQUIRED"
          ? 409
          : 400;
    return NextResponse.json({ error: err.code, message: err.message }, { status });
  }
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "UNAUTHENTICATED", message: "Please log in" }, { status: 401 });
  }
  if (err instanceof Error && err.message === "FORBIDDEN") {
    return NextResponse.json({ error: "FORBIDDEN", message: "Admins only" }, { status: 403 });
  }
  console.error(err);
  return NextResponse.json({ error: "INTERNAL", message: "Something went wrong" }, { status: 500 });
}
