import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { expenses } from "@/server/db/schema/expenses";
import { requireAuth } from "@/server/middleware/requireAuth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;

  const deleted = await db
    .delete(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.organizationId, ctx.orgId)))
    .returning({ id: expenses.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
