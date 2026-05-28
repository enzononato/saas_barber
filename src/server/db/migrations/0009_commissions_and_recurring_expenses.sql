-- 0009: Commissions per barber × service + recurring/attributed expenses
-- Idempotent: safe to re-run

ALTER TABLE "barber_services"
  ADD COLUMN IF NOT EXISTS "commission_pct" numeric(5,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'barber_services_commission_range_check'
  ) THEN
    ALTER TABLE "barber_services"
      ADD CONSTRAINT "barber_services_commission_range_check"
      CHECK (commission_pct >= 0 AND commission_pct <= 100);
  END IF;
END $$;

ALTER TABLE "expenses"
  ADD COLUMN IF NOT EXISTS "is_recurring" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "attributed_to_user_id" text REFERENCES "user"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "expenses_org_attributed_idx"
  ON "expenses"("organization_id", "attributed_to_user_id");
