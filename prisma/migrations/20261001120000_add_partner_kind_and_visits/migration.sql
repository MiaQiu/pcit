-- Campaign signup links reuse the Partner pipeline (trial/discount/attribution/QR).
-- `kind` separates marketing campaigns from B2B partners in the admin portal;
-- `visits` counts successful link validations for visit -> signup conversion.

-- CreateEnum
CREATE TYPE "PartnerKind" AS ENUM ('PARTNER', 'CAMPAIGN');

-- AlterTable
ALTER TABLE "Partner" ADD COLUMN "kind" "PartnerKind" NOT NULL DEFAULT 'PARTNER',
ADD COLUMN "visits" INTEGER NOT NULL DEFAULT 0;
