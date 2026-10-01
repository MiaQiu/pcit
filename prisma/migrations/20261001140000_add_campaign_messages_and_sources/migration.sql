-- Campaign links: one campaign (offer) with N message variants (/p/<slug>/<key>)
-- and a free-form channel tag (?src=facebook). Replaces one Partner row per
-- channel x message.

-- CreateTable
CREATE TABLE "CampaignMessage" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "landing" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignVisit" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "messageKey" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CampaignVisit_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "campaignMessageId" TEXT,
ADD COLUMN "signupSource" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CampaignMessage_partnerId_key_key" ON "CampaignMessage"("partnerId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignVisit_partnerId_messageKey_source_key" ON "CampaignVisit"("partnerId", "messageKey", "source");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_campaignMessageId_fkey" FOREIGN KEY ("campaignMessageId") REFERENCES "CampaignMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMessage" ADD CONSTRAINT "CampaignMessage_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignVisit" ADD CONSTRAINT "CampaignVisit_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
