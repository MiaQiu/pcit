-- CreateTable
CREATE TABLE "WacbSurvey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parentingStressLevel" INTEGER NOT NULL,
    "parentingStressChange" BOOLEAN NOT NULL,
    "q1Dawdle" INTEGER NOT NULL,
    "q1Change" BOOLEAN NOT NULL,
    "q2MealBehavior" INTEGER NOT NULL,
    "q2Change" BOOLEAN NOT NULL,
    "q3Disobey" INTEGER NOT NULL,
    "q3Change" BOOLEAN NOT NULL,
    "q4Angry" INTEGER NOT NULL,
    "q4Change" BOOLEAN NOT NULL,
    "q5Scream" INTEGER NOT NULL,
    "q5Change" BOOLEAN NOT NULL,
    "q6Destroy" INTEGER NOT NULL,
    "q6Change" BOOLEAN NOT NULL,
    "q7ProvokeFights" INTEGER NOT NULL,
    "q7Change" BOOLEAN NOT NULL,
    "q8Interrupt" INTEGER NOT NULL,
    "q8Change" BOOLEAN NOT NULL,
    "q9Attention" INTEGER NOT NULL,
    "q9Change" BOOLEAN NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "totalChangesNeeded" INTEGER NOT NULL,

    CONSTRAINT "WacbSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WacbSurvey_userId_idx" ON "WacbSurvey"("userId");

-- CreateIndex
CREATE INDEX "WacbSurvey_submittedAt_idx" ON "WacbSurvey"("submittedAt");

-- AddForeignKey
ALTER TABLE "WacbSurvey" ADD CONSTRAINT "WacbSurvey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
