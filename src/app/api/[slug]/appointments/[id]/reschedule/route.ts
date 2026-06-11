import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import { appointments } from "@/server/db/schema/appointments";
import { getOrgBySlug } from "@/server/services/tenant";
import { isProfessionalAvailableAt } from "@/server/services/availability";
import { canSelfManage, SELF_SERVICE_MIN_HOURS } from "@/lib/booking-rules";

const bodySchema = z.object({
  startsAt: z.string().datetime({ message: "Expected ISO 8601 UTC datetime" }),
});

/** Reagendamento autônomo pelo cliente — mesmo profissional e serviço. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
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

  if (!canSelfManage(apt.startsAt, apt.status)) {
    return NextResponse.json(
      { error: "too_late", minHoursBefore: SELF_SERVICE_MIN_HOURS },
      { status: 422 },
    );
  }

  const durationMinutes = Math.round(
    (new Date(apt.endsAt).getTime() - new Date(apt.startsAt).getTime()) / 60_000,
  );
  const newStartsAt = new Date(parsed.data.startsAt);
  const newEndsAt = new Date(newStartsAt.getTime() + durationMinutes * 60_000);

  if (newStartsAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "slot_in_past" }, { status: 422 });
  }

  const available = await isProfessionalAvailableAt(
    org.id,
    apt.professionalId,
    newStartsAt,
    newEndsAt,
    org.timezone,
    id, // ignora o próprio agendamento
  );

  if (!available) {
    return NextResponse.json({ error: "slot_unavailable" }, { status: 409 });
  }

  try {
    await db
      .update(appointments)
      .set({ startsAt: newStartsAt, endsAt: newEndsAt, reminderSentAt: null })
      .where(and(eq(appointments.id, id), eq(appointments.organizationId, org.id)));
  } catch (err) {
    // Exclusion constraint (race): outro agendamento pegou o slot
    const code =
      (err as Error & { cause?: { code?: string }; code?: string })?.cause?.code ??
      (err as Error & { code?: string })?.code;
    if (code === "23P01") {
      return NextResponse.json({ error: "slot_unavailable" }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({
    ok: true,
    appointment: { id, startsAt: newStartsAt, endsAt: newEndsAt },
  });
}
