import { NextRequest, NextResponse } from "next/server";
import { and, eq, exists } from "drizzle-orm";

import { db } from "@/server/db";
import { member, user } from "@/server/db/schema/auth";
import { workingHours } from "@/server/db/schema/availability";
import { memberUnits } from "@/server/db/schema/units";
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

  const professionals = await db
    .select({ id: user.id, name: user.name })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(member.organizationId, org.id),
        eq(member.isBarber, true),
        // Barbeiros vinculados à unidade escolhida (member_units).
        unitId
          ? exists(
              db
                .select({ id: memberUnits.id })
                .from(memberUnits)
                .where(
                  and(
                    eq(memberUnits.memberId, member.id),
                    eq(memberUnits.unitId, unitId),
                  ),
                )
                .limit(1),
            )
          : undefined,
        exists(
          db
            .select({ id: workingHours.id })
            .from(workingHours)
            .where(
              and(
                eq(workingHours.organizationId, org.id),
                eq(workingHours.professionalId, user.id),
                unitId ? eq(workingHours.unitId, unitId) : undefined,
              ),
            )
            .limit(1),
        ),
      ),
    )
    .orderBy(user.name);

  return NextResponse.json({
    members: [{ id: "any", name: "Sem preferência" }, ...professionals],
  });
}
