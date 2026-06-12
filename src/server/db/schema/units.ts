import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
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
import { services } from "./services";

// Unidade (filial) de uma barbearia. Uma organização pode ter várias.
export const units = pgTable(
  "units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug"),
    address: text("address"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    // Link original colado pelo dono (Google Maps), para referência/reextração.
    googleMapsUrl: text("google_maps_url"),
    phone: text("phone"),
    isActive: boolean("is_active").notNull().default(true),
    // Ordenação na vitrine pública.
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("units_organization_idx").on(table.organizationId),
    unique("units_org_slug_uniq").on(table.organizationId, table.slug),
    check(
      "units_lat_range_check",
      sql`${table.lat} IS NULL OR (${table.lat} BETWEEN -90 AND 90)`,
    ),
    check(
      "units_lng_range_check",
      sql`${table.lng} IS NULL OR (${table.lng} BETWEEN -180 AND 180)`,
    ),
  ],
);

// Vínculo N:N entre profissional/recepcionista e unidades em que atua.
export const memberUnits = pgTable(
  "member_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("member_units_member_unit_uniq").on(table.memberId, table.unitId),
    index("member_units_member_idx").on(table.memberId),
    index("member_units_unit_idx").on(table.unitId),
  ],
);

// Preço (e disponibilidade) de um serviço por unidade.
// Ausência de registro = serviço não oferecido naquela unidade.
export const serviceUnits = pgTable(
  "service_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("service_units_service_unit_uniq").on(table.serviceId, table.unitId),
    index("service_units_service_idx").on(table.serviceId),
    index("service_units_unit_idx").on(table.unitId),
    check("service_units_price_check", sql`${table.price} >= 0`),
  ],
);
