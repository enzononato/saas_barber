import { and, eq, gte, lte } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { appointments } from "@/server/db/schema/appointments";
import { user } from "@/server/db/schema/auth";
import { requireAuth } from "@/server/middleware/requireAuth";

export async function GET(req: Request) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // YYYY-MM-DD
  const status = searchParams.get("status");
  const barberId = searchParams.get("barberId"); // userId

  const conditions = [eq(appointments.organizationId, ctx.orgId)];

  // Members only see their own appointments
  if (ctx.role === "member") {
    conditions.push(eq(appointments.professionalId, ctx.userId));
  } else if (barberId) {
    conditions.push(eq(appointments.professionalId, barberId));
  }

  if (date) {
    const start = new Date(date + "T00:00:00Z");
    const end = new Date(date + "T23:59:59.999Z");
    conditions.push(gte(appointments.startsAt, start));
    conditions.push(lte(appointments.startsAt, end));
  }

  if (status) {
    conditions.push(
      eq(
        appointments.status,
        status as "SCHEDULED" | "COMPLETED" | "CANCELED" | "NO_SHOW",
      ),
    );
  }

  const rows = await db
    .select({
      id: appointments.id,
      professionalId: appointments.professionalId,
      professionalName: user.name,
      serviceId: appointments.serviceId,
      serviceNameAtBooking: appointments.serviceNameAtBooking,
      customerName: appointments.customerName,
      customerPhone: appointments.customerPhone,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      priceAtBooking: appointments.priceAtBooking,
      notes: appointments.notes,
    })
    .from(appointments)
    .innerJoin(user, eq(appointments.professionalId, user.id))
    .where(and(...conditions))
    .orderBy(appointments.startsAt);

  return NextResponse.json(rows);
}
