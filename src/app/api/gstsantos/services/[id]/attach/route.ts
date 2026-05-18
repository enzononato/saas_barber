import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { barberServices, services } from "@/server/db/schema/services";
import { requireAuth } from "@/server/middleware/requireAuth";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: serviceId } = await params;

  // Verify service belongs to this org
  const [svc] = await db
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.organizationId, ctx.orgId)))
    .limit(1);

  if (!svc) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db
    .insert(barberServices)
    .values({ memberId: ctx.memberId, serviceId })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: serviceId } = await params;

  await db
    .delete(barberServices)
    .where(and(eq(barberServices.memberId, ctx.memberId), eq(barberServices.serviceId, serviceId)));

  return NextResponse.json({ ok: true });
}
