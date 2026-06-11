import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/server/db";
import { appointmentProducts, products } from "@/server/db/schema/products";
import { requireAuth } from "@/server/middleware/requireAuth";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  price: z.number().min(0).max(999999).optional(),
  costPrice: z.number().min(0).max(999999).optional(),
  stockQuantity: z.number().int().min(0).max(999999).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const d = parsed.data;
  const [updated] = await db
    .update(products)
    .set({
      ...(d.name !== undefined && { name: d.name }),
      ...(d.price !== undefined && { price: d.price.toFixed(2) }),
      ...(d.costPrice !== undefined && { costPrice: d.costPrice.toFixed(2) }),
      ...(d.stockQuantity !== undefined && { stockQuantity: d.stockQuantity }),
      ...(d.isActive !== undefined && { isActive: d.isActive }),
    })
    .where(and(eq(products.id, id), eq(products.organizationId, ctx.orgId)))
    .returning({ id: products.id });

  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;

  // Produto com vendas registradas não pode ser removido — desativa
  const [hasSale] = await db
    .select({ id: appointmentProducts.id })
    .from(appointmentProducts)
    .where(eq(appointmentProducts.productId, id))
    .limit(1);

  if (hasSale) {
    await db
      .update(products)
      .set({ isActive: false })
      .where(and(eq(products.id, id), eq(products.organizationId, ctx.orgId)));
    return NextResponse.json({ ok: true, deactivated: true });
  }

  const [deleted] = await db
    .delete(products)
    .where(and(eq(products.id, id), eq(products.organizationId, ctx.orgId)))
    .returning({ id: products.id });

  if (!deleted) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
