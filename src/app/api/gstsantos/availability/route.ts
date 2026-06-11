import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/server/db";
import { services } from "@/server/db/schema/services";
import { organization } from "@/server/db/schema/auth";
import { requireAuth } from "@/server/middleware/requireAuth";
import { getSlotsForProfessional } from "@/server/services/availability";

/**
 * Slots livres para agendamento manual pelo painel.
 * ?professionalId=&serviceIds=a,b,c&date=YYYY-MM-DD
 */
export async function GET(req: Request) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const professionalId = searchParams.get("professionalId");
  const serviceIdsParam = searchParams.get("serviceIds");
  const date = searchParams.get("date");

  if (!professionalId || !serviceIdsParam || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  // Barbeiro comum só consulta a própria agenda
  if (ctx.role === "member" && professionalId !== ctx.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const ids = serviceIdsParam.split(",").filter(Boolean);
  if (ids.length === 0 || ids.length > 5) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  const svcRows = await db
    .select({ id: services.id, durationMinutes: services.durationMinutes })
    .from(services)
    .where(
      and(
        eq(services.organizationId, ctx.orgId),
        inArray(services.id, ids),
        eq(services.isActive, true),
      ),
    );

  if (svcRows.length !== ids.length) {
    return NextResponse.json({ error: "service_not_found" }, { status: 404 });
  }

  const totalDuration = svcRows.reduce((sum, s) => sum + s.durationMinutes, 0);

  const [org] = await db
    .select({ timezone: organization.timezone })
    .from(organization)
    .where(eq(organization.id, ctx.orgId))
    .limit(1);

  const slots = await getSlotsForProfessional(
    ctx.orgId,
    professionalId,
    totalDuration,
    date,
    org?.timezone ?? "America/Sao_Paulo",
  );

  return NextResponse.json({
    slots: slots.map((s) => ({
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
    })),
    totalDuration,
  });
}
