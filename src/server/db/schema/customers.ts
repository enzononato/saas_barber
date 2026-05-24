import { boolean, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { organization } from "./auth";

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    name: text("name").notNull(),
    notes: text("notes"),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    isBlocked: boolean("is_blocked").notNull().default(false),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("customers_org_phone_uniq").on(table.organizationId, table.phone),
    index("customers_org_name_idx").on(table.organizationId, table.name),
    index("customers_org_last_seen_idx").on(table.organizationId, table.lastSeenAt),
  ],
);

export type LoyaltyTier = "novo" | "recorrente" | "fiel" | "vip";

export function loyaltyTierForVisits(completedVisits: number): LoyaltyTier {
  if (completedVisits >= 15) return "vip";
  if (completedVisits >= 5) return "fiel";
  if (completedVisits >= 2) return "recorrente";
  return "novo";
}
