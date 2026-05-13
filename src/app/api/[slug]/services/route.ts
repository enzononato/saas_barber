import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { services } from "@/server/db/schema";
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

  return NextResponse.json({ services: rows });
}
