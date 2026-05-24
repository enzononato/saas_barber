-- Customers table (CRM mínimo, identificado por telefone normalizado por org)
CREATE TABLE IF NOT EXISTS "customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" text NOT NULL,
  "phone" text NOT NULL,
  "name" text NOT NULL,
  "notes" text,
  "tags" text[] NOT NULL DEFAULT '{}'::text[],
  "is_blocked" boolean NOT NULL DEFAULT false,
  "first_seen_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_seen_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "customers_org_phone_uniq" UNIQUE("organization_id", "phone")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_organization_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_org_name_idx" ON "customers" USING btree ("organization_id","name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_org_last_seen_idx" ON "customers" USING btree ("organization_id","last_seen_at");
--> statement-breakpoint

-- Appointments: índice para queries de histórico por telefone
CREATE INDEX IF NOT EXISTS "appointments_org_customer_phone_idx"
  ON "appointments" USING btree ("organization_id","customer_phone","starts_at");
--> statement-breakpoint

-- WhatsApp settings: colunas de connection status
ALTER TABLE "whatsapp_settings"
  ADD COLUMN IF NOT EXISTS "connection_status" text NOT NULL DEFAULT 'disconnected';
--> statement-breakpoint
ALTER TABLE "whatsapp_settings"
  ADD COLUMN IF NOT EXISTS "connected_number" text;
--> statement-breakpoint
ALTER TABLE "whatsapp_settings"
  ADD COLUMN IF NOT EXISTS "last_sync_at" timestamp with time zone;
