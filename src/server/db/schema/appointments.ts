import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
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

export const PAYMENT_METHODS = ["CASH", "PIX", "CREDIT_CARD", "DEBIT_CARD"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

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
    // POS / fechamento de caixa
    paymentMethod: text("payment_method"),
    tipAmount: numeric("tip_amount", { precision: 10, scale: 2 }).notNull().default("0"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Lembrete pré-agendamento (WhatsApp)
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
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
    check(
      "appointments_payment_method_check",
      sql`${table.paymentMethod} IS NULL OR ${table.paymentMethod} IN ('CASH','PIX','CREDIT_CARD','DEBIT_CARD')`,
    ),
    check("appointments_tip_non_negative_check", sql`${table.tipAmount} >= 0`),
  ],
);

// Itens de serviço de um agendamento multi-serviço (Corte + Barba + ...).
// O registro principal em `appointments` mantém o snapshot agregado
// (nome concatenado, preço total, duração total); aqui fica o detalhamento.
export const appointmentServices = pgTable(
  "appointment_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    serviceNameAtBooking: text("service_name_at_booking").notNull(),
    priceAtBooking: numeric("price_at_booking", { precision: 10, scale: 2 }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("appointment_services_appointment_idx").on(table.appointmentId),
    index("appointment_services_service_idx").on(table.serviceId),
    check("appointment_services_price_check", sql`${table.priceAtBooking} >= 0`),
    check("appointment_services_duration_check", sql`${table.durationMinutes} > 0`),
  ],
);
