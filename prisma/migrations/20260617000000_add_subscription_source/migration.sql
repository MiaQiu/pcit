-- AlterEnum: add PAST_DUE value to SubscriptionStatus
ALTER TYPE "SubscriptionStatus" ADD VALUE 'PAST_DUE';

-- AlterTable: add subscriptionSource tracking column
ALTER TABLE "User" ADD COLUMN "subscriptionSource" TEXT;
