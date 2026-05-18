import { NextRequest, NextResponse } from "next/server";
import { and, eq, exists } from "drizzle-orm";

import { db } from "@/server/db";
import { member, user } from "@/server/db/schema/auth";
import { workingHours } from "@/server/db/schema/availability";
import { getOrgBySlug } from "@/server/services/tenant";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);

  if (!org) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Apenas barbeiros não-owner COM working_hours cadastrado
  const professionals = await db
    .select({ id: user.id, name: user.name })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(member.organizationId, org.id),
        // exclui owners (superadmin)
        and(
          eq(member.role, "member"),
          // exclui quem não tem working_hours
          exists(
            db
              .select({ id: workingHours.id })
              .from(workingHours)
              .where(
                and(
                  eq(workingHours.organizationId, org.id),
                  eq(workingHours.professionalId, user.id),
                ),
              )
              .limit(1),
          ),
        ),
      ),
    )
    .orderBy(user.name);

  return NextResponse.json({
    members: [{ id: "any", name: "Sem preferência" }, ...professionals],
  });
}
