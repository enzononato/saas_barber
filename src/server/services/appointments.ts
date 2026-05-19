import { and, eq, exists } from "drizzle-orm";

import { db } from "@/server/db";
import { appointments } from "@/server/db/schema";
import { member, user } from "@/server/db/schema/auth";
import { workingHours } from "@/server/db/schema/availability";
import { isProfessionalAvailableAt } from "./availability";

export type Professional = {
  userId: string;
  name: string;
};

export async function getOrgProfessionals(orgId: string): Promise<Professional[]> {
  // Qualquer membro com workingHours configurado é bookable (inclui owner que atende)
  return db
    .select({ userId: member.userId, name: user.name })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(member.organizationId, orgId),
        exists(
          db
            .select({ id: workingHours.id })
            .from(workingHours)
            .where(
              and(
                eq(workingHours.organizationId, orgId),
                eq(workingHours.professionalId, user.id),
              ),
            )
            .limit(1),
        ),
      ),
    );
}

function isPgExclusionViolation(err: unknown): boolean {
  if (err instanceof Error) {
    const code =
      (err as Error & { cause?: { code?: string }; code?: string })?.cause?.code ??
      (err as Error & { code?: string })?.code;
    return code === "23P01";
  }
  return false;
}

export type CreateAppointmentParams = {
  orgId: string;
  professionalId: string;
  serviceId: string;
  serviceNameAtBooking: string;
  priceAtBooking: string;
  durationMinutes: number;
  startsAt: Date;
  clientName: string;
  clientPhone: string;
  notes?: string;
};

export type CreateAppointmentResult =
  | { ok: true; appointment: { id: string; startsAt: Date; endsAt: Date } }
  | { ok: false; error: "slot_unavailable" | "no_professional_available" };

export async function createAppointment(
  params: CreateAppointmentParams,
): Promise<CreateAppointmentResult> {
  const endsAt = new Date(params.startsAt.getTime() + params.durationMinutes * 60_000);

  try {
    const [created] = await db
      .insert(appointments)
      .values({
        organizationId: params.orgId,
        professionalId: params.professionalId,
        serviceId: params.serviceId,
        serviceNameAtBooking: params.serviceNameAtBooking,
        customerName: params.clientName,
        customerPhone: params.clientPhone,
        startsAt: params.startsAt,
        endsAt,
        priceAtBooking: params.priceAtBooking,
        notes: params.notes,
      })
      .returning({
        id: appointments.id,
        startsAt: appointments.startsAt,
        endsAt: appointments.endsAt,
      });

    return { ok: true, appointment: created };
  } catch (err) {
    if (isPgExclusionViolation(err)) {
      return { ok: false, error: "slot_unavailable" };
    }
    throw err;
  }
}

export async function createAppointmentForAny(
  orgId: string,
  params: Omit<CreateAppointmentParams, "orgId" | "professionalId">,
): Promise<CreateAppointmentResult> {
  const endsAt = new Date(params.startsAt.getTime() + params.durationMinutes * 60_000);
  const professionals = await getOrgProfessionals(orgId);

  for (const p of professionals) {
    const available = await isProfessionalAvailableAt(
      orgId,
      p.userId,
      params.startsAt,
      endsAt,
    );
    if (!available) continue;

    const result = await createAppointment({ ...params, orgId, professionalId: p.userId });
    if (result.ok) return result;
    // Race condition: slot snatched between check and insert — tenta o próximo
    if (result.error !== "slot_unavailable") return result;
  }

  return { ok: false, error: "no_professional_available" };
}
