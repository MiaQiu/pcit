-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "selectedAboutChild" JSONB;

-- CreateTable
CREATE TABLE "ChildInsightHistory" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "insightKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "valence" TEXT NOT NULL,
    "shownAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChildInsightHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChildInsightHistory_childId_shownAt_idx" ON "ChildInsightHistory"("childId", "shownAt");

-- CreateIndex
CREATE INDEX "ChildInsightHistory_childId_insightKey_idx" ON "ChildInsightHistory"("childId", "insightKey");

-- AddForeignKey
ALTER TABLE "ChildInsightHistory" ADD CONSTRAINT "ChildInsightHistory_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildInsightHistory" ADD CONSTRAINT "ChildInsightHistory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
