import { and, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { appointments } from "@/server/db/schema/appointments";
import { requireAuth } from "@/server/middleware/requireAuth";

const VALID_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELED", "NO_SHOW"] as const;
type AppointmentStatus = (typeof VALID_STATUSES)[number];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { status } = body as { status?: string };

  if (!status || !VALID_STATUSES.includes(status as AppointmentStatus)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  // Owner can update any; member can only update their own
  const conditions = [
    eq(appointments.id, id),
    eq(appointments.organizationId, ctx.orgId),
  ];
  if (ctx.role === "member") {
    conditions.push(eq(appointments.professionalId, ctx.userId));
  }

  const [updated] = await db
    .update(appointments)
    .set({ status: status as AppointmentStatus })
    .where(and(...conditions))
    .returning({ id: appointments.id });

  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
