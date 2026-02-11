-- CreateTable
CREATE TABLE "WeeklyReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "childId" TEXT,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "weekEndDate" TIMESTAMP(3) NOT NULL,
    "visibility" BOOLEAN NOT NULL DEFAULT false,
    "headline" TEXT,
    "totalDeposits" INTEGER NOT NULL DEFAULT 0,
    "massageTimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "praiseCount" INTEGER NOT NULL DEFAULT 0,
    "echoCount" INTEGER NOT NULL DEFAULT 0,
    "narrateCount" INTEGER NOT NULL DEFAULT 0,
    "skillCelebrationTitle" TEXT,
    "scenarioCards" JSONB,
    "topMoments" JSONB,
    "milestones" JSONB,
    "focusHeading" TEXT,
    "focusSubtext" TEXT,
    "whyExplanation" TEXT,
    "moodSelection" TEXT,
    "issueRatings" JSONB,
    "sessionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyReport_userId_idx" ON "WeeklyReport"("userId");

-- CreateIndex
CREATE INDEX "WeeklyReport_userId_weekStartDate_idx" ON "WeeklyReport"("userId", "weekStartDate");

-- CreateIndex
CREATE INDEX "WeeklyReport_weekStartDate_weekEndDate_idx" ON "WeeklyReport"("weekStartDate", "weekEndDate");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReport_userId_weekStartDate_key" ON "WeeklyReport"("userId", "weekStartDate");

-- AddForeignKey
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE SET NULL ON UPDATE CASCADE;
