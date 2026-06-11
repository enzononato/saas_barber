import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { appointments } from "@/server/db/schema/appointments";
import { user } from "@/server/db/schema/auth";
import { getOrgBySlug } from "@/server/services/tenant";
import { canSelfManage, SELF_SERVICE_MIN_HOURS } from "@/lib/booking-rules";

/**
 * Detalhes públicos de um agendamento. O próprio UUID (não sequencial,
 * 122 bits de entropia) funciona como token de acesso — só quem recebeu
 * o link por WhatsApp consegue acessar.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [apt] = await db
    .select({
      id: appointments.id,
      serviceName: appointments.serviceNameAtBooking,
      customerName: appointments.customerName,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      price: appointments.priceAtBooking,
      professionalId: appointments.professionalId,
      professionalName: user.name,
    })
    .from(appointments)
    .innerJoin(user, eq(appointments.professionalId, user.id))
    .where(and(eq(appointments.id, id), eq(appointments.organizationId, org.id)))
    .limit(1);

  if (!apt) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const canSelfService = canSelfManage(apt.startsAt, apt.status);

  return NextResponse.json({
    appointment: {
      id: apt.id,
      serviceName: apt.serviceName,
      customerFirstName: apt.customerName.split(" ")[0],
      startsAt: apt.startsAt,
      endsAt: apt.endsAt,
      status: apt.status,
      price: apt.price,
      professionalName: apt.professionalName,
    },
    canCancel: canSelfService,
    canReschedule: canSelfService,
    minHoursBefore: SELF_SERVICE_MIN_HOURS,
  });
}
