import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { member, organization } from "./auth";

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes").notNull(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("services_organization_idx").on(table.organizationId),
    check("services_duration_positive_check", sql`${table.durationMinutes} > 0`),
    check("services_price_non_negative_check", sql`${table.price} >= 0`),
  ],
);

export const barberServices = pgTable(
  "barber_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("barber_services_member_service_uniq").on(table.memberId, table.serviceId),
    index("barber_services_member_idx").on(table.memberId),
    index("barber_services_service_idx").on(table.serviceId),
  ],
);
