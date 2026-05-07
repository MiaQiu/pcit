-- Make name and childName nullable to eliminate 'User'/'Child' sentinel strings
ALTER TABLE "User" ALTER COLUMN "name" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "childName" DROP NOT NULL;

-- Migrate existing placeholder values to NULL
UPDATE "User" SET "name" = NULL WHERE "name" = 'User';
UPDATE "User" SET "childName" = NULL WHERE "childName" = 'Child' OR "childName" = 'Not Set';
