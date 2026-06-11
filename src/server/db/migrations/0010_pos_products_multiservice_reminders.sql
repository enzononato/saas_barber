-- 0010: POS checkout (payment method + tip), products, multi-service appointments,
--       WhatsApp pre-appointment reminders, receptionist role support.
-- Idempotent: safe to re-run.

-- ── Appointments: checkout + reminder tracking ──────────────────────────────
ALTER TABLE "appointments"
  ADD COLUMN IF NOT EXISTS "payment_method" text,
  ADD COLUMN IF NOT EXISTS "tip_amount" numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "completed_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "reminder_sent_at" timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_payment_method_check'
  ) THEN
    ALTER TABLE "appointments"
      ADD CONSTRAINT "appointments_payment_method_check"
      CHECK (payment_method IS NULL OR payment_method IN ('CASH','PIX','CREDIT_CARD','DEBIT_CARD'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_tip_non_negative_check'
  ) THEN
    ALTER TABLE "appointments"
      ADD CONSTRAINT "appointments_tip_non_negative_check"
      CHECK (tip_amount >= 0);
  END IF;
END $$;

-- ── Multi-service: itens de serviço por agendamento ─────────────────────────
CREATE TABLE IF NOT EXISTS "appointment_services" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "appointment_id" uuid NOT NULL REFERENCES "appointments"("id") ON DELETE CASCADE,
  "service_id" uuid NOT NULL REFERENCES "services"("id") ON DELETE RESTRICT,
  "service_name_at_booking" text NOT NULL,
  "price_at_booking" numeric(10,2) NOT NULL,
  "duration_minutes" integer NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "appointment_services_price_check" CHECK (price_at_booking >= 0),
  CONSTRAINT "appointment_services_duration_check" CHECK (duration_minutes > 0)
);

CREATE INDEX IF NOT EXISTS "appointment_services_appointment_idx"
  ON "appointment_services"("appointment_id");
CREATE INDEX IF NOT EXISTS "appointment_services_service_idx"
  ON "appointment_services"("service_id");

-- ── Produtos físicos ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "price" numeric(10,2) NOT NULL,
  "cost_price" numeric(10,2) NOT NULL DEFAULT 0,
  "stock_quantity" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "products_price_check" CHECK (price >= 0),
  CONSTRAINT "products_cost_price_check" CHECK (cost_price >= 0)
);

CREATE INDEX IF NOT EXISTS "products_org_idx" ON "products"("organization_id");

-- Vendas de produtos amarradas ao fechamento de um agendamento
CREATE TABLE IF NOT EXISTS "appointment_products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "appointment_id" uuid NOT NULL REFERENCES "appointments"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
  "product_name_at_sale" text NOT NULL,
  "quantity" integer NOT NULL DEFAULT 1,
  "price_at_sale" numeric(10,2) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "appointment_products_quantity_check" CHECK (quantity > 0),
  CONSTRAINT "appointment_products_price_check" CHECK (price_at_sale >= 0)
);

CREATE INDEX IF NOT EXISTS "appointment_products_appointment_idx"
  ON "appointment_products"("appointment_id");
CREATE INDEX IF NOT EXISTS "appointment_products_product_idx"
  ON "appointment_products"("product_id");

-- ── WhatsApp: lembrete pré-agendamento ───────────────────────────────────────
ALTER TABLE "whatsapp_settings"
  ADD COLUMN IF NOT EXISTS "reminder_enabled" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "reminder_hours_before" integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "reminder_template" text NOT NULL DEFAULT 'Olá {{nome}}! Passando para lembrar do seu horário hoje às {{hora}} com {{barbeiro}}. Até já! ✂️';

-- Índice para a varredura do cron de lembretes
CREATE INDEX IF NOT EXISTS "appointments_reminder_scan_idx"
  ON "appointments"("organization_id", "starts_at")
  WHERE "status" = 'SCHEDULED' AND "reminder_sent_at" IS NULL;
