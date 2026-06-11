import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/server/db";
import { products } from "@/server/db/schema/products";
import { requireAuth } from "@/server/middleware/requireAuth";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().min(0).max(999999),
  costPrice: z.number().min(0).max(999999).optional().default(0),
  stockQuantity: z.number().int().min(0).max(999999).optional().default(0),
});

// Lista produtos. Qualquer membro autenticado pode listar (necessário para o
// checkout no fechamento do atendimento); apenas ativos por padrão.
export async function GET(req: Request) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("all") === "1" && ctx.role === "owner";

  const conditions = [eq(products.organizationId, ctx.orgId)];
  if (!includeInactive) conditions.push(eq(products.isActive, true));

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      costPrice: products.costPrice,
      stockQuantity: products.stockQuantity,
      isActive: products.isActive,
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

  const [created] = await db
    .insert(products)
    .values({
      organizationId: ctx.orgId,
      name: parsed.data.name,
      price: parsed.data.price.toFixed(2),
      costPrice: parsed.data.costPrice.toFixed(2),
      stockQuantity: parsed.data.stockQuantity,
    })
    .returning({ id: products.id });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
