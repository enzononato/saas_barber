import { sql } from "drizzle-orm";
import {
  check,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { organization, user } from "./auth";
import { services } from "./services";

export const appointmentStatus = pgEnum("appointment_status", [
  "SCHEDULED",
  "COMPLETED",
  "CANCELED",
  "NO_SHOW",
]);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    professionalId: text("professional_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    serviceNameAtBooking: text("service_name_at_booking").notNull(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: appointmentStatus("status").notNull().default("SCHEDULED"),
    priceAtBooking: numeric("price_at_booking", { precision: 10, scale: 2 }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("appointments_professional_starts_at_idx").on(
      table.professionalId,
      table.startsAt,
    ),
    index("appointments_organization_status_idx").on(
      table.organizationId,
      table.status,
      table.startsAt,
    ),
    check(
      "appointments_time_range_check",
      sql`${table.startsAt} < ${table.endsAt}`,
    ),
    check(
      "appointments_price_non_negative_check",
      sql`${table.priceAtBooking} >= 0`,
    ),
  ],
);
