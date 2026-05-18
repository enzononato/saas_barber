import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { timeExceptions } from "@/server/db/schema/availability";
import { requireAuth } from "@/server/middleware/requireAuth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const conditions = [
    eq(timeExceptions.id, id),
    eq(timeExceptions.organizationId, ctx.orgId),
  ];

  // Members can only delete their own
  if (ctx.role === "member") {
    conditions.push(eq(timeExceptions.professionalId, ctx.userId));
  }

  const [deleted] = await db
    .delete(timeExceptions)
    .where(and(...conditions))
    .returning({ id: timeExceptions.id });

  if (!deleted) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
