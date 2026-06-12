import { and, eq, exists } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { barberServices, services } from "@/server/db/schema/services";
import { member } from "@/server/db/schema/auth";
import { serviceUnits, units } from "@/server/db/schema/units";
import { requireAuth } from "@/server/middleware/requireAuth";

export async function GET() {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const allServices = await db
    .select({
      id: services.id,
      name: services.name,
      description: services.description,
      durationMinutes: services.durationMinutes,
      price: services.price,
      isActive: services.isActive,
      createdAt: services.createdAt,
    })
    .from(services)
    .where(eq(services.organizationId, ctx.orgId))
    .orderBy(services.name);

  // Preços por unidade (service_units), agrupados por serviço.
  const unitPriceRows = await db
    .select({
      serviceId: serviceUnits.serviceId,
      unitId: serviceUnits.unitId,
      price: serviceUnits.price,
      isActive: serviceUnits.isActive,
    })
    .from(serviceUnits)
    .innerJoin(units, eq(serviceUnits.unitId, units.id))
    .where(eq(units.organizationId, ctx.orgId));

  const pricesByService = new Map<
    string,
    { unitId: string; price: string; isActive: boolean }[]
  >();
  for (const r of unitPriceRows) {
    const arr = pricesByService.get(r.serviceId) ?? [];
    arr.push({ unitId: r.unitId, price: r.price, isActive: r.isActive });
    pricesByService.set(r.serviceId, arr);
  }
  const withUnitPrices = allServices.map((s) => ({
    ...s,
    unitPrices: pricesByService.get(s.id) ?? [],
  }));

  // For members, also return isAttached based on their memberId
  if (ctx.role === "member") {
    const attached = await db
      .select({ serviceId: barberServices.serviceId })
      .from(barberServices)
      .where(eq(barberServices.memberId, ctx.memberId));

    const attachedSet = new Set(attached.map((r) => r.serviceId));
    return NextResponse.json(
      withUnitPrices.map((s) => ({ ...s, isAttached: attachedSet.has(s.id) })),
    );
  }

  return NextResponse.json(withUnitPrices.map((s) => ({ ...s, isAttached: null })));
}

export async function POST(req: Request) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const canManageServices = ctx.role === "owner" || ctx.canCreateServices;
  if (!canManageServices) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, description, durationMinutes, price, unitPrices } = body as {
    name?: string;
    description?: string;
    durationMinutes?: number;
    price?: string;
    unitPrices?: { unitId: string; price: string }[];
  };

  if (!name || !durationMinutes || price === undefined) {
    return NextResponse.json({ error: "name, durationMinutes and price are required" }, { status: 400 });
  }

  const [created] = await db
    .insert(services)
    .values({
      organizationId: ctx.orgId,
      name,
      description: description ?? null,
      durationMinutes,
      price,
    })
    .returning();

  // Gera o preço por unidade para todas as unidades da org. Usa o preço
  // específico informado em unitPrices, ou o preço base como padrão.
  const orgUnits = await db
    .select({ id: units.id })
    .from(units)
    .where(eq(units.organizationId, ctx.orgId));
  if (orgUnits.length > 0) {
    const overrides = new Map((unitPrices ?? []).map((u) => [u.unitId, u.price]));
    await db
      .insert(serviceUnits)
      .values(
        orgUnits.map((u) => ({
          serviceId: created.id,
          unitId: u.id,
          price: overrides.get(u.id) ?? price,
        })),
      )
      .onConflictDoNothing({ target: [serviceUnits.serviceId, serviceUnits.unitId] });
  }

  return NextResponse.json(created, { status: 201 });
}
