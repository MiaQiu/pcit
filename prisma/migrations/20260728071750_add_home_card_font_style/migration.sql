-- CreateEnum
CREATE TYPE "HomeCardFontSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- AlterTable
ALTER TABLE "HomeCard" ADD COLUMN     "messageBold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "messageFontSize" "HomeCardFontSize" NOT NULL DEFAULT 'MEDIUM';
