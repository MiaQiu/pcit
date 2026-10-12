-- Learn module reports generated from the "Tell Nora" survey (no recording).

-- AlterTable
ALTER TABLE "LearnModuleSurvey" ADD COLUMN "readableAnswers" JSONB,
ADD COLUMN "language" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN "moduleSurveyId" TEXT;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_moduleSurveyId_fkey" FOREIGN KEY ("moduleSurveyId") REFERENCES "LearnModuleSurvey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
