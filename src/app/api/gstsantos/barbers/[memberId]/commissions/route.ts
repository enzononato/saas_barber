import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { member } from "@/server/db/schema/auth";
import { barberServices, services } from "@/server/db/schema/services";
import { requireAuth } from "@/server/middleware/requireAuth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { memberId } = await params;

  // Confirm member belongs to this org
  const [m] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, ctx.orgId)))
    .limit(1);
  if (!m) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // List ALL active services + commission_pct if attached
  const rows = await db
    .select({
      serviceId: services.id,
      serviceName: services.name,
      servicePrice: services.price,
      attachedId: barberServices.id,
      commissionPct: barberServices.commissionPct,
    })
    .from(services)
    .leftJoin(
      barberServices,
      and(eq(barberServices.serviceId, services.id), eq(barberServices.memberId, memberId)),
    )
    .where(and(eq(services.organizationId, ctx.orgId), eq(services.isActive, true)))
    .orderBy(services.name);

  return NextResponse.json(
    rows.map((r) => ({
      serviceId: r.serviceId,
      serviceName: r.serviceName,
      servicePrice: r.servicePrice,
      attached: r.attachedId !== null,
      commissionPct: r.commissionPct ?? "0",
    })),
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { memberId } = await params;
  const body = (await req.json()) as {
    commissions?: Array<{ serviceId: string; commissionPct: number }>;
  };

  if (!Array.isArray(body.commissions)) {
    return NextResponse.json({ error: "commissions array required" }, { status: 400 });
  }

  // Confirm member belongs to this org
  const [m] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, ctx.orgId)))
    .limit(1);
  if (!m) return NextResponse.json({ error: "not_found" }, { status: 404 });

  for (const c of body.commissions) {
    if (
      typeof c.serviceId !== "string" ||
      typeof c.commissionPct !== "number" ||
      c.commissionPct < 0 ||
      c.commissionPct > 100
    ) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    // Confirm service belongs to org
    const [svc] = await db
      .select({ id: services.id })
      .from(services)
      .where(and(eq(services.id, c.serviceId), eq(services.organizationId, ctx.orgId)))
      .limit(1);
    if (!svc) continue;

    // Check if already attached
    const [existing] = await db
      .select({ id: barberServices.id })
      .from(barberServices)
      .where(
        and(eq(barberServices.memberId, memberId), eq(barberServices.serviceId, c.serviceId)),
      )
      .limit(1);

    if (existing) {
      await db
        .update(barberServices)
        .set({ commissionPct: c.commissionPct.toFixed(2) })
        .where(eq(barberServices.id, existing.id));
    } else {
      await db.insert(barberServices).values({
        memberId,
        serviceId: c.serviceId,
        commissionPct: c.commissionPct.toFixed(2),
      });
    }
  }

  return NextResponse.json({ ok: true });
}
