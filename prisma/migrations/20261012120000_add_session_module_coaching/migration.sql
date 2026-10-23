-- Learn module recordings (e.g. screen-time endings): module tag + LLM coaching/plan payload.

-- AlterTable
ALTER TABLE "Session" ADD COLUMN "moduleKey" TEXT,
ADD COLUMN "moduleCoaching" JSONB;

-- CreateIndex
CREATE INDEX "Session_userId_moduleKey_idx" ON "Session"("userId", "moduleKey");
