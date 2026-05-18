import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { member, user } from "@/server/db/schema/auth";
import { requireAuth } from "@/server/middleware/requireAuth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const canManageBarbers = ctx.role === "owner" || ctx.canCreateServices;
  if (!canManageBarbers) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { memberId } = await params;
  const body = await req.json();
  const { canCreateServices } = body as { canCreateServices?: boolean };

  if (typeof canCreateServices !== "boolean") {
    return NextResponse.json({ error: "canCreateServices must be a boolean" }, { status: 400 });
  }

  // Only owner can change canCreateServices — non-owners with canCreateServices can manage barbers but not grant permissions
  if (ctx.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [updated] = await db
    .update(member)
    .set({ canCreateServices })
    .where(and(eq(member.id, memberId), eq(member.organizationId, ctx.orgId)))
    .returning({ id: member.id });

  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { memberId } = await params;

  const [deleted] = await db
    .delete(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, ctx.orgId)))
    .returning({ id: member.id, userId: member.userId });

  if (!deleted) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Delete the user account entirely
  await db.delete(user).where(eq(user.id, deleted.userId));

  return NextResponse.json({ ok: true });
}
