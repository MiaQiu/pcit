-- CreateTable
CREATE TABLE "LessonTranslation" (
    "lessonId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "shortDescription" TEXT NOT NULL,
    "objectives" TEXT[],
    "autoTranslated" BOOLEAN NOT NULL DEFAULT true,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "translatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonTranslation_pkey" PRIMARY KEY ("lessonId","locale")
);

-- CreateTable
CREATE TABLE "LessonSegmentTranslation" (
    "segmentId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "sectionTitle" TEXT,
    "bodyText" TEXT NOT NULL,
    "idealAnswer" TEXT,
    "customHtml" TEXT,
    "autoTranslated" BOOLEAN NOT NULL DEFAULT true,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "translatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonSegmentTranslation_pkey" PRIMARY KEY ("segmentId","locale")
);

-- CreateTable
CREATE TABLE "QuizTranslation" (
    "quizId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "explanation" TEXT NOT NULL,
    "wrongExplanation" TEXT,
    "autoTranslated" BOOLEAN NOT NULL DEFAULT true,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "translatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizTranslation_pkey" PRIMARY KEY ("quizId","locale")
);

-- CreateIndex
CREATE INDEX "LessonTranslation_locale_idx" ON "LessonTranslation"("locale");

-- CreateIndex
CREATE INDEX "LessonSegmentTranslation_locale_idx" ON "LessonSegmentTranslation"("locale");

-- CreateIndex
CREATE INDEX "QuizTranslation_locale_idx" ON "QuizTranslation"("locale");

-- AddForeignKey
ALTER TABLE "LessonTranslation" ADD CONSTRAINT "LessonTranslation_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonSegmentTranslation" ADD CONSTRAINT "LessonSegmentTranslation_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "LessonSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizTranslation" ADD CONSTRAINT "QuizTranslation_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
