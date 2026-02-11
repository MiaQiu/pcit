-- CreateEnum
CREATE TYPE "LessonModule" AS ENUM ('FOUNDATION', 'EMOTIONS', 'COOPERATION', 'SIBLINGS', 'RELOCATION', 'DIVORCE', 'DEVELOPMENT', 'PROCRASTINATION', 'PATIENCE', 'RESPONSIBILITY', 'MEALS', 'AGGRESSION', 'CONFLICT', 'FOCUS', 'DEFIANCE', 'SAFETY', 'SCREENS', 'SEPARATION', 'SPECIAL');

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "key" "LessonModule" NOT NULL,
    "title" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "backgroundColor" TEXT NOT NULL DEFAULT '#E4E4FF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Module_key_key" ON "Module"("key");
CREATE INDEX "Module_displayOrder_idx" ON "Module"("displayOrder");

-- Drop old constraints and indexes on Lesson
DROP INDEX IF EXISTS "Lesson_phaseNumber_idx";
DROP INDEX IF EXISTS "Lesson_phase_dayNumber_idx";
ALTER TABLE "Lesson" DROP CONSTRAINT IF EXISTS "Lesson_phaseNumber_dayNumber_key";

-- Delete all existing lessons (will be re-imported with new module-based content)
DELETE FROM "QuizOption";
DELETE FROM "Quiz";
DELETE FROM "UserLessonProgress";
DELETE FROM "LessonSegment";
DELETE FROM "Lesson";

-- Add new module column to Lesson (default to FOUNDATION for migration)
ALTER TABLE "Lesson" ADD COLUMN "module" "LessonModule" NOT NULL DEFAULT 'FOUNDATION';

-- Drop old columns from Lesson
ALTER TABLE "Lesson" DROP COLUMN IF EXISTS "phase";
ALTER TABLE "Lesson" DROP COLUMN IF EXISTS "phaseNumber";
ALTER TABLE "Lesson" DROP COLUMN IF EXISTS "isBooster";
ALTER TABLE "Lesson" DROP COLUMN IF EXISTS "prerequisites";

-- Add new unique constraint and index
CREATE UNIQUE INDEX "Lesson_module_dayNumber_key" ON "Lesson"("module", "dayNumber");
CREATE INDEX "Lesson_module_idx" ON "Lesson"("module");

-- Remove currentPhase from User
ALTER TABLE "User" DROP COLUMN IF EXISTS "currentPhase";

-- Remove LOCKED from ProgressStatus enum
-- First update any existing LOCKED rows to NOT_STARTED
UPDATE "UserLessonProgress" SET "status" = 'NOT_STARTED' WHERE "status" = 'LOCKED';

-- Recreate enum without LOCKED
ALTER TYPE "ProgressStatus" RENAME TO "ProgressStatus_old";
CREATE TYPE "ProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
ALTER TABLE "UserLessonProgress" ALTER COLUMN "status" TYPE "ProgressStatus" USING ("status"::text::"ProgressStatus");
DROP TYPE "ProgressStatus_old";

-- Drop old LessonPhase enum (no longer needed)
DROP TYPE IF EXISTS "LessonPhase";
