-- AlterTable
ALTER TABLE "HomeCard" ADD COLUMN "likeCountBase" INTEGER NOT NULL DEFAULT 0;

-- Backfill: give every existing card a random base offset (100-500), same
-- range POST /api/admin/home-cards rolls for new cards, so old cards don't
-- start at a suspiciously round 0.
UPDATE "HomeCard" SET "likeCountBase" = floor(random() * 401 + 100)::int;
