import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { workingHours } from "@/server/db/schema/availability";
import { requireAuth } from "@/server/middleware/requireAuth";

export async function GET() {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Owner sees all professionals; member sees their own
  const rows = ctx.role === "owner"
    ? await db
        .select()
        .from(workingHours)
        .where(eq(workingHours.organizationId, ctx.orgId))
        .orderBy(workingHours.professionalId, workingHours.dayOfWeek)
    : await db
        .select()
        .from(workingHours)
        .where(
          and(
            eq(workingHours.organizationId, ctx.orgId),
            eq(workingHours.professionalId, ctx.userId),
          ),
        )
        .orderBy(workingHours.dayOfWeek);

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  // body: { professionalId?: string, hours: Array<{ dayOfWeek, startTime, endTime }> }
  // If caller is a member, professionalId is forced to ctx.userId
  const targetUserId = ctx.role === "owner" && body.professionalId
    ? (body.professionalId as string)
    : ctx.userId;

  const hours = body.hours as Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;

  if (!Array.isArray(hours)) {
    return NextResponse.json({ error: "hours must be an array" }, { status: 400 });
  }

  // Replace all existing records for this professional in this org
  await db
    .delete(workingHours)
    .where(
      and(
        eq(workingHours.organizationId, ctx.orgId),
        eq(workingHours.professionalId, targetUserId),
      ),
    );

  if (hours.length > 0) {
    await db.insert(workingHours).values(
      hours.map((h) => ({
        organizationId: ctx.orgId,
        professionalId: targetUserId,
        dayOfWeek: h.dayOfWeek,
        startTime: h.startTime,
        endTime: h.endTime,
      })),
    );
  }

  return NextResponse.json({ ok: true });
}
