-- 0011: Multi-unidade (filiais). Tabelas units, member_units, service_units
--       e coluna unit_id (nullable) nas tabelas operacionais.
-- Idempotent: safe to re-run.
-- A coluna unit_id fica NULLABLE nesta fase; o backfill (0012) cria a unidade
-- "Matriz" e popula os registros existentes antes de torná-la obrigatória.

-- ── Unidades (filiais) ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "units" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "slug" text,
  "address" text,
  "lat" double precision,
  "lng" double precision,
  "google_maps_url" text,
  "phone" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "units_org_slug_uniq" UNIQUE ("organization_id", "slug"),
  CONSTRAINT "units_lat_range_check" CHECK ("lat" IS NULL OR ("lat" BETWEEN -90 AND 90)),
  CONSTRAINT "units_lng_range_check" CHECK ("lng" IS NULL OR ("lng" BETWEEN -180 AND 180))
);

CREATE INDEX IF NOT EXISTS "units_organization_idx" ON "units"("organization_id");

-- ── Vínculo profissional/recepcionista ↔ unidades (N:N) ──────────────────────
CREATE TABLE IF NOT EXISTS "member_units" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "member_id" text NOT NULL REFERENCES "member"("id") ON DELETE CASCADE,
  "unit_id" uuid NOT NULL REFERENCES "units"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "member_units_member_unit_uniq" UNIQUE ("member_id", "unit_id")
);

CREATE INDEX IF NOT EXISTS "member_units_member_idx" ON "member_units"("member_id");
CREATE INDEX IF NOT EXISTS "member_units_unit_idx" ON "member_units"("unit_id");

-- ── Preço de serviço por unidade ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "service_units" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "service_id" uuid NOT NULL REFERENCES "services"("id") ON DELETE CASCADE,
  "unit_id" uuid NOT NULL REFERENCES "units"("id") ON DELETE CASCADE,
  "price" numeric(10,2) NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "service_units_service_unit_uniq" UNIQUE ("service_id", "unit_id"),
  CONSTRAINT "service_units_price_check" CHECK ("price" >= 0)
);

CREATE INDEX IF NOT EXISTS "service_units_service_idx" ON "service_units"("service_id");
CREATE INDEX IF NOT EXISTS "service_units_unit_idx" ON "service_units"("unit_id");

-- ── Coluna unit_id (nullable) nas tabelas operacionais ───────────────────────
ALTER TABLE "appointments"
  ADD COLUMN IF NOT EXISTS "unit_id" uuid REFERENCES "units"("id") ON DELETE RESTRICT;

ALTER TABLE "working_hours"
  ADD COLUMN IF NOT EXISTS "unit_id" uuid REFERENCES "units"("id") ON DELETE CASCADE;

ALTER TABLE "time_exceptions"
  ADD COLUMN IF NOT EXISTS "unit_id" uuid REFERENCES "units"("id") ON DELETE CASCADE;

ALTER TABLE "expenses"
  ADD COLUMN IF NOT EXISTS "unit_id" uuid REFERENCES "units"("id") ON DELETE SET NULL;

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "unit_id" uuid REFERENCES "units"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "appointments_unit_starts_at_idx"
  ON "appointments"("unit_id", "starts_at");
