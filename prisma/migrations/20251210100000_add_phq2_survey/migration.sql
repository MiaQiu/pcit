-- CreateTable
CREATE TABLE "Phq2Survey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "q1Interest" INTEGER NOT NULL,
    "q2Depressed" INTEGER NOT NULL,
    "totalScore" INTEGER NOT NULL,

    CONSTRAINT "Phq2Survey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Phq2Survey_userId_idx" ON "Phq2Survey"("userId");

-- CreateIndex
CREATE INDEX "Phq2Survey_submittedAt_idx" ON "Phq2Survey"("submittedAt");
