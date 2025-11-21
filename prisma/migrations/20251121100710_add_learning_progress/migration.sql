-- CreateTable
CREATE TABLE "LearningProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentDeck" INTEGER NOT NULL DEFAULT 1,
    "unlockedDecks" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LearningProgress_userId_key" ON "LearningProgress"("userId");

-- CreateIndex
CREATE INDEX "LearningProgress_userId_idx" ON "LearningProgress"("userId");

-- AddForeignKey
ALTER TABLE "LearningProgress" ADD CONSTRAINT "LearningProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
