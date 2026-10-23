-- CreateTable
CREATE TABLE "ModuleStrategyFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "tried" TEXT NOT NULL,
    "outcome" TEXT,
    "obstacle" TEXT,
    "nextStep" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleStrategyFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModuleStrategyFeedback_userId_moduleKey_createdAt_idx" ON "ModuleStrategyFeedback"("userId", "moduleKey", "createdAt");

-- AddForeignKey
ALTER TABLE "ModuleStrategyFeedback" ADD CONSTRAINT "ModuleStrategyFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
