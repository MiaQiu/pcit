-- CreateEnum
CREATE TYPE "EnrichmentStatus" AS ENUM ('PENDING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- AlterTable
ALTER TABLE "Session" ADD COLUMN "roleIdDone" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Session" ADD COLUMN "pcitCodingDone" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Session" ADD COLUMN "enrichmentStatus" "EnrichmentStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Session" ADD COLUMN "enrichmentError" TEXT;
