ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isFreeAccount" BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing Play Store reviewer hardcoded bypass to the new flag
UPDATE "User" SET "isFreeAccount" = true WHERE email = 'test63@gmail.com';
