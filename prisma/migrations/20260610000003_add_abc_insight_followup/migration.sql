-- Add follow-up fields to AbcInsight for Phase 5: follow-up loop
ALTER TABLE "AbcInsight" ADD COLUMN "followUpRating" INTEGER;
ALTER TABLE "AbcInsight" ADD COLUMN "followUpNote" TEXT;
ALTER TABLE "AbcInsight" ADD COLUMN "followUpAt" TIMESTAMP(3);
