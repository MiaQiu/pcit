-- AlterEnum
ALTER TYPE "ContentType" ADD VALUE 'TEXT_INPUT';

-- AlterTable
ALTER TABLE "LessonSegment" ADD COLUMN     "aiCheckMode" TEXT,
ADD COLUMN     "idealAnswer" TEXT;

-- CreateTable
CREATE TABLE "TextInputResponse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "aiEvaluation" JSONB,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TextInputResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TextInputResponse_userId_segmentId_idx" ON "TextInputResponse"("userId", "segmentId");

-- AddForeignKey
ALTER TABLE "TextInputResponse" ADD CONSTRAINT "TextInputResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TextInputResponse" ADD CONSTRAINT "TextInputResponse_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "LessonSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
