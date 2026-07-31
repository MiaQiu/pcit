-- CreateEnum
CREATE TYPE "HomeCardComponentType" AS ENUM ('TEXT', 'IMAGE', 'OPEN_DETAILS', 'USER_INPUT');

-- CreateTable
CREATE TABLE "HomeCardBadge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#8C49D5',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeCardBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HomeCardBadge_name_key" ON "HomeCardBadge"("name");

-- Backfill: one HomeCardBadge per distinct (badgeText, badgeColor) pair
-- already used by an existing HomeCard, so no card loses its badge.
INSERT INTO "HomeCardBadge" ("id", "name", "color")
SELECT gen_random_uuid()::text, t."badgeText", t."badgeColor"
FROM (SELECT DISTINCT "badgeText", "badgeColor" FROM "HomeCard") t
ON CONFLICT ("name") DO NOTHING;

-- Seed the requested default badge list (no-op for any name already backfilled above).
INSERT INTO "HomeCardBadge" ("id", "name", "color") VALUES
  (gen_random_uuid()::text, 'Science Bite', '#3B82F6'),
  (gen_random_uuid()::text, 'Try This Today', '#10B981'),
  (gen_random_uuid()::text, 'Quick Reflection', '#8C49D5'),
  (gen_random_uuid()::text, 'Today''s Thought', '#F59E0B'),
  (gen_random_uuid()::text, 'Community Wisdom', '#EC4899')
ON CONFLICT ("name") DO NOTHING;

-- AlterTable: add badgeId nullable first, backfill from the join, then
-- tighten to NOT NULL once every row has one.
ALTER TABLE "HomeCard" ADD COLUMN "badgeId" TEXT;

UPDATE "HomeCard" h
SET "badgeId" = b."id"
FROM "HomeCardBadge" b
WHERE b."name" = h."badgeText" AND b."color" = h."badgeColor";

ALTER TABLE "HomeCard" ALTER COLUMN "badgeId" SET NOT NULL;

ALTER TABLE "HomeCard" DROP COLUMN "badgeColor",
DROP COLUMN "badgeText";

-- AddForeignKey
ALTER TABLE "HomeCard" ADD CONSTRAINT "HomeCard_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "HomeCardBadge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "HomeCardComponent" (
    "id" TEXT NOT NULL,
    "homeCardId" TEXT NOT NULL,
    "type" "HomeCardComponentType" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT,
    "image" TEXT,
    "linkedCardId" TEXT,
    "ctaLabel" TEXT,
    "inputLabel" TEXT,
    "inputPlaceholder" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeCardComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeCardComponent_homeCardId_order_idx" ON "HomeCardComponent"("homeCardId", "order");

-- AddForeignKey
ALTER TABLE "HomeCardComponent" ADD CONSTRAINT "HomeCardComponent_homeCardId_fkey" FOREIGN KEY ("homeCardId") REFERENCES "HomeCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeCardComponent" ADD CONSTRAINT "HomeCardComponent_linkedCardId_fkey" FOREIGN KEY ("linkedCardId") REFERENCES "HomeCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: one TEXT component (order 0) per existing non-empty detailContent.
INSERT INTO "HomeCardComponent" ("id", "homeCardId", "type", "order", "text", "updatedAt")
SELECT gen_random_uuid()::text, "id", 'TEXT', 0, "detailContent", CURRENT_TIMESTAMP
FROM "HomeCard"
WHERE "detailContent" IS NOT NULL AND "detailContent" <> '';

-- AlterTable
ALTER TABLE "HomeCard" DROP COLUMN "detailContent";

-- CreateTable
CREATE TABLE "HomeCardUserInputResponse" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeCardUserInputResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeCardUserInputResponse_userId_idx" ON "HomeCardUserInputResponse"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeCardUserInputResponse_componentId_userId_key" ON "HomeCardUserInputResponse"("componentId", "userId");

-- AddForeignKey
ALTER TABLE "HomeCardUserInputResponse" ADD CONSTRAINT "HomeCardUserInputResponse_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "HomeCardComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeCardUserInputResponse" ADD CONSTRAINT "HomeCardUserInputResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
