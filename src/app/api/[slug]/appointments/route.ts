import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/server/db";
import { services } from "@/server/db/schema";
import { user } from "@/server/db/schema/auth";
import { env } from "@/lib/env";
import { createAppointmentSchema } from "@/lib/validators/booking";
import {
  createAppointment,
  createAppointmentForAny,
  type ServiceItem,
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

  const { memberId, startsAt: startsAtStr, clientName, notes } = parsed.data;
  const normalizedPhone = normalizePhoneBR(parsed.data.clientPhone);

  // Multi-serviço: 1+ serviços somam duração e preço
  const serviceIds = parsed.data.serviceIds ?? [parsed.data.serviceId!];

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
        eq(services.organizationId, org.id),
        inArray(services.id, serviceIds),
        eq(services.isActive, true),
      ),
    );

  if (svcRows.length !== serviceIds.length) {
    return NextResponse.json({ error: "service_not_found" }, { status: 404 });
  }

  // Preserva a ordem escolhida pelo cliente
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
    serviceId: ordered[0].id,
    serviceNameAtBooking: combinedName,
    priceAtBooking: totalPrice,
    durationMinutes: totalDuration,
    startsAt,
    clientName,
    clientPhone: normalizedPhone,
    notes,
    serviceItems,
  };

  // Para barbeiro específico, validar working_hours/exceptions antes do INSERT
  if (memberId !== "any") {
    const endsAt = new Date(startsAt.getTime() + totalDuration * 60_000);
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

  const manageUrl = buildManageUrl(slug, result.appointment.id);

  // Notificações pós-booking (não-bloqueantes): push para o barbeiro + WhatsApp para o cliente.
  void notifyAfterBooking({
    orgId: org.id,
    timezone: org.timezone,
    professionalId: result.appointment.professionalId,
    appointmentId: result.appointment.id,
    startsAt: result.appointment.startsAt,
    customerName: clientName,
    customerPhone: normalizedPhone,
    serviceName: combinedName,
    manageUrl,
  });

  return NextResponse.json(
    {
      appointment: {
        id: result.appointment.id,
        startsAt: result.appointment.startsAt,
        endsAt: result.appointment.endsAt,
        manageUrl,
      },
    },
    { status: 201 },
  );
}

function buildManageUrl(slug: string, appointmentId: string): string {
  const base = (env.BETTER_AUTH_URL ?? "").replace(/\/$/, "");
  return `${base}/${slug}/agendamentos/${appointmentId}/gerenciar`;
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
  manageUrl: string;
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
      manageUrl: p.manageUrl,
    });
  } catch (err) {
    console.error("[appointments] notifyAfterBooking error:", err);
  }
}
