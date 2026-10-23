-- CreateTable
CREATE TABLE "SpecialPlayOffer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "messageId" TEXT,
    "response" TEXT,
    "respondedVia" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecialPlayOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpecialPlayOffer_userId_createdAt_idx" ON "SpecialPlayOffer"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "SpecialPlayOffer" ADD CONSTRAINT "SpecialPlayOffer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
