-- AlterTable: Add trend, consistency, growth, and generation metadata fields
ALTER TABLE "WeeklyReport" ADD COLUMN "depositsTrend" TEXT;
ALTER TABLE "WeeklyReport" ADD COLUMN "depositsChangePercent" INTEGER;
ALTER TABLE "WeeklyReport" ADD COLUMN "trendMessage" TEXT;
ALTER TABLE "WeeklyReport" ADD COLUMN "sessionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WeeklyReport" ADD COLUMN "uniqueDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WeeklyReport" ADD COLUMN "consistencyMessage" TEXT;
ALTER TABLE "WeeklyReport" ADD COLUMN "strongestGrowthArea" TEXT;
ALTER TABLE "WeeklyReport" ADD COLUMN "avgNoraScore" INTEGER;
ALTER TABLE "WeeklyReport" ADD COLUMN "childResponseSummary" TEXT;
ALTER TABLE "WeeklyReport" ADD COLUMN "generatedAt" TIMESTAMP(3);
ALTER TABLE "WeeklyReport" ADD COLUMN "generationVersion" INTEGER NOT NULL DEFAULT 1;
