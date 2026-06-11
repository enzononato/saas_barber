import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/server/db";
import { services } from "@/server/db/schema";
import { availabilityQuerySchema } from "@/lib/validators/booking";
import { getAvailableSlots } from "@/server/services/availability";
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

  const query = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = availabilityQuerySchema.safeParse(query);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_params", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { memberId, serviceId, serviceIds, date } = parsed.data;

  // Multi-serviço: soma a duração de todos os serviços selecionados
  const ids = serviceIds ? serviceIds.split(",") : [serviceId!];

  const svcRows = await db
    .select({ id: services.id, durationMinutes: services.durationMinutes })
    .from(services)
    .where(
      and(
        eq(services.organizationId, org.id),
        inArray(services.id, ids),
        eq(services.isActive, true),
      ),
    );

  if (svcRows.length !== ids.length) {
    return NextResponse.json({ error: "service_not_found" }, { status: 404 });
  }

  const totalDuration = svcRows.reduce((sum, s) => sum + s.durationMinutes, 0);

  const slots = await getAvailableSlots(org.id, memberId, totalDuration, date, org.timezone);

  return NextResponse.json({
    slots: slots.map((s) => ({
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
    })),
  });
}
