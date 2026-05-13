-- ---------------------------------------------------------------------------
-- Anti double-booking: database-level guarantee that two active appointments
-- for the same professional cannot overlap in time.
--
-- Strategy (per PRD §3): combine a generated tstzrange column with a Postgres
-- Exclusion Constraint backed by a GiST index. The btree_gist extension lets
-- us mix equality (professional_id) with range overlap (time_range) in the
-- same constraint.
--
-- The WHERE predicate scopes the constraint to active statuses only, so
-- cancellations and no-shows free the slot for re-booking.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint

ALTER TABLE "appointments"
  ADD COLUMN "time_range" tstzrange
  GENERATED ALWAYS AS (tstzrange("starts_at", "ends_at", '[)')) STORED;
--> statement-breakpoint

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (
    "professional_id" WITH =,
    "time_range" WITH &&
  )
  WHERE (status IN ('SCHEDULED', 'COMPLETED'));
