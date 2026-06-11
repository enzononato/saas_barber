import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { appointments } from "@/server/db/schema/appointments";
import { getOrgBySlug } from "@/server/services/tenant";
import { canSelfManage, SELF_SERVICE_MIN_HOURS } from "@/lib/booking-rules";

/** Cancelamento autônomo pelo cliente (link recebido por WhatsApp). */
export async function POST(
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
    .select({ startsAt: appointments.startsAt, status: appointments.status })
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

  await db
    .update(appointments)
    .set({ status: "CANCELED" })
    .where(and(eq(appointments.id, id), eq(appointments.organizationId, org.id)));

  return NextResponse.json({ ok: true });
}
