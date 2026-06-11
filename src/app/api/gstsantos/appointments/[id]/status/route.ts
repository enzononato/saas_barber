import { and, eq, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/server/db";
import { appointments } from "@/server/db/schema/appointments";
import { appointmentProducts, products } from "@/server/db/schema/products";
import { requireAuth } from "@/server/middleware/requireAuth";

const VALID_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELED", "NO_SHOW"] as const;
type AppointmentStatus = (typeof VALID_STATUSES)[number];

const checkoutSchema = z.object({
  status: z.enum(VALID_STATUSES),
  // Campos de fechamento (apenas quando status = COMPLETED)
  paymentMethod: z.enum(["CASH", "PIX", "CREDIT_CARD", "DEBIT_CARD"]).optional(),
  tipAmount: z.number().min(0).max(10000).optional(),
  products: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .max(20)
    .optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { status, paymentMethod, tipAmount, products: productSales } = parsed.data;

  // Owner e recepcionista atualizam qualquer agendamento; barbeiro só os próprios
  const conditions = [
    eq(appointments.id, id),
    eq(appointments.organizationId, ctx.orgId),
  ];
  if (ctx.role === "member") {
    conditions.push(eq(appointments.professionalId, ctx.userId));
  }

  const isCompleting = status === "COMPLETED";

  const [updated] = await db
    .update(appointments)
    .set({
      status: status as AppointmentStatus,
      ...(isCompleting && {
        completedAt: new Date(),
        ...(paymentMethod && { paymentMethod }),
        ...(tipAmount !== undefined && { tipAmount: tipAmount.toFixed(2) }),
      }),
    })
    .where(and(...conditions))
    .returning({ id: appointments.id });

  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Venda de produtos no checkout — snapshot de nome/preço + baixa de estoque
  if (isCompleting && productSales && productSales.length > 0) {
    for (const sale of productSales) {
      const [product] = await db
        .select({
          id: products.id,
          name: products.name,
          price: products.price,
        })
        .from(products)
        .where(
          and(
            eq(products.id, sale.productId),
            eq(products.organizationId, ctx.orgId),
            eq(products.isActive, true),
          ),
        )
        .limit(1);

      if (!product) continue;

      await db.insert(appointmentProducts).values({
        appointmentId: id,
        productId: product.id,
        productNameAtSale: product.name,
        quantity: sale.quantity,
        priceAtSale: product.price,
      });

      // Baixa de estoque sem ficar negativo
      await db
        .update(products)
        .set({ stockQuantity: sql`${products.stockQuantity} - ${sale.quantity}` })
        .where(
          and(
            eq(products.id, product.id),
            gte(products.stockQuantity, sale.quantity),
          ),
        );
    }
  }

  return NextResponse.json({ ok: true });
}
