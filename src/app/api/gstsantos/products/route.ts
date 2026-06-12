import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/server/db";
import { products } from "@/server/db/schema/products";
import { units } from "@/server/db/schema/units";
import { requireAuth } from "@/server/middleware/requireAuth";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().min(0).max(999999),
  costPrice: z.number().min(0).max(999999).optional().default(0),
  stockQuantity: z.number().int().min(0).max(999999).optional().default(0),
  unitId: z.string().uuid().nullable().optional(),
});

// Lista produtos. Qualquer membro autenticado pode listar (necessário para o
// checkout no fechamento do atendimento); apenas ativos por padrão.
export async function GET(req: Request) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("all") === "1" && ctx.role === "owner";
  const unitId = searchParams.get("unitId"); // filtra por filial (opcional)

  const conditions = [eq(products.organizationId, ctx.orgId)];
  if (!includeInactive) conditions.push(eq(products.isActive, true));
  if (unitId) conditions.push(eq(products.unitId, unitId));

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      costPrice: products.costPrice,
      stockQuantity: products.stockQuantity,
      isActive: products.isActive,
      unitId: products.unitId,
    })
    .from(products)
    .where(and(...conditions))
    .orderBy(asc(products.name));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // unitId (opcional) precisa pertencer à org
  let validUnitId: string | null = null;
  if (parsed.data.unitId) {
    const [u] = await db
      .select({ id: units.id })
      .from(units)
      .where(and(eq(units.id, parsed.data.unitId), eq(units.organizationId, ctx.orgId)))
      .limit(1);
    if (!u) return NextResponse.json({ error: "unit_not_found" }, { status: 404 });
    validUnitId = u.id;
  }

  const [created] = await db
    .insert(products)
    .values({
      organizationId: ctx.orgId,
      unitId: validUnitId,
      name: parsed.data.name,
      price: parsed.data.price.toFixed(2),
      costPrice: parsed.data.costPrice.toFixed(2),
      stockQuantity: parsed.data.stockQuantity,
    })
    .returning({ id: products.id });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
