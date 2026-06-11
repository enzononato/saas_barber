import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { appointments } from "@/server/db/schema/appointments";
import { getOrgBySlug } from "@/server/services/tenant";
import { getSlotsForProfessional } from "@/server/services/availability";

/**
 * Slots livres para REAGENDAMENTO: mesmo profissional, mesma duração,
 * ignorando o horário atualmente ocupado pelo próprio agendamento.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }

  const [apt] = await db
    .select({
      professionalId: appointments.professionalId,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
    })
    .from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.organizationId, org.id)))
    .limit(1);

  if (!apt) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (apt.status !== "SCHEDULED") {
    return NextResponse.json({ error: "not_reschedulable" }, { status: 422 });
  }

  const durationMinutes = Math.round(
    (new Date(apt.endsAt).getTime() - new Date(apt.startsAt).getTime()) / 60_000,
  );

  const slots = await getSlotsForProfessional(
    org.id,
    apt.professionalId,
    durationMinutes,
    date,
    org.timezone,
    id, // exclui o próprio agendamento dos horários ocupados
  );

  const now = Date.now();

  return NextResponse.json({
    slots: slots
      .filter((s) => s.startsAt.getTime() > now)
      .map((s) => ({
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
      })),
  });
}
