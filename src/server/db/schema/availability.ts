import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { organization, user } from "./auth";

export const workingHours = pgTable(
  "working_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    professionalId: text("professional_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    dayOfWeek: smallint("day_of_week").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    breakStartTime: time("break_start_time"),
    breakEndTime: time("break_end_time"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("working_hours_professional_day_idx").on(table.professionalId, table.dayOfWeek),
    check(
      "working_hours_day_of_week_check",
      sql`${table.dayOfWeek} BETWEEN 0 AND 6`,
    ),
    check(
      "working_hours_time_range_check",
      sql`${table.startTime} < ${table.endTime}`,
    ),
  ],
);

export const timeExceptions = pgTable(
  "time_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    professionalId: text("professional_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("time_exceptions_professional_idx").on(table.professionalId, table.startsAt),
    check(
      "time_exceptions_range_check",
      sql`${table.startsAt} < ${table.endsAt}`,
    ),
  ],
);
