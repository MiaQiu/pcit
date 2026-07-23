-- Content V2 (audio-first) per-locale fields on LessonTranslation
ALTER TABLE "LessonTranslation" ADD COLUMN "contentV2" TEXT;
ALTER TABLE "LessonTranslation" ADD COLUMN "audioUrl" TEXT;
ALTER TABLE "LessonTranslation" ADD COLUMN "wordTimings" JSONB;
ALTER TABLE "LessonTranslation" ADD COLUMN "durationSeconds" INTEGER;

-- Relax title/shortDescription to nullable: a Content V2 translation row is
-- typically authored one field-group at a time via the admin editor, so it's
-- normal for a row to have only contentV2/audioUrl set and no title yet.
ALTER TABLE "LessonTranslation" ALTER COLUMN "title" DROP NOT NULL;
ALTER TABLE "LessonTranslation" ALTER COLUMN "shortDescription" DROP NOT NULL;
