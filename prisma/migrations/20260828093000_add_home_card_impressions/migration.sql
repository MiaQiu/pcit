-- CreateTable
CREATE TABLE "HomeCardImpression" (
    "id" TEXT NOT NULL,
    "homeCardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shownDate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeCardImpression_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeCardImpression_userId_idx" ON "HomeCardImpression"("userId");

-- CreateIndex
CREATE INDEX "HomeCardImpression_homeCardId_idx" ON "HomeCardImpression"("homeCardId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeCardImpression_userId_shownDate_key" ON "HomeCardImpression"("userId", "shownDate");

-- AddForeignKey
ALTER TABLE "HomeCardImpression" ADD CONSTRAINT "HomeCardImpression_homeCardId_fkey" FOREIGN KEY ("homeCardId") REFERENCES "HomeCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeCardImpression" ADD CONSTRAINT "HomeCardImpression_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
