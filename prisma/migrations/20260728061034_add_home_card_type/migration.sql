-- CreateEnum
CREATE TYPE "HomeCardType" AS ENUM ('CONTENT', 'QUOTE');

-- AlterTable
ALTER TABLE "HomeCard" ADD COLUMN     "cardType" "HomeCardType" NOT NULL DEFAULT 'CONTENT',
ADD COLUMN     "detailContent" TEXT,
ADD COLUMN     "detailTitle" TEXT;
