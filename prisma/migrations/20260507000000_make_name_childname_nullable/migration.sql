-- Make name and childName nullable so new accounts start with NULL instead of 'User'/'Child'
ALTER TABLE "User" ALTER COLUMN "name" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "childName" DROP NOT NULL;
