import { and, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/server/db";
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
