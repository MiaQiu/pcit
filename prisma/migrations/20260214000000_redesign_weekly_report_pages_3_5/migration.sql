-- AlterTable: Add new celebration fields for pages 3 and 5
ALTER TABLE "WeeklyReport" ADD COLUMN "parentGrowthNarrative" TEXT;
ALTER TABLE "WeeklyReport" ADD COLUMN "growthMetrics" JSONB;
ALTER TABLE "WeeklyReport" ADD COLUMN "noraObservation" TEXT;
ALTER TABLE "WeeklyReport" ADD COLUMN "childSpotlight" TEXT;
ALTER TABLE "WeeklyReport" ADD COLUMN "growthSnapshots" JSONB;
ALTER TABLE "WeeklyReport" ADD COLUMN "childProgressNote" TEXT;
