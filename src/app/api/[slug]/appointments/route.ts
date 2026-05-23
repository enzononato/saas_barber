import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { services } from "@/server/db/schema";
import { createAppointmentSchema } from "@/lib/validators/booking";
import {
  createAppointment,
  createAppointmentForAny,
} from "@/server/services/appointments";
import { isProfessionalAvailableAt } from "@/server/services/availability";
import { getOrgBySlug } from "@/server/services/tenant";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);

  if (!org) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = createAppointmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { serviceId, memberId, startsAt: startsAtStr, clientName, clientPhone, notes } =
    parsed.data;

  // Busca o serviço para capturar o snapshot de nome e preço
  const svcRows = await db
    .select({
      name: services.name,
      price: services.price,
      durationMinutes: services.durationMinutes,
    })
    .from(services)
    .where(
      and(
        eq(services.organizationId, org.id),
        eq(services.id, serviceId),
        eq(services.isActive, true),
      ),
    )
    .limit(1);

  if (svcRows.length === 0) {
    return NextResponse.json({ error: "service_not_found" }, { status: 404 });
  }

  const svc = svcRows[0];
  const startsAt = new Date(startsAtStr);

  const appointmentParams = {
    serviceId,
    serviceNameAtBooking: svc.name,
    priceAtBooking: svc.price,
    durationMinutes: svc.durationMinutes,
    startsAt,
    clientName,
    clientPhone,
    notes,
  };

  // Para barbeiro específico, validar working_hours/exceptions antes do INSERT
  // (Exclusion Constraint só pega overlap entre appointments, não slot fora do expediente)
  if (memberId !== "any") {
    const endsAt = new Date(startsAt.getTime() + svc.durationMinutes * 60_000);
    const available = await isProfessionalAvailableAt(org.id, memberId, startsAt, endsAt, org.timezone);
    if (!available) {
      return NextResponse.json({ error: "slot_unavailable" }, { status: 409 });
    }
  }

  const result =
    memberId === "any"
      ? await createAppointmentForAny(org.id, appointmentParams, org.timezone)
      : await createAppointment({ ...appointmentParams, orgId: org.id, professionalId: memberId });

  if (!result.ok) {
    const status = result.error === "no_professional_available" ? 503 : 409;
    return NextResponse.json({ error: result.error }, { status });
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
