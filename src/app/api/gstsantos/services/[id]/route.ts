import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { services } from "@/server/db/schema/services";
import { serviceUnits, units } from "@/server/db/schema/units";
import { requireAuth } from "@/server/middleware/requireAuth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const canManageServices = ctx.role === "owner" || ctx.canCreateServices;
  if (!canManageServices) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const patch: Partial<{
    name: string;
    description: string | null;
    durationMinutes: number;
    price: string;
    isActive: boolean;
  }> = {};

  if ("name" in body) patch.name = body.name;
  if ("description" in body) patch.description = body.description;
  if ("durationMinutes" in body) patch.durationMinutes = body.durationMinutes;
  if ("price" in body) patch.price = body.price;
  if ("isActive" in body) patch.isActive = body.isActive;

  const unitPrices = Array.isArray(body.unitPrices)
    ? (body.unitPrices as { unitId: string; price: string }[])
    : null;

  if (Object.keys(patch).length === 0 && !unitPrices) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  // Garante que o serviço pertence à org.
  const [svc] = await db
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.id, id), eq(services.organizationId, ctx.orgId)))
    .limit(1);
  if (!svc) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (Object.keys(patch).length > 0) {
    await db.update(services).set(patch).where(eq(services.id, id));
  }

  // Atualiza preços por unidade (apenas unidades válidas da org).
  if (unitPrices && unitPrices.length > 0) {
    const validUnits = await db
      .select({ id: units.id })
      .from(units)
      .where(eq(units.organizationId, ctx.orgId));
    const validSet = new Set(validUnits.map((u) => u.id));
    for (const up of unitPrices) {
      if (!validSet.has(up.unitId)) continue;
      await db
        .insert(serviceUnits)
        .values({ serviceId: id, unitId: up.unitId, price: up.price })
        .onConflictDoUpdate({
          target: [serviceUnits.serviceId, serviceUnits.unitId],
          set: { price: up.price },
        });
    }
  }

  const [updated] = await db
    .select()
    .from(services)
    .where(eq(services.id, id))
    .limit(1);

  return NextResponse.json(updated);
}
