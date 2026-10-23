-- Parent-input survey answers for Learn modules (e.g. screen-time endings).

-- CreateTable
CREATE TABLE "LearnModuleSurvey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearnModuleSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearnModuleSurvey_userId_moduleKey_submittedAt_idx" ON "LearnModuleSurvey"("userId", "moduleKey", "submittedAt");

-- AddForeignKey
ALTER TABLE "LearnModuleSurvey" ADD CONSTRAINT "LearnModuleSurvey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
