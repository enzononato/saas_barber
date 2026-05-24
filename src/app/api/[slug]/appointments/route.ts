import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { services } from "@/server/db/schema";
import { user } from "@/server/db/schema/auth";
import { createAppointmentSchema } from "@/lib/validators/booking";
import {
  createAppointment,
  createAppointmentForAny,
} from "@/server/services/appointments";
import { isProfessionalAvailableAt } from "@/server/services/availability";
import { getOrgBySlug } from "@/server/services/tenant";
import { sendPushToUser } from "@/server/services/push";
import {
  normalizePhoneBR,
  sendBookingConfirmationIfEnabled,
} from "@/server/services/whatsapp";
import { upsertCustomer } from "@/server/services/customers";

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

  const { serviceId, memberId, startsAt: startsAtStr, clientName, notes } = parsed.data;
  const normalizedPhone = normalizePhoneBR(parsed.data.clientPhone);

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

  // Upsert do cliente + checa bloqueio
  const customer = await upsertCustomer({
    orgId: org.id,
    phone: normalizedPhone,
    name: clientName,
    appointmentDate: startsAt,
  });

  if (customer.isBlocked) {
    return NextResponse.json({ error: "customer_blocked" }, { status: 403 });
  }

  const appointmentParams = {
    serviceId,
    serviceNameAtBooking: svc.name,
    priceAtBooking: svc.price,
    durationMinutes: svc.durationMinutes,
    startsAt,
    clientName,
    clientPhone: normalizedPhone,
    notes,
  };

  // Para barbeiro específico, validar working_hours/exceptions antes do INSERT
  if (memberId !== "any") {
    const endsAt = new Date(startsAt.getTime() + svc.durationMinutes * 60_000);
    const available = await isProfessionalAvailableAt(
      org.id,
      memberId,
      startsAt,
      endsAt,
      org.timezone,
    );
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

  // Notificações pós-booking (não-bloqueantes): push para o barbeiro + WhatsApp para o cliente.
  void notifyAfterBooking({
    orgId: org.id,
    timezone: org.timezone,
    professionalId: result.appointment.professionalId,
    appointmentId: result.appointment.id,
    startsAt: result.appointment.startsAt,
    customerName: clientName,
    customerPhone: normalizedPhone,
    serviceName: svc.name,
  });

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

type NotifyParams = {
  orgId: string;
  timezone: string;
  professionalId: string;
  appointmentId: string;
  startsAt: Date;
  customerName: string;
  customerPhone: string;
  serviceName: string;
};

async function notifyAfterBooking(p: NotifyParams): Promise<void> {
  try {
    const [prof] = await db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, p.professionalId))
      .limit(1);
    const professionalName = prof?.name ?? "Profissional";

    const timeStr = new Intl.DateTimeFormat("pt-BR", {
      timeZone: p.timezone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(p.startsAt);

    const dateStr = new Intl.DateTimeFormat("pt-BR", {
      timeZone: p.timezone,
      day: "2-digit",
      month: "2-digit",
    }).format(p.startsAt);

    await sendPushToUser(p.professionalId, {
      title: "Novo agendamento",
      body: `${p.customerName} — ${dateStr} às ${timeStr} (${p.serviceName})`,
      url: "/gstsantos/agenda",
      tag: `appointment-${p.appointmentId}`,
    });

    await sendBookingConfirmationIfEnabled({
      orgId: p.orgId,
      customerPhone: p.customerPhone,
      customerName: p.customerName,
      startsAt: p.startsAt,
      timezone: p.timezone,
      serviceNameAtBooking: p.serviceName,
      professionalName,
    });
  } catch (err) {
    console.error("[appointments] notifyAfterBooking error:", err);
  }
}
