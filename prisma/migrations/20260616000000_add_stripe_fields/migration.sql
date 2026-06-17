-- AlterTable
ALTER TABLE "User" ADD COLUMN "stripeCustomerId" TEXT UNIQUE;
ALTER TABLE "User" ADD COLUMN "stripeSubscriptionId" TEXT UNIQUE;
