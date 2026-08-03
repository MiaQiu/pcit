-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN "shareCountBase" INTEGER NOT NULL DEFAULT 0;

-- Backfill: give every existing lesson a random base offset (100-500), same
-- range POST /api/admin/lessons rolls for new lessons, so old lessons don't
-- start at a suspiciously round 0.
UPDATE "Lesson" SET "shareCountBase" = floor(random() * 401 + 100)::int;
