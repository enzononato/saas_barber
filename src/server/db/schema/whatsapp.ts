import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organization } from "./auth";

const DEFAULT_BOOKING_TEMPLATE =
  "Olá {{nome}}! ✅ Agendamento confirmado para {{data}} às {{hora}} com {{barbeiro}} ({{servico}}). Até lá! ✂️";

const DEFAULT_FOLLOWUP_TEMPLATE =
  "Olá {{nome}}! Já faz {{dias}} dias desde o seu último corte 😄 Que tal agendar? {{link}}";

const DEFAULT_REMINDER_TEMPLATE =
  "Olá {{nome}}! Passando para lembrar do seu horário hoje às {{hora}} com {{barbeiro}}. Até já! ✂️";

export const whatsappSettings = pgTable("whatsapp_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .notNull()
    .unique()
    .references(() => organization.id, { onDelete: "cascade" }),
  isEnabled: boolean("is_enabled").notNull().default(false),
  // Deprecated em favor do fluxo global Evolution (env vars), mantido pra compat com dados antigos
  apiUrl: text("api_url"),
  apiKey: text("api_key"),
  instanceName: text("instance_name"),
  // Status de conexão da instância Evolution
  connectionStatus: text("connection_status").notNull().default("disconnected"),
  connectedNumber: text("connected_number"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  // Automações
  followUpDays: integer("follow_up_days").notNull().default(30),
  bookingTemplate: text("booking_template").notNull().default(DEFAULT_BOOKING_TEMPLATE),
  followUpTemplate: text("follow_up_template").notNull().default(DEFAULT_FOLLOWUP_TEMPLATE),
  // Lembrete pré-agendamento
  reminderEnabled: boolean("reminder_enabled").notNull().default(true),
  reminderHoursBefore: integer("reminder_hours_before").notNull().default(2),
  reminderTemplate: text("reminder_template").notNull().default(DEFAULT_REMINDER_TEMPLATE),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const followUpLog = pgTable(
  "follow_up_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    customerPhone: text("customer_phone").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("follow_up_log_org_phone_idx").on(table.organizationId, table.customerPhone)],
);

export const WHATSAPP_DEFAULTS = {
  bookingTemplate: DEFAULT_BOOKING_TEMPLATE,
  followUpTemplate: DEFAULT_FOLLOWUP_TEMPLATE,
  reminderTemplate: DEFAULT_REMINDER_TEMPLATE,
} as const;
