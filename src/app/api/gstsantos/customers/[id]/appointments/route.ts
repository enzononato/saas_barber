import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { appointments } from "@/server/db/schema/appointments";
import { requireAuth } from "@/server/middleware/requireAuth";
import { getCustomerAppointments, getCustomerById } from "@/server/services/customers";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const customer = await getCustomerById(ctx.orgId, id);
  if (!customer) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Scope: barbeiro só vê appointments que ele atendeu. Owner/recepcionista veem todos.
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
  const rows = await getCustomerAppointments(
    ctx.orgId,
    customer.phone,
    scopeUserId,
    limit,
    offset,
  );

  return NextResponse.json({ appointments: rows });
}
