-- Push subscriptions (PWA web push)
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");
--> statement-breakpoint

-- WhatsApp settings (1 per organization)
CREATE TABLE IF NOT EXISTS "whatsapp_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" text NOT NULL,
  "is_enabled" boolean DEFAULT false NOT NULL,
  "api_url" text,
  "api_key" text,
  "instance_name" text,
  "follow_up_days" integer DEFAULT 30 NOT NULL,
  "booking_template" text DEFAULT 'Olá {{nome}}! ✅ Agendamento confirmado para {{data}} às {{hora}} com {{barbeiro}} ({{servico}}). Até lá! ✂️' NOT NULL,
  "follow_up_template" text DEFAULT 'Olá {{nome}}! Já faz {{dias}} dias desde o seu último corte 😄 Que tal agendar? {{link}}' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "whatsapp_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "whatsapp_settings" ADD CONSTRAINT "whatsapp_settings_organization_id_organization_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

-- Follow-up log (dedup of reactivation messages)
CREATE TABLE IF NOT EXISTS "follow_up_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" text NOT NULL,
  "customer_phone" text NOT NULL,
  "sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "follow_up_log" ADD CONSTRAINT "follow_up_log_organization_id_organization_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "follow_up_log_org_phone_idx" ON "follow_up_log" USING btree ("organization_id","customer_phone");
