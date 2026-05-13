import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { member, user } from "@/server/db/schema/auth";
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

  const professionals = await db
    .select({ id: user.id, name: user.name })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, org.id))
    .orderBy(user.name);

  return NextResponse.json({
    members: [
      { id: "any", name: "Sem preferência" },
      ...professionals,
    ],
  });
}
