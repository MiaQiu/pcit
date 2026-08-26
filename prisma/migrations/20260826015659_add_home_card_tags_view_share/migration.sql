-- AlterTable
ALTER TABLE "HomeCard" ADD COLUMN     "maxAgeMonths" INTEGER,
ADD COLUMN     "minAgeMonths" INTEGER,
ADD COLUMN     "targetGender" "ChildGender",
ADD COLUMN     "targetTags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "HomeCardView" (
    "id" TEXT NOT NULL,
    "homeCardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 1,
    "firstViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeCardView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeCardShare" (
    "id" TEXT NOT NULL,
    "homeCardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeCardShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeCardView_userId_idx" ON "HomeCardView"("userId");

-- CreateIndex
CREATE INDEX "HomeCardView_homeCardId_idx" ON "HomeCardView"("homeCardId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeCardView_homeCardId_userId_key" ON "HomeCardView"("homeCardId", "userId");

-- CreateIndex
CREATE INDEX "HomeCardShare_userId_idx" ON "HomeCardShare"("userId");

-- CreateIndex
CREATE INDEX "HomeCardShare_homeCardId_idx" ON "HomeCardShare"("homeCardId");

-- AddForeignKey
ALTER TABLE "HomeCardView" ADD CONSTRAINT "HomeCardView_homeCardId_fkey" FOREIGN KEY ("homeCardId") REFERENCES "HomeCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeCardView" ADD CONSTRAINT "HomeCardView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeCardShare" ADD CONSTRAINT "HomeCardShare_homeCardId_fkey" FOREIGN KEY ("homeCardId") REFERENCES "HomeCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeCardShare" ADD CONSTRAINT "HomeCardShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
