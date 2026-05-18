import { and, eq, exists } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { barberServices, services } from "@/server/db/schema/services";
import { member } from "@/server/db/schema/auth";
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

  // For members, also return isAttached based on their memberId
  if (ctx.role === "member") {
    const attached = await db
      .select({ serviceId: barberServices.serviceId })
      .from(barberServices)
      .where(eq(barberServices.memberId, ctx.memberId));

    const attachedSet = new Set(attached.map((r) => r.serviceId));
    return NextResponse.json(
      allServices.map((s) => ({ ...s, isAttached: attachedSet.has(s.id) })),
    );
  }

  return NextResponse.json(allServices.map((s) => ({ ...s, isAttached: null })));
}

export async function POST(req: Request) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const canManageServices = ctx.role === "owner" || ctx.canCreateServices;
  if (!canManageServices) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, description, durationMinutes, price } = body as {
    name?: string;
    description?: string;
    durationMinutes?: number;
    price?: string;
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

  return NextResponse.json(created, { status: 201 });
}
