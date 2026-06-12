import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/server/db";
import { services } from "@/server/db/schema";
import { serviceUnits } from "@/server/db/schema/units";
import { getOrgBySlug } from "@/server/services/tenant";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);

  if (!org) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const unitId = req.nextUrl.searchParams.get("unitId");

  const rows = await db
    .select({
      id: services.id,
      name: services.name,
      description: services.description,
      durationMinutes: services.durationMinutes,
      price: services.price,
    })
    .from(services)
    .where(and(eq(services.organizationId, org.id), eq(services.isActive, true)))
    .orderBy(services.name);

  // Aplica preço por unidade quando informada (apenas serviços ativos na unidade).
  if (unitId && rows.length > 0) {
    const suRows = await db
      .select({
        serviceId: serviceUnits.serviceId,
        price: serviceUnits.price,
        isActive: serviceUnits.isActive,
      })
      .from(serviceUnits)
      .where(
        and(
          eq(serviceUnits.unitId, unitId),
          inArray(
            serviceUnits.serviceId,
            rows.map((r) => r.id),
          ),
        ),
      );
    const byId = new Map(suRows.map((s) => [s.serviceId, s]));
    const withUnit = rows
      .map((r) => {
        const su = byId.get(r.id);
        // Sem registro na unidade = serviço não oferecido ali → omite.
        if (!su) return null;
        if (!su.isActive) return null;
        return { ...r, price: su.price };
      })
      .filter((r): r is typeof rows[number] => r !== null);
    return NextResponse.json({ services: withUnit });
  }

  return NextResponse.json({ services: rows });
}
