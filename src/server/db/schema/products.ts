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
  uuid,
} from "drizzle-orm/pg-core";

import { organization } from "./auth";
import { appointments } from "./appointments";

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    costPrice: numeric("cost_price", { precision: 10, scale: 2 }).notNull().default("0"),
    stockQuantity: integer("stock_quantity").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("products_org_idx").on(table.organizationId),
    check("products_price_check", sql`${table.price} >= 0`),
    check("products_cost_price_check", sql`${table.costPrice} >= 0`),
  ],
);

// Venda de produtos vinculada ao fechamento (checkout) de um agendamento.
export const appointmentProducts = pgTable(
  "appointment_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    productNameAtSale: text("product_name_at_sale").notNull(),
    quantity: integer("quantity").notNull().default(1),
    priceAtSale: numeric("price_at_sale", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("appointment_products_appointment_idx").on(table.appointmentId),
    index("appointment_products_product_idx").on(table.productId),
    check("appointment_products_quantity_check", sql`${table.quantity} > 0`),
    check("appointment_products_price_check", sql`${table.priceAtSale} >= 0`),
  ],
);
