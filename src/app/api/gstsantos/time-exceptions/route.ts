import { and, eq, gt, inArray, lt } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { appointments } from "@/server/db/schema";
import { timeExceptions } from "@/server/db/schema/availability";
import { requireAuth } from "@/server/middleware/requireAuth";

export async function GET() {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();

  const rows = ctx.role === "owner"
    ? await db
        .select()
        .from(timeExceptions)
        .where(
          and(
            eq(timeExceptions.organizationId, ctx.orgId),
            gt(timeExceptions.startsAt, now),
          ),
        )
        .orderBy(timeExceptions.startsAt)
    : await db
        .select()
        .from(timeExceptions)
        .where(
          and(
            eq(timeExceptions.organizationId, ctx.orgId),
            eq(timeExceptions.professionalId, ctx.userId),
            gt(timeExceptions.startsAt, now),
          ),
        )
        .orderBy(timeExceptions.startsAt);

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { startsAt, endsAt, reason } = body as {
    startsAt?: string;
    endsAt?: string;
    reason?: string;
  };

  if (!startsAt || !endsAt) {
    return NextResponse.json({ error: "startsAt and endsAt are required" }, { status: 400 });
  }

  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (start >= end) {
    return NextResponse.json({ error: "startsAt must be before endsAt" }, { status: 400 });
  }

  const targetUserId = ctx.role === "owner" && body.professionalId
    ? (body.professionalId as string)
    : ctx.userId;

  // Bloquear se existe appointment SCHEDULED no intervalo da exceção
  const conflicts = await db
    .select({ id: appointments.id, startsAt: appointments.startsAt })
    .from(appointments)
    .where(
      and(
        eq(appointments.organizationId, ctx.orgId),
        eq(appointments.professionalId, targetUserId),
        inArray(appointments.status, ["SCHEDULED"]),
        lt(appointments.startsAt, end),
        gt(appointments.endsAt, start),
      ),
    );

  if (conflicts.length > 0) {
    return NextResponse.json(
      { error: "has_conflicting_appointments", count: conflicts.length },
      { status: 409 },
    );
  }

  const [created] = await db
    .insert(timeExceptions)
    .values({
      organizationId: ctx.orgId,
      professionalId: targetUserId,
      startsAt: start,
      endsAt: end,
      reason: reason ?? null,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
