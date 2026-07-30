-- CreateTable
CREATE TABLE "HomeCardLike" (
    "id" TEXT NOT NULL,
    "homeCardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeCardLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeCardLike_userId_idx" ON "HomeCardLike"("userId");

-- CreateIndex
CREATE INDEX "HomeCardLike_homeCardId_idx" ON "HomeCardLike"("homeCardId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeCardLike_homeCardId_userId_key" ON "HomeCardLike"("homeCardId", "userId");

-- AddForeignKey
ALTER TABLE "HomeCardLike" ADD CONSTRAINT "HomeCardLike_homeCardId_fkey" FOREIGN KEY ("homeCardId") REFERENCES "HomeCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeCardLike" ADD CONSTRAINT "HomeCardLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
