import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { workingHours } from "@/server/db/schema/availability";
import { units } from "@/server/db/schema/units";
import { requireAuth } from "@/server/middleware/requireAuth";

/**
 * Resolve a unidade alvo. Se o cliente não informar unitId (single-unit ou
 * compatibilidade), usa a primeira unidade da org. Retorna null se o unitId
 * informado não pertencer à org.
 */
async function resolveUnitId(orgId: string, unitIdParam: string | null): Promise<string | null> {
  if (unitIdParam) {
    const [u] = await db
      .select({ id: units.id })
      .from(units)
      .where(and(eq(units.id, unitIdParam), eq(units.organizationId, orgId)))
      .limit(1);
    return u ? u.id : null;
  }
  const [first] = await db
    .select({ id: units.id })
    .from(units)
    .where(eq(units.organizationId, orgId))
    .orderBy(asc(units.position), asc(units.createdAt))
    .limit(1);
  return first ? first.id : null;
}

export async function GET(req: Request) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const profIdParam = searchParams.get("professionalId");
  const unitId = await resolveUnitId(ctx.orgId, searchParams.get("unitId"));

  // Owner can query any professional; member is always scoped to self
  const targetUserId =
    ctx.role === "owner" && profIdParam ? profIdParam : ctx.userId;

  const rows = await db
    .select()
    .from(workingHours)
    .where(
      and(
        eq(workingHours.organizationId, ctx.orgId),
        eq(workingHours.professionalId, targetUserId),
        unitId ? eq(workingHours.unitId, unitId) : undefined,
      ),
    )
    .orderBy(workingHours.dayOfWeek);

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  // body: { professionalId?, unitId?, hours: Array<{ dayOfWeek, startTime, endTime, ... }> }
  const targetUserId = ctx.role === "owner" && body.professionalId
    ? (body.professionalId as string)
    : ctx.userId;

  const unitId = await resolveUnitId(ctx.orgId, body.unitId ?? null);
  if (!unitId) {
    return NextResponse.json({ error: "unit_not_found" }, { status: 400 });
  }

  const hours = body.hours as Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    breakStartTime?: string | null;
    breakEndTime?: string | null;
  }>;

  if (!Array.isArray(hours)) {
    return NextResponse.json({ error: "hours must be an array" }, { status: 400 });
  }

  // Substitui os horários DESTE profissional NESTA unidade (preserva outras unidades).
  await db
    .delete(workingHours)
    .where(
      and(
        eq(workingHours.organizationId, ctx.orgId),
        eq(workingHours.professionalId, targetUserId),
        eq(workingHours.unitId, unitId),
      ),
    );

  if (hours.length > 0) {
    await db.insert(workingHours).values(
      hours.map((h) => {
        const hasBreak = Boolean(h.breakStartTime && h.breakEndTime);
        return {
          organizationId: ctx.orgId,
          unitId,
          professionalId: targetUserId,
          dayOfWeek: h.dayOfWeek,
          startTime: h.startTime,
          endTime: h.endTime,
          breakStartTime: hasBreak ? h.breakStartTime! : null,
          breakEndTime: hasBreak ? h.breakEndTime! : null,
        };
      }),
    );
  }

  return NextResponse.json({ ok: true });
}
