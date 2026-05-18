import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { services } from "@/server/db/schema/services";
import { requireAuth } from "@/server/middleware/requireAuth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const canManageServices = ctx.role === "owner" || ctx.canCreateServices;
  if (!canManageServices) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const patch: Partial<{
    name: string;
    description: string | null;
    durationMinutes: number;
    price: string;
    isActive: boolean;
  }> = {};

  if ("name" in body) patch.name = body.name;
  if ("description" in body) patch.description = body.description;
  if ("durationMinutes" in body) patch.durationMinutes = body.durationMinutes;
  if ("price" in body) patch.price = body.price;
  if ("isActive" in body) patch.isActive = body.isActive;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(services)
    .set(patch)
    .where(and(eq(services.id, id), eq(services.organizationId, ctx.orgId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json(updated);
}
