-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "coachingCards" JSONB;

-- CreateTable
CREATE TABLE "ChildProfiling" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "summary" TEXT,
    "domains" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildProfiling_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChildProfiling_sessionId_key" ON "ChildProfiling"("sessionId");

-- CreateIndex
CREATE INDEX "ChildProfiling_userId_idx" ON "ChildProfiling"("userId");

-- CreateIndex
CREATE INDEX "ChildProfiling_userId_createdAt_idx" ON "ChildProfiling"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChildProfiling" ADD CONSTRAINT "ChildProfiling_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildProfiling" ADD CONSTRAINT "ChildProfiling_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
