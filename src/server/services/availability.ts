import { and, eq, exists, gt, inArray, lt } from "drizzle-orm";

import { db } from "@/server/db";
import { appointments } from "@/server/db/schema";
import { member } from "@/server/db/schema/auth";
import { timeExceptions, workingHours } from "@/server/db/schema/availability";

export interface Slot {
  startsAt: Date;
  endsAt: Date;
}

// America/Sao_Paulo offset (Brazil aboliu horário de verão em 2019, então é fixo)
const TZ_OFFSET = "-03:00";

function parseTimeOnDate(timeStr: string, dateStr: string): Date {
  const [h, m] = timeStr.split(":").map(Number);
  return new Date(
    `${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000${TZ_OFFSET}`,
  );
}

// Local day boundaries (Brazil) converted to UTC instants
function dayBoundariesUtc(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00.000${TZ_OFFSET}`);
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export async function getSlotsForProfessional(
  orgId: string,
  professionalId: string,
  durationMinutes: number,
  date: string,
): Promise<Slot[]> {
  if (durationMinutes <= 0) return [];
  // Day of week in Brazil local time
  const dayOfWeek = new Date(`${date}T12:00:00${TZ_OFFSET}`).getUTCDay();
  const { start: dayStart, end: dayEnd } = dayBoundariesUtc(date);

  // 1. Horários padrão do profissional neste dia da semana
  const hours = await db
    .select({ startTime: workingHours.startTime, endTime: workingHours.endTime })
    .from(workingHours)
    .where(
      and(
        eq(workingHours.organizationId, orgId),
        eq(workingHours.professionalId, professionalId),
        eq(workingHours.dayOfWeek, dayOfWeek),
      ),
    )
    .limit(1);

  if (hours.length === 0) return [];

  const workStart = parseTimeOnDate(hours[0].startTime, date);
  const workEnd = parseTimeOnDate(hours[0].endTime, date);

  // 2. Gera todos os slots candidatos dentro do horário de trabalho
  const candidates: Slot[] = [];
  let cursor = workStart;
  while (true) {
    const slotEnd = new Date(cursor.getTime() + durationMinutes * 60_000);
    if (slotEnd > workEnd) break;
    candidates.push({ startsAt: new Date(cursor), endsAt: slotEnd });
    cursor = slotEnd;
  }
  if (candidates.length === 0) return [];

  // 3. Exceções de horário que intersectam com o dia
  const exceptions = await db
    .select({ startsAt: timeExceptions.startsAt, endsAt: timeExceptions.endsAt })
    .from(timeExceptions)
    .where(
      and(
        eq(timeExceptions.organizationId, orgId),
        eq(timeExceptions.professionalId, professionalId),
        lt(timeExceptions.startsAt, dayEnd),
        gt(timeExceptions.endsAt, dayStart),
      ),
    );

  // 4. Agendamentos ativos que intersectam com o dia
  const busy = await db
    .select({ startsAt: appointments.startsAt, endsAt: appointments.endsAt })
    .from(appointments)
    .where(
      and(
        eq(appointments.organizationId, orgId),
        eq(appointments.professionalId, professionalId),
        inArray(appointments.status, ["SCHEDULED", "COMPLETED"]),
        lt(appointments.startsAt, dayEnd),
        gt(appointments.endsAt, dayStart),
      ),
    );

  const blocked = [...exceptions, ...busy].map((b) => ({
    start: new Date(b.startsAt),
    end: new Date(b.endsAt),
  }));

  // 5. Filtra slots que colidem com qualquer bloqueio
  return candidates.filter(
    (slot) =>
      !blocked.some((b) => overlaps(slot.startsAt, slot.endsAt, b.start, b.end)),
  );
}

export async function isProfessionalAvailableAt(
  orgId: string,
  professionalId: string,
  startsAt: Date,
  endsAt: Date,
): Promise<boolean> {
  const date = startsAt.toISOString().slice(0, 10);
  const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();

  const hours = await db
    .select({ startTime: workingHours.startTime, endTime: workingHours.endTime })
    .from(workingHours)
    .where(
      and(
        eq(workingHours.organizationId, orgId),
        eq(workingHours.professionalId, professionalId),
        eq(workingHours.dayOfWeek, dayOfWeek),
      ),
    )
    .limit(1);

  if (hours.length === 0) return false;

  const workStart = parseTimeOnDate(hours[0].startTime, date);
  const workEnd = parseTimeOnDate(hours[0].endTime, date);
  if (startsAt < workStart || endsAt > workEnd) return false;

  const blockedByException = await db
    .select({ id: timeExceptions.id })
    .from(timeExceptions)
    .where(
      and(
        eq(timeExceptions.organizationId, orgId),
        eq(timeExceptions.professionalId, professionalId),
        lt(timeExceptions.startsAt, endsAt),
        gt(timeExceptions.endsAt, startsAt),
      ),
    )
    .limit(1);

  if (blockedByException.length > 0) return false;

  const busyWithAppointment = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.organizationId, orgId),
        eq(appointments.professionalId, professionalId),
        inArray(appointments.status, ["SCHEDULED", "COMPLETED"]),
        lt(appointments.startsAt, endsAt),
        gt(appointments.endsAt, startsAt),
      ),
    )
    .limit(1);

  return busyWithAppointment.length === 0;
}

export async function getAvailableSlots(
  orgId: string,
  memberId: string,
  durationMinutes: number,
  date: string,
): Promise<Slot[]> {
  if (memberId !== "any") {
    return getSlotsForProfessional(orgId, memberId, durationMinutes, date);
  }

  const professionals = await db
    .select({ userId: member.userId })
    .from(member)
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
                eq(workingHours.professionalId, member.userId),
              ),
            )
            .limit(1),
        ),
      ),
    );

  const slotMap = new Map<number, Slot>();
  for (const p of professionals) {
    const slots = await getSlotsForProfessional(orgId, p.userId, durationMinutes, date);
    for (const s of slots) {
      slotMap.set(s.startsAt.getTime(), s);
    }
  }

  return Array.from(slotMap.values()).sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );
}
