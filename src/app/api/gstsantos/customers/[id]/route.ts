import { NextResponse } from "next/server";
import { and, eq, exists, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import { customers } from "@/server/db/schema/customers";
import { appointments } from "@/server/db/schema/appointments";
import { requireAuth } from "@/server/middleware/requireAuth";
import { getCustomerAnalytics, getCustomerById } from "@/server/services/customers";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  notes: z.string().max(5000).nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  isBlocked: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const customer = await getCustomerById(ctx.orgId, id);
  if (!customer) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Scope: barbeiro só vê clientes com quem ele teve appointments.
  // Owner e recepcionista veem todos.
  if (ctx.role === "member") {
    const [hasAccess] = await db
      .select({ ok: sql<number>`1` })
      .from(appointments)
      .where(
        and(
          eq(appointments.organizationId, ctx.orgId),
          eq(appointments.customerPhone, customer.phone),
          eq(appointments.professionalId, ctx.userId),
        ),
      )
      .limit(1);
    if (!hasAccess) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const scopeUserId = ctx.role === "member" ? ctx.userId : undefined;
  const analytics = await getCustomerAnalytics(ctx.orgId, customer.phone, scopeUserId);

  // Owner e recepcionista podem ver notas privadas; barbeiro não
  const notes = ctx.role === "member" ? null : customer.notes;

  void exists; // suprime warning

  return NextResponse.json({
    customer: {
      id: customer.id,
      phone: customer.phone,
      name: customer.name,
      notes,
      tags: customer.tags,
      isBlocked: customer.isBlocked,
      firstSeenAt: customer.firstSeenAt,
      lastSeenAt: customer.lastSeenAt,
    },
    analytics,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Owner edita tudo; recepcionista edita nome/notas/tags (não pode bloquear)
  if (ctx.role === "member") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

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

  const data = parsed.data;

  if (data.isBlocked !== undefined && ctx.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [updated] = await db
    .update(customers)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.isBlocked !== undefined && { isBlocked: data.isBlocked }),
      updatedAt: sql`now()`,
    })
    .where(and(eq(customers.id, id), eq(customers.organizationId, ctx.orgId)))
    .returning({ id: customers.id });

  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
