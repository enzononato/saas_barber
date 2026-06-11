import { and, eq, exists, gt, inArray, lt, ne } from "drizzle-orm";

import { db } from "@/server/db";
import { appointments } from "@/server/db/schema";
import { member } from "@/server/db/schema/auth";
import { timeExceptions, workingHours } from "@/server/db/schema/availability";

export interface Slot {
  startsAt: Date;
  endsAt: Date;
}

// Returns the UTC offset string (e.g. "-03:00") for a given timezone at a specific date.
// Uses Intl so DST-aware timezones are handled correctly.
export function getUtcOffset(timezone: string, nearDate: Date): string {
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
  });
  const raw =
    formatter.formatToParts(nearDate).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  // raw examples: "GMT-3", "GMT+5:30", "GMT"
  if (raw === "GMT") return "+00:00";
  const m = raw.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!m) return "+00:00";
  return `${m[1]}${m[2].padStart(2, "0")}:${(m[3] ?? "00").padStart(2, "0")}`;
}

function parseTimeOnDate(timeStr: string, dateStr: string, timezone: string): Date {
  const [h, m] = timeStr.split(":").map(Number);
  const nearDate = new Date(`${dateStr}T12:00:00Z`);
  const offset = getUtcOffset(timezone, nearDate);
  return new Date(
    `${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000${offset}`,
  );
}

function dayBoundariesUtc(dateStr: string, timezone: string): { start: Date; end: Date } {
  const nearDate = new Date(`${dateStr}T12:00:00Z`);
  const offset = getUtcOffset(timezone, nearDate);
  const start = new Date(`${dateStr}T00:00:00.000${offset}`);
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
  timezone: string,
  excludeAppointmentId?: string,
): Promise<Slot[]> {
  if (durationMinutes <= 0) return [];

  const nearDate = new Date(`${date}T12:00:00Z`);
  const offset = getUtcOffset(timezone, nearDate);
  const dayOfWeek = new Date(`${date}T12:00:00${offset}`).getUTCDay();
  const { start: dayStart, end: dayEnd } = dayBoundariesUtc(date, timezone);

  const hours = await db
    .select({
      startTime: workingHours.startTime,
      endTime: workingHours.endTime,
      breakStartTime: workingHours.breakStartTime,
      breakEndTime: workingHours.breakEndTime,
    })
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

  const workStart = parseTimeOnDate(hours[0].startTime, date, timezone);
  const workEnd = parseTimeOnDate(hours[0].endTime, date, timezone);
  const breakStart = hours[0].breakStartTime
    ? parseTimeOnDate(hours[0].breakStartTime, date, timezone)
    : null;
  const breakEnd = hours[0].breakEndTime
    ? parseTimeOnDate(hours[0].breakEndTime, date, timezone)
    : null;

  const candidates: Slot[] = [];
  let cursor = workStart;
  while (true) {
    const slotEnd = new Date(cursor.getTime() + durationMinutes * 60_000);
    if (slotEnd > workEnd) break;
    candidates.push({ startsAt: new Date(cursor), endsAt: slotEnd });
    cursor = slotEnd;
  }
  if (candidates.length === 0) return [];

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
        ...(excludeAppointmentId ? [ne(appointments.id, excludeAppointmentId)] : []),
      ),
    );

  const blocked = [...exceptions, ...busy].map((b) => ({
    start: new Date(b.startsAt),
    end: new Date(b.endsAt),
  }));

  if (breakStart && breakEnd) {
    blocked.push({ start: breakStart, end: breakEnd });
  }

  return candidates.filter(
    (slot) => !blocked.some((b) => overlaps(slot.startsAt, slot.endsAt, b.start, b.end)),
  );
}

export async function isProfessionalAvailableAt(
  orgId: string,
  professionalId: string,
  startsAt: Date,
  endsAt: Date,
  timezone: string,
  excludeAppointmentId?: string,
): Promise<boolean> {
  // Use local date (not UTC) to avoid off-by-one for late-night slots
  const date = startsAt.toLocaleDateString("sv-SE", { timeZone: timezone });
  const offset = getUtcOffset(timezone, startsAt);
  const dayOfWeek = new Date(`${date}T12:00:00${offset}`).getUTCDay();

  const hours = await db
    .select({
      startTime: workingHours.startTime,
      endTime: workingHours.endTime,
      breakStartTime: workingHours.breakStartTime,
      breakEndTime: workingHours.breakEndTime,
    })
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

  const workStart = parseTimeOnDate(hours[0].startTime, date, timezone);
  const workEnd = parseTimeOnDate(hours[0].endTime, date, timezone);
  if (startsAt < workStart || endsAt > workEnd) return false;

  if (hours[0].breakStartTime && hours[0].breakEndTime) {
    const breakStart = parseTimeOnDate(hours[0].breakStartTime, date, timezone);
    const breakEnd = parseTimeOnDate(hours[0].breakEndTime, date, timezone);
    if (overlaps(startsAt, endsAt, breakStart, breakEnd)) return false;
  }

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
        ...(excludeAppointmentId ? [ne(appointments.id, excludeAppointmentId)] : []),
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
  timezone: string,
): Promise<Slot[]> {
  if (memberId !== "any") {
    return getSlotsForProfessional(orgId, memberId, durationMinutes, date, timezone);
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
    const slots = await getSlotsForProfessional(orgId, p.userId, durationMinutes, date, timezone);
    for (const s of slots) {
      slotMap.set(s.startsAt.getTime(), s);
    }
  }

  return Array.from(slotMap.values()).sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );
}
