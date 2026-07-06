-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('ACTIVE', 'PAUSED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Partner" (
    "id"          TEXT NOT NULL,
    "slug"        TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "status"      "PartnerStatus" NOT NULL DEFAULT 'ACTIVE',
    "config"      JSONB NOT NULL,
    "expiresAt"   TIMESTAMP(3),
    "redemptions" INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_slug_key" ON "Partner"("slug");

-- AlterTable
ALTER TABLE "User" ADD COLUMN "partnerId" TEXT;

-- CreateIndex
CREATE INDEX "User_partnerId_idx" ON "User"("partnerId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "Partner"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
