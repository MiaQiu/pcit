-- Restore legacy fields dropped in 20260602000000_abc_logs_restructure.
-- Kept as nullable so old app versions can still write them without error.
ALTER TABLE "AbcLog"
  ADD COLUMN IF NOT EXISTS "behaviors"      TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "intensity"      INTEGER,
  ADD COLUMN IF NOT EXISTS "durationBucket" TEXT;
