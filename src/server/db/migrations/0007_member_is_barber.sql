ALTER TABLE "member"
  ADD COLUMN IF NOT EXISTS "is_barber" boolean NOT NULL DEFAULT true;
