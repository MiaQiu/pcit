-- Account-last web signup: anonymous per-visitor progress for partner/campaign links
-- with config.accountLast on (birth year, concern keys, WACB score, last screen).

-- CreateTable
CREATE TABLE "SignupDraft" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "campaignMessageId" TEXT,
    "signupSource" TEXT,
    "childBirthYear" INTEGER,
    "concerns" TEXT[],
    "wacbScore" INTEGER,
    "lastStep" TEXT,
    "convertedUserId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignupDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignupDraft_partnerId_createdAt_idx" ON "SignupDraft"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "SignupDraft_convertedUserId_idx" ON "SignupDraft"("convertedUserId");

-- AddForeignKey
ALTER TABLE "SignupDraft" ADD CONSTRAINT "SignupDraft_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignupDraft" ADD CONSTRAINT "SignupDraft_campaignMessageId_fkey" FOREIGN KEY ("campaignMessageId") REFERENCES "CampaignMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
