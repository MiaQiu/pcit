-- Script to update Day 4 completion to yesterday for testing
-- This allows Day 5 to unlock when testing the AppState listener

-- Step 1: Find your user (current logged in test user)
SELECT id, email, name
FROM "User"
ORDER BY "createdAt" DESC
LIMIT 5;

-- Step 2: Find Day 4 lesson
SELECT id, title, "dayNumber", phase
FROM "Lesson"
WHERE "dayNumber" = 4
AND phase = 'CONNECT'
AND "isBooster" = false;

-- Step 3: Check current completion status
-- Replace <your-user-id> with the actual user ID from Step 1
-- Replace <day-4-lesson-id> with the actual lesson ID from Step 2
SELECT
  ulp.id,
  u.email,
  l.title,
  ulp.status,
  ulp."completedAt",
  ulp."completedAt" AT TIME ZONE 'Asia/Singapore' as "completedAt_SGT"
FROM "UserLessonProgress" ulp
JOIN "User" u ON u.id = ulp."userId"
JOIN "Lesson" l ON l.id = ulp."lessonId"
WHERE l."dayNumber" = 4
AND l.phase = 'CONNECT'
AND l."isBooster" = false
ORDER BY ulp."completedAt" DESC;

-- Step 4: Update Day 4 completion to yesterday (1 day ago in Singapore time)
-- IMPORTANT: Replace <your-user-id> and <day-4-lesson-id> with actual values from above
/*
UPDATE "UserLessonProgress"
SET "completedAt" = (NOW() AT TIME ZONE 'Asia/Singapore' - INTERVAL '1 day') AT TIME ZONE 'Asia/Singapore'
WHERE "userId" = '<your-user-id>'
AND "lessonId" = '<day-4-lesson-id>'
AND status = 'COMPLETED';
*/

-- Step 5: Verify the update
-- Run Step 3 query again to confirm the date changed
