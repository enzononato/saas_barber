import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

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

  const { memberId, serviceId, date } = parsed.data;

  const svcRows = await db
    .select({ durationMinutes: services.durationMinutes })
    .from(services)
    .where(
      and(
        eq(services.organizationId, org.id),
        eq(services.id, serviceId),
        eq(services.isActive, true),
      ),
    )
    .limit(1);

  if (svcRows.length === 0) {
    return NextResponse.json({ error: "service_not_found" }, { status: 404 });
  }

  const slots = await getAvailableSlots(org.id, memberId, svcRows[0].durationMinutes, date, org.timezone);

  return NextResponse.json({
    slots: slots.map((s) => ({
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
    })),
  });
}
