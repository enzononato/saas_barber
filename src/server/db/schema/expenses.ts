import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { organization, user } from "./auth";

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    category: text("category"),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    date: date("date").notNull(),
    isRecurring: boolean("is_recurring").notNull().default(false),
    attributedToUserId: text("attributed_to_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("expenses_org_date_idx").on(table.organizationId, table.date),
    index("expenses_org_attributed_idx").on(table.organizationId, table.attributedToUserId),
    check("expenses_amount_check", sql`${table.amount} >= 0`),
  ],
);
