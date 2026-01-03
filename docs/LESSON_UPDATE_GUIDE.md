# Lesson Update Guide

This guide covers how to update, manage, and maintain lessons in the Nora application.

## Table of Contents
- [Overview](#overview)
- [Database Schema](#database-schema)
- [Available Scripts](#available-scripts)
- [Common Operations](#common-operations)
- [Formatting Guidelines](#formatting-guidelines)
- [Troubleshooting](#troubleshooting)

---

## Overview

Lessons are organized into two phases:
- **Phase 1 (CONNECT)**: Days 1-15 + 1 Booster = 16 lessons
- **Phase 2 (DISCIPLINE)**: Days 1-26 = 26 lessons
- **Total**: 42 lessons

Each lesson contains:
- Metadata (title, description, objectives, etc.)
- Segments (cards with formatted content)
- Quiz (question with 4 options)

---

## Database Schema

### Lesson Model
```prisma
model Lesson {
  id                 String               @id  // ⚠️ NO default - must provide ID
  phase              LessonPhase          // CONNECT or DISCIPLINE
  phaseNumber        Int                  // 1 or 2
  dayNumber          Int                  // 1-26
  title              String
  subtitle           String?
  shortDescription   String
  objectives         String[]             // Array of learning objectives
  LessonSegment      LessonSegment[]      // Note: PascalCase field name
  estimatedMinutes   Int                  @default(2)
  isBooster          Boolean              @default(false)
  prerequisites      String[]             // IDs of required lessons
  teachesCategories  String[]             // e.g., ["PRAISE", "ECHO"]
  dragonImageUrl     String?
  backgroundColor    String               @default("#E4E4FF")
  ellipse77Color     String               @default("#9BD4DF")
  ellipse78Color     String               @default("#A6E0CB")
  createdAt          DateTime             @default(now())
  updatedAt          DateTime
  Quiz               Quiz?                // Note: PascalCase field name
  UserLessonProgress UserLessonProgress[]

  @@unique([phaseNumber, dayNumber])
}
```

**⚠️ Important**: The `id` field does NOT have `@default(cuid())`, so you must manually generate and provide IDs when creating lessons.

### LessonSegment Model
```prisma
model LessonSegment {
  id           String      @id  // ⚠️ NO default - must provide ID
  lessonId     String
  order        Int         // 1-N
  sectionTitle String?
  contentType  ContentType // TEXT, EXAMPLE, TIP, SCRIPT, CALLOUT
  bodyText     String      @db.Text
  imageUrl     String?
  iconType     String?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime
  Lesson       Lesson      @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@unique([lessonId, order])
}
```

### ContentType Enum
```prisma
enum ContentType {
  TEXT      // Regular paragraph content
  EXAMPLE   // Sample script/scenario
  TIP       // Practice tip
  SCRIPT    // Sample dialogue
  CALLOUT   // Important highlighted content
}
```

### Quiz Model
```prisma
model Quiz {
  id            String         @id  // ⚠️ NO default - must provide ID
  lessonId      String         @unique
  question      String
  correctAnswer String         // The correct option ID
  explanation   String
  createdAt     DateTime       @default(now())
  updatedAt     DateTime
  Lesson        Lesson         @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  QuizOption    QuizOption[]   // Note: PascalCase field name
  QuizResponse  QuizResponse[]
}

model QuizOption {
  id          String @id  // ⚠️ NO default - must provide ID
  quizId      String
  optionLabel String // A, B, C, D
  optionText  String
  order       Int    // 1, 2, 3, 4
  Quiz        Quiz   @relation(fields: [quizId], references: [id], onDelete: Cascade)

  @@unique([quizId, optionLabel])
}
```

---

## Available Scripts

### 1. Import All Lessons from Text File
**Script**: `/scripts/import-all-lessons.cjs`

Parses a text file and imports all lessons with formatted content.

```bash
node scripts/import-all-lessons.cjs
```

**What it does**:
- Creates backup of existing lessons
- Parses lesson content from text file
- Applies formatting (bold, line breaks, emojis, bullets)
- Replaces all lessons in database
- Generates sequential prerequisites
- Creates quizzes with 4 options

**Input file format**:
```
Phase 1: The Core Training (Connect)
Day 1: Lesson Title
Short description here
Card 1: Section Title
Body text content...
Card 2: Section Title
Body text content...
Day 1 Quiz
Q: Question text?
A. Option A text
B. Option B text
C. Option C text
D. Option D text
Correct Answer: B
Reason: Explanation text
```

**Note**: Handles both `A.` and `A)` quiz option formats.

### 2. Clear All Prerequisites
**Script**: `/scripts/clear-lesson-prerequisites.cjs`

Removes all prerequisites to unlock all lessons.

```bash
node scripts/clear-lesson-prerequisites.cjs
```

**What it does**:
- Sets `prerequisites: []` for all lessons
- Verifies update succeeded
- Reports number of lessons updated

**Use case**: Development, testing, or allowing free navigation

### 3. Replace Specific Lessons
**Scripts**:
- `/scripts/replace-day-1-and-2.cjs` - Replace Days 1-2
- `/scripts/replace-day-1-2-3.cjs` - Replace Days 1-3

Template for replacing individual lessons.

```bash
node scripts/replace-day-1-and-2.cjs
# or
node scripts/replace-day-1-2-3.cjs
```

**Pattern**:
1. Generate ID helper function (use crypto.randomBytes)
2. Find existing lesson by phase and dayNumber (use PascalCase field names)
3. Delete lesson (cascades to segments, quiz)
4. Create new lesson with ID, metadata, createdAt, updatedAt
5. Create segments using `createMany` with IDs
6. Create quiz with ID → create options with IDs → update with correct answer ID

**Important Notes**:
- Must generate IDs manually using `crypto.randomBytes` or similar
- Must use PascalCase field names in `include`: `LessonSegment`, `Quiz`, `QuizOption`
- Must provide `createdAt` and `updatedAt` for all records

### 4. Verify Lessons
**Script**: `/scripts/verify-lessons.cjs`

Check lesson structure and content.

```bash
node scripts/verify-lessons.cjs
```

**What it shows**:
- Lesson titles and descriptions
- Number of segments
- Quiz questions and options
- Correct answers

---

## Common Operations

### Update Lesson Content

**Option 1: Update from Text File**
1. Edit `/Downloads/bit-size learning (50 words ver).txt`
2. Run `node scripts/import-all-lessons.cjs`
3. Verify in app

**Option 2: Update Individual Lesson**
1. Create/modify script based on `replace-day-1-and-2.cjs`
2. Update lesson data
3. Run script
4. Verify in database

### Add New Lesson

```javascript
const crypto = require('crypto');

// Helper function to generate IDs
function generateId() {
  return crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, '').substring(0, 25);
}

// Create lesson
const newLesson = await prisma.lesson.create({
  data: {
    id: generateId(),
    phase: 'CONNECT',
    phaseNumber: 1,
    dayNumber: 17,
    title: "New Lesson Title",
    shortDescription: "Brief description",
    objectives: [],
    teachesCategories: [],
    prerequisites: [],
    estimatedMinutes: 5,
    isBooster: false,
    backgroundColor: '#E4E4FF',
    ellipse77Color: '#9BD4DF',
    ellipse78Color: '#A6E0CB',
    createdAt: new Date(),
    updatedAt: new Date()
  }
});

// Add segments
await prisma.lessonSegment.createMany({
  data: [
    {
      id: generateId(),
      lessonId: newLesson.id,
      order: 1,
      sectionTitle: 'Introduction',
      contentType: 'TEXT',
      bodyText: 'Formatted content here...',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]
});

// Add quiz (see replace scripts for full example)
```

### Update Prerequisites

**Set sequential chain**:
```javascript
// Day 2 requires Day 1, Day 3 requires Day 2, etc.
const lessons = await prisma.lesson.findMany({
  orderBy: [{ phaseNumber: 'asc' }, { dayNumber: 'asc' }]
});

for (let i = 1; i < lessons.length; i++) {
  const lesson = lessons[i];
  const prevLesson = lessons[i - 1];

  // Only link within same phase
  if (lesson.phase === prevLesson.phase) {
    await prisma.lesson.update({
      where: { id: lesson.id },
      data: { prerequisites: [prevLesson.id] }
    });
  }
}
```

**Clear all prerequisites**:
```javascript
await prisma.lesson.updateMany({
  data: { prerequisites: [] }
});
```

### Backup Lessons

**Manual backup**:
```javascript
const lessons = await prisma.lesson.findMany({
  include: {
    LessonSegment: { orderBy: { order: 'asc' } },
    Quiz: {
      include: {
        QuizOption: { orderBy: { order: 'asc' } }
      }
    }
  }
});

const fs = require('fs').promises;
await fs.writeFile(
  `backups/lessons-${Date.now()}.json`,
  JSON.stringify(lessons, null, 2)
);
```

**Note**: Use PascalCase field names: `LessonSegment`, `Quiz`, `QuizOption`

**Backups location**: `/scripts/backups/lessons-backup-[timestamp].json`

---

## Formatting Guidelines

### Text Formatting Rules

**Bold text** for key concepts:
- Special Play Time
- PEN, Praise, Echo, Narrate
- Clear Command, Time-Out
- Connect, Discipline
- Labeled Praise, Extinction Burst

**Line breaks** (`\n\n`) between:
- Different ideas or concepts
- Examples and explanations
- Before/after tips or scripts

**Bullet points** (`•`) for:
- Lists of items
- Multiple examples
- Step-by-step instructions

**Emojis**:
- `👶` for Child dialogue
- `👤` for Parent/You dialogue
- `💡` for tips (in TIP content type)

### Example Formatting

**Before**:
```
Tell your child exactly what they are doing well. This builds confidence. Example: "Great job sharing!" Tip: Be specific.
```

**After**:
```
**Tell your child exactly what they are doing well.**

This builds confidence and increases positive behavior.

**Example:**
• "Great job sharing the blocks"

💡 **Tip:** Praise the **specific action**, not just the personality.
```

### ContentType Guidelines

| ContentType | When to Use | Example Section Title |
|-------------|-------------|----------------------|
| TEXT | General information, concepts | "What is PEN?", "The Goal" |
| EXAMPLE | Sample scenarios, demonstrations | "Example Dialogue", "Sample Script" |
| TIP | Practice advice, recommendations | "The 3 Rules", "Practice Tips" |
| SCRIPT | Dialogue templates, sample conversations | "Sample Script", "Opening Script" |
| CALLOUT | Important warnings, key points | "Important", "Remember" |

---

## Troubleshooting

### Database Connection Issues

**Symptom**: `Can't reach database server at localhost:5432`

**Solution**: Start database tunnel
```bash
./scripts/start-db-tunnel.sh
# Wait 2-3 seconds, then run your script
```

### Quiz Options Not Appearing

**Symptom**: Quiz shows question but no options

**Cause**: Parser didn't match quiz option format

**Solution**: Check text file uses either `A.` or `A)` format consistently
```
A. Option text  ✓
A) Option text  ✓
A: Option text  ✗ (not supported)
```

### BOM Character Issues

**Symptom**: Phase not detected, lessons have `null` phase

**Cause**: Text file has Byte Order Mark (BOM) at start

**Solution**: Parser automatically strips BOM (`\uFEFF`)
```javascript
const cleanContent = fileContent.replace(/^\uFEFF/, '');
```

### Prerequisite Chain Broken

**Symptom**: Lessons not unlocking in correct order

**Cause**: Prerequisites reference deleted lesson IDs

**Solution**: Regenerate prerequisites or clear all
```bash
node scripts/clear-lesson-prerequisites.cjs
```

### Segment Order Conflicts

**Symptom**: Error `Unique constraint failed on lessonId, order`

**Cause**: Duplicate segment order values

**Solution**: Ensure sequential order (1, 2, 3, ...) with no gaps or duplicates

### Prisma Field Naming Errors

**Symptom**: `Unknown field 'segments' for include statement` or similar errors for `quiz`, `options`

**Cause**: Prisma uses PascalCase for relation field names, not camelCase

**Solution**: Use correct field names in queries:
```javascript
// ❌ WRONG - will cause errors
include: {
  segments: true,
  quiz: { include: { options: true } }
}

// ✅ CORRECT - use PascalCase
include: {
  LessonSegment: true,
  Quiz: { include: { QuizOption: true } }
}
```

### Missing ID Field Error

**Symptom**: `Argument 'id' is missing` when creating lessons, segments, quizzes, or options

**Cause**: The schema does NOT have `@default(cuid())` on ID fields

**Solution**: Manually generate IDs using crypto:
```javascript
const crypto = require('crypto');

function generateId() {
  return crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, '').substring(0, 25);
}

// Then use in create:
await prisma.lesson.create({
  data: {
    id: generateId(),
    // ... other fields
  }
});
```

---

## Database Maintenance

### Check Lesson Counts
```sql
SELECT phase, COUNT(*) as count
FROM "Lesson"
GROUP BY phase;

-- Expected: CONNECT=16, DISCIPLINE=26
```

### Find Orphaned Data
```sql
-- Segments without lessons
SELECT ls.id, ls."lessonId"
FROM "LessonSegment" ls
LEFT JOIN "Lesson" l ON ls."lessonId" = l.id
WHERE l.id IS NULL;

-- Quizzes without lessons
SELECT q.id, q."lessonId"
FROM "Quiz" q
LEFT JOIN "Lesson" l ON q."lessonId" = l.id
WHERE l.id IS NULL;
```

### Reset All Lessons
```sql
-- WARNING: Deletes all lessons and related data
DELETE FROM "Lesson";
-- Then re-run import script
```

---

## Best Practices

### Before Making Changes
1. ✅ Create backup: `node scripts/import-all-lessons.cjs` (creates automatic backup)
2. ✅ Test on development database first
3. ✅ Verify database tunnel is running
4. ✅ Check current lesson count before changes

### After Making Changes
1. ✅ Verify lesson count: Should be 42 total
2. ✅ Check sample lessons in app
3. ✅ Test quiz functionality
4. ✅ Verify prerequisites work as expected
5. ✅ Review formatting on mobile device

### When Writing Scripts
1. ✅ Use transactions for data safety
2. ✅ Include error handling and logging
3. ✅ Add verification queries at end
4. ✅ Follow existing script patterns
5. ✅ Test with small subset first

### Formatting Content
1. ✅ Use consistent emoji style (👶/👤 for dialogue)
2. ✅ Bold key concepts but don't overuse
3. ✅ Add line breaks between distinct ideas
4. ✅ Use bullets for 3+ list items
5. ✅ Keep paragraphs short (2-3 sentences max)

---

## Quick Reference

### Database Tunnel
```bash
# Start
./scripts/start-db-tunnel.sh

# Check status
ps aux | grep "ssh.*5432"

# Stop (kill background process)
pkill -f "ssh.*5432"
```

### Import Lessons
```bash
# Full import with backup
node scripts/import-all-lessons.cjs

# Clear prerequisites only
node scripts/clear-lesson-prerequisites.cjs

# Verify lessons
node scripts/verify-lessons.cjs
```

### Prisma Commands
```bash
# Open Prisma Studio (GUI)
npx prisma studio

# Generate Prisma Client (after schema changes)
npx prisma generate

# View schema
cat prisma/schema.prisma
```

---

## Related Files

- **Scripts**: `/scripts/`
  - `import-all-lessons.cjs` - Bulk import from text file
  - `clear-lesson-prerequisites.cjs` - Clear all prerequisites
  - `replace-day-1-and-2.cjs` - Replace Days 1-2
  - `replace-day-1-2-3.cjs` - Replace Days 1-3 (example with ID generation)
  - `verify-lessons.cjs` - Verification tool (⚠️ may need field name updates)

- **Source Data**: `/Downloads/bit-size learning (50 words ver).txt`

- **Backups**: `/scripts/backups/`

- **Schema**: `/prisma/schema.prisma`

- **API Routes**: `/server/routes/lessons.cjs`

---

## Support

For issues or questions:
1. Check this guide first
2. Review existing scripts in `/scripts/`
3. Check Prisma schema: `/prisma/schema.prisma`
4. Test queries in Prisma Studio: `npx prisma studio`

---

**Last Updated**: January 2026

## Changelog

### January 2026
- ⚠️ **BREAKING**: Documented that ID fields do NOT have `@default(cuid())` - must generate IDs manually
- ⚠️ **BREAKING**: Updated all examples to use PascalCase field names (`LessonSegment`, `Quiz`, `QuizOption`)
- Added `replace-day-1-2-3.cjs` script as reference implementation
- Added troubleshooting sections for Prisma field naming and ID generation
- Updated schema documentation to reflect actual database structure
- Added ID generation helper function examples
