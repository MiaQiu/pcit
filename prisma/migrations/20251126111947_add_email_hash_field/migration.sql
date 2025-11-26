-- Add emailHash field for encrypted email lookups
-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_emailHash_key" ON "User"("emailHash");

-- CreateIndex
CREATE INDEX "User_emailHash_idx" ON "User"("emailHash");

-- Drop old email index (email is now encrypted)
DROP INDEX IF EXISTS "User_email_idx";
