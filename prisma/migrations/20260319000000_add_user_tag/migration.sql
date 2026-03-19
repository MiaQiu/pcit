-- Add tag field to User for admin classification (user vs tester)
ALTER TABLE "User" ADD COLUMN "tag" TEXT NOT NULL DEFAULT 'user';
