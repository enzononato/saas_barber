import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { appointments } from "@/server/db/schema";
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

  // Look up the member's userId first (without deleting yet)
  const [target] = await db
    .select({ userId: member.userId })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, ctx.orgId)))
    .limit(1);

  if (!target) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Can't delete yourself
  if (target.userId === ctx.userId) {
    return NextResponse.json({ error: "cannot_delete_self" }, { status: 409 });
  }

  // Block deletion if barber has any appointments (history must be preserved)
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(appointments)
    .where(
      and(
        eq(appointments.organizationId, ctx.orgId),
        eq(appointments.professionalId, target.userId),
      ),
    );

  if (count > 0) {
    return NextResponse.json(
      { error: "has_appointments", count },
      { status: 409 },
    );
  }

  await db
    .delete(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, ctx.orgId)));

  // user delete cascades to member, session, account
  await db.delete(user).where(eq(user.id, target.userId));

  return NextResponse.json({ ok: true });
}
