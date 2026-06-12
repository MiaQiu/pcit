-- AlterTable: replace behaviors/intensity/durationBucket with situations/places/persons
ALTER TABLE "AbcLog"
  ADD COLUMN "situations" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "places"     TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "persons"    TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE "AbcLog"
  DROP COLUMN IF EXISTS "behaviors",
  DROP COLUMN IF EXISTS "intensity",
  DROP COLUMN IF EXISTS "durationBucket";
