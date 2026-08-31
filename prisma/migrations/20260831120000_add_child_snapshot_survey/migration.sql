-- CreateTable
CREATE TABLE "ChildSnapshotSurvey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parentingStressLevel" INTEGER NOT NULL,
    "q1Dawdle" INTEGER NOT NULL,
    "q2Disobey" INTEGER NOT NULL,
    "q3Tantrum" INTEGER NOT NULL,
    "q4Defiance" INTEGER NOT NULL,
    "q5FocusDemand" INTEGER NOT NULL,
    "q6Restless" INTEGER NOT NULL,
    "q7TaskCompletion" INTEGER NOT NULL,
    "q8Destroy" INTEGER NOT NULL,
    "q9Aggression" INTEGER NOT NULL,
    "q10LieSteal" INTEGER NOT NULL,
    "totalScore" INTEGER NOT NULL,

    CONSTRAINT "ChildSnapshotSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChildSnapshotSurvey_submittedAt_idx" ON "ChildSnapshotSurvey"("submittedAt");

-- CreateIndex
CREATE INDEX "ChildSnapshotSurvey_userId_idx" ON "ChildSnapshotSurvey"("userId");

-- AlterTable
ALTER TABLE "ChildIssuePriority" ADD COLUMN "snapshotSurveyId" TEXT;

-- AddForeignKey
ALTER TABLE "ChildSnapshotSurvey" ADD CONSTRAINT "ChildSnapshotSurvey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildIssuePriority" ADD CONSTRAINT "ChildIssuePriority_snapshotSurveyId_fkey" FOREIGN KEY ("snapshotSurveyId") REFERENCES "ChildSnapshotSurvey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
