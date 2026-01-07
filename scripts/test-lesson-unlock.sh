#!/bin/bash
# Helper script to update Day 4 completion for testing lesson unlock

set -e

echo "🔍 Testing Lesson Unlock - Update Day 4 Completion"
echo "=================================================="
echo ""

# Database connection from .env
DB_URL="postgresql://nora_admin:D7upDeIjZc1S1BG6Mca1QxKzVqxF4Bbw@localhost:5432/nora_dev"

echo "Step 1: Finding your user..."
echo ""
psql "$DB_URL" -c "SELECT id, email, name FROM \"User\" ORDER BY \"createdAt\" DESC LIMIT 5;"

echo ""
echo "Step 2: Finding Day 4 lesson..."
echo ""
DAY4_LESSON=$(psql "$DB_URL" -t -c "SELECT id FROM \"Lesson\" WHERE \"dayNumber\" = 4 AND phase = 'CONNECT' AND \"isBooster\" = false LIMIT 1;" | xargs)
echo "Day 4 Lesson ID: $DAY4_LESSON"

echo ""
echo "Step 3: Current completion status..."
echo ""
psql "$DB_URL" -c "
SELECT
  u.email,
  l.title,
  ulp.status,
  ulp.\"completedAt\" AT TIME ZONE 'Asia/Singapore' as \"completedAt_SGT\"
FROM \"UserLessonProgress\" ulp
JOIN \"User\" u ON u.id = ulp.\"userId\"
JOIN \"Lesson\" l ON l.id = ulp.\"lessonId\"
WHERE l.\"dayNumber\" = 4
AND l.phase = 'CONNECT'
AND l.\"isBooster\" = false
AND ulp.status = 'COMPLETED'
ORDER BY ulp.\"completedAt\" DESC;
"

echo ""
read -p "Enter your User ID (from Step 1): " USER_ID

if [ -z "$USER_ID" ]; then
  echo "❌ User ID is required"
  exit 1
fi

echo ""
echo "🔄 Updating Day 4 completion to yesterday..."
psql "$DB_URL" -c "
UPDATE \"UserLessonProgress\"
SET \"completedAt\" = (NOW() AT TIME ZONE 'Asia/Singapore' - INTERVAL '1 day') AT TIME ZONE 'Asia/Singapore'
WHERE \"userId\" = '$USER_ID'
AND \"lessonId\" = '$DAY4_LESSON'
AND status = 'COMPLETED';
"

echo ""
echo "✅ Updated! Verifying..."
echo ""
psql "$DB_URL" -c "
SELECT
  u.email,
  l.title,
  ulp.status,
  ulp.\"completedAt\" AT TIME ZONE 'Asia/Singapore' as \"completedAt_SGT\",
  NOW() AT TIME ZONE 'Asia/Singapore' as \"current_time_SGT\"
FROM \"UserLessonProgress\" ulp
JOIN \"User\" u ON u.id = ulp.\"userId\"
JOIN \"Lesson\" l ON l.id = ulp.\"lessonId\"
WHERE ulp.\"userId\" = '$USER_ID'
AND l.\"dayNumber\" = 4
AND l.phase = 'CONNECT'
AND l.\"isBooster\" = false;
"

echo ""
echo "🎉 Done! Now:"
echo "1. Pull to refresh on the Home screen (or kill and restart the app)"
echo "2. Day 5 should now be unlocked"
echo "3. Background the app and foreground it - should refresh automatically"
echo ""
