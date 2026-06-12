import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { member } from "@/server/db/schema/auth";
import { memberUnits, units } from "@/server/db/schema/units";
import { requireAuth } from "@/server/middleware/requireAuth";

/**
 * Substitui o conjunto de unidades em que um membro atua.
 * Body: { unitIds: string[] }
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { memberId } = await params;
  const body = (await req.json()) as { unitIds?: unknown };
  const unitIds = Array.isArray(body.unitIds)
    ? [...new Set(body.unitIds.filter((x): x is string => typeof x === "string"))]
    : null;
  if (!unitIds) {
    return NextResponse.json({ error: "unitIds_required" }, { status: 400 });
  }

  // Garante que o membro pertence à org do solicitante.
  const [m] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, ctx.orgId)))
    .limit(1);
  if (!m) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Valida que todas as unidades pertencem à org.
  if (unitIds.length > 0) {
    const valid = await db
      .select({ id: units.id })
      .from(units)
      .where(and(eq(units.organizationId, ctx.orgId), inArray(units.id, unitIds)));
    if (valid.length !== unitIds.length) {
      return NextResponse.json({ error: "invalid_unit" }, { status: 400 });
    }
  }

  // Substitui o conjunto: apaga os vínculos atuais e recria.
  await db.transaction(async (tx) => {
    await tx.delete(memberUnits).where(eq(memberUnits.memberId, memberId));
    if (unitIds.length > 0) {
      await tx
        .insert(memberUnits)
        .values(unitIds.map((unitId) => ({ memberId, unitId })))
        .onConflictDoNothing({ target: [memberUnits.memberId, memberUnits.unitId] });
    }
  });

  return NextResponse.json({ ok: true, unitIds });
}
