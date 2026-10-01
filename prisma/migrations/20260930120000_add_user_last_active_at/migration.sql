-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastActiveAt" TIMESTAMP(3);

-- Backfill from the latest recording session or lesson view so existing users aren't blank.
UPDATE "User" u
SET "lastActiveAt" = a."lastActiveAt"
FROM (
  SELECT "userId", MAX(ts) AS "lastActiveAt"
  FROM (
    SELECT "userId", "createdAt" AS ts FROM "Session"
    UNION ALL
    SELECT "userId", "lastViewedAt" AS ts FROM "UserLessonProgress"
  ) t
  GROUP BY "userId"
) a
WHERE u."id" = a."userId";
