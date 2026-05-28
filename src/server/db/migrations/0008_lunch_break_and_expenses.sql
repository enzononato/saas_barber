-- 0008: Lunch break in working_hours + expenses table
-- Idempotent: safe to re-run

ALTER TABLE "working_hours"
  ADD COLUMN IF NOT EXISTS "break_start_time" time,
  ADD COLUMN IF NOT EXISTS "break_end_time" time;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'working_hours_break_range_check'
  ) THEN
    ALTER TABLE "working_hours"
      ADD CONSTRAINT "working_hours_break_range_check"
      CHECK (
        (break_start_time IS NULL AND break_end_time IS NULL) OR
        (break_start_time IS NOT NULL AND break_end_time IS NOT NULL
         AND break_start_time < break_end_time
         AND break_start_time >= start_time
         AND break_end_time <= end_time)
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "expenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "description" text NOT NULL,
  "category" text,
  "amount" numeric(10,2) NOT NULL CHECK (amount >= 0),
  "date" date NOT NULL,
  "created_by_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "expenses_org_date_idx" ON "expenses"("organization_id", "date");
