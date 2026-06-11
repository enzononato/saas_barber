import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/server/db";
import { appointments } from "@/server/db/schema/appointments";
import { organization, user } from "@/server/db/schema/auth";
import { services } from "@/server/db/schema/services";
import { requireAuth } from "@/server/middleware/requireAuth";
import {
  getUtcOffset,
  isProfessionalAvailableAt,
} from "@/server/services/availability";
import {
  createAppointment,
  type ServiceItem,
} from "@/server/services/appointments";
import { normalizePhoneBR } from "@/server/services/whatsapp";
import { upsertCustomer } from "@/server/services/customers";

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
    const orgRow = await db
      .select({ timezone: organization.timezone })
      .from(organization)
      .where(eq(organization.id, ctx.orgId))
      .limit(1);
    const timezone = orgRow[0]?.timezone ?? "America/Sao_Paulo";
    const nearDate = new Date(`${date}T12:00:00Z`);
    const offset = getUtcOffset(timezone, nearDate);
    const start = new Date(`${date}T00:00:00${offset}`);
    const end = new Date(start.getTime() + 86_400_000 - 1);
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
      paymentMethod: appointments.paymentMethod,
      tipAmount: appointments.tipAmount,
    })
    .from(appointments)
    .innerJoin(user, eq(appointments.professionalId, user.id))
    .where(and(...conditions))
    .orderBy(appointments.startsAt);

  return NextResponse.json(rows);
}

const createManualSchema = z.object({
  professionalId: z.string().min(1),
  serviceIds: z.array(z.string().uuid()).min(1).max(5),
  startsAt: z.string().datetime(),
  clientName: z.string().min(1).max(200),
  clientPhone: z.string().min(8).max(20),
  notes: z.string().max(500).optional(),
});

/**
 * Agendamento manual pelo painel (owner, recepcionista, barbeiro-admin
 * para qualquer profissional; barbeiro comum apenas para si).
 */
export async function POST(req: Request) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = createManualSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { professionalId, serviceIds, clientName, notes } = parsed.data;

  const canBookForOthers =
    ctx.role === "owner" || ctx.role === "receptionist" || ctx.canCreateServices;
  if (!canBookForOthers && professionalId !== ctx.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const svcRows = await db
    .select({
      id: services.id,
      name: services.name,
      price: services.price,
      durationMinutes: services.durationMinutes,
    })
    .from(services)
    .where(
      and(
        eq(services.organizationId, ctx.orgId),
        inArray(services.id, serviceIds),
        eq(services.isActive, true),
      ),
    );

  if (svcRows.length !== serviceIds.length) {
    return NextResponse.json({ error: "service_not_found" }, { status: 404 });
  }

  const ordered = serviceIds.map((id) => svcRows.find((s) => s.id === id)!);
  const totalDuration = ordered.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalPrice = ordered
    .reduce((sum, s) => sum + parseFloat(s.price), 0)
    .toFixed(2);
  const combinedName = ordered.map((s) => s.name).join(" + ");

  const serviceItems: ServiceItem[] = ordered.map((s) => ({
    serviceId: s.id,
    name: s.name,
    price: s.price,
    durationMinutes: s.durationMinutes,
  }));

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(startsAt.getTime() + totalDuration * 60_000);
  const normalizedPhone = normalizePhoneBR(parsed.data.clientPhone);

  const [orgRow] = await db
    .select({ timezone: organization.timezone })
    .from(organization)
    .where(eq(organization.id, ctx.orgId))
    .limit(1);
  const timezone = orgRow?.timezone ?? "America/Sao_Paulo";

  const available = await isProfessionalAvailableAt(
    ctx.orgId,
    professionalId,
    startsAt,
    endsAt,
    timezone,
  );
  if (!available) {
    return NextResponse.json({ error: "slot_unavailable" }, { status: 409 });
  }

  // Cadastra/atualiza o cliente no CRM
  await upsertCustomer({
    orgId: ctx.orgId,
    phone: normalizedPhone,
    name: clientName,
    appointmentDate: startsAt,
  });

  const result = await createAppointment({
    orgId: ctx.orgId,
    professionalId,
    serviceId: ordered[0].id,
    serviceNameAtBooking: combinedName,
    priceAtBooking: totalPrice,
    durationMinutes: totalDuration,
    startsAt,
    clientName,
    clientPhone: normalizedPhone,
    notes,
    serviceItems,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json(
    {
      appointment: {
        id: result.appointment.id,
        startsAt: result.appointment.startsAt,
        endsAt: result.appointment.endsAt,
      },
    },
    { status: 201 },
  );
}
