-- CreateTable
CREATE TABLE "ChildIssuePriority" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "clinicalLevel" "ClinicalLevel" NOT NULL,
    "strategy" "InterventionStrategy" NOT NULL,
    "priorityRank" INTEGER NOT NULL,
    "fromUserIssue" BOOLEAN NOT NULL DEFAULT false,
    "fromWacb" BOOLEAN NOT NULL DEFAULT false,
    "userIssues" TEXT,
    "wacbQuestions" TEXT,
    "wacbScore" INTEGER,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wacbSurveyId" TEXT,

    CONSTRAINT "ChildIssuePriority_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChildIssuePriority_childId_idx" ON "ChildIssuePriority"("childId");

-- CreateIndex
CREATE INDEX "ChildIssuePriority_childId_computedAt_idx" ON "ChildIssuePriority"("childId", "computedAt");

-- CreateIndex
CREATE INDEX "ChildIssuePriority_childId_clinicalLevel_computedAt_idx" ON "ChildIssuePriority"("childId", "clinicalLevel", "computedAt");

-- AddForeignKey
ALTER TABLE "ChildIssuePriority" ADD CONSTRAINT "ChildIssuePriority_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildIssuePriority" ADD CONSTRAINT "ChildIssuePriority_wacbSurveyId_fkey" FOREIGN KEY ("wacbSurveyId") REFERENCES "WacbSurvey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
