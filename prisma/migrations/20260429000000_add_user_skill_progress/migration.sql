-- CreateTable
CREATE TABLE "UserSkillProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "masteredCorrections" BOOLEAN NOT NULL DEFAULT false,
    "masteredLeading" BOOLEAN NOT NULL DEFAULT false,
    "masteredPraise" BOOLEAN NOT NULL DEFAULT false,
    "masteredEcho" BOOLEAN NOT NULL DEFAULT false,
    "unlockedEffortPraise" BOOLEAN NOT NULL DEFAULT false,
    "unlockedRegulatoryPraise" BOOLEAN NOT NULL DEFAULT false,
    "cleanCorrectionsSessions" INTEGER NOT NULL DEFAULT 0,
    "cleanLeadingSessions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSkillProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserSkillProgress_userId_idx" ON "UserSkillProgress"("userId");

-- CreateIndex
CREATE INDEX "UserSkillProgress_childId_idx" ON "UserSkillProgress"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSkillProgress_userId_childId_key" ON "UserSkillProgress"("userId", "childId");

-- AddForeignKey
ALTER TABLE "UserSkillProgress" ADD CONSTRAINT "UserSkillProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkillProgress" ADD CONSTRAINT "UserSkillProgress_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
