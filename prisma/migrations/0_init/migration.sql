-- CreateEnum
CREATE TYPE "ChildGender" AS ENUM ('BOY', 'GIRL', 'OTHER');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('TEXT', 'EXAMPLE', 'TIP', 'SCRIPT', 'CALLOUT');

-- CreateEnum
CREATE TYPE "LessonPhase" AS ENUM ('CONNECT', 'DISCIPLINE');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'LOCKED');

-- CreateEnum
CREATE TYPE "RelationshipToChild" AS ENUM ('MOTHER', 'FATHER', 'GUARDIAN', 'OTHER', 'GRANDMOTHER', 'GRANDFATHER');

-- CreateEnum
CREATE TYPE "SessionMode" AS ENUM ('CDI', 'PDI');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('TRIAL', 'PREMIUM', 'FREE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('NONE', 'TRIAL', 'INACTIVE', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupportPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SupportRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "LearningProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentDeck" INTEGER NOT NULL DEFAULT 1,
    "unlockedDecks" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "phase" "LessonPhase" NOT NULL,
    "phaseNumber" INTEGER NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "shortDescription" TEXT NOT NULL,
    "objectives" TEXT[],
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 2,
    "isBooster" BOOLEAN NOT NULL DEFAULT false,
    "prerequisites" TEXT[],
    "teachesCategories" TEXT[],
    "dragonImageUrl" TEXT,
    "backgroundColor" TEXT NOT NULL DEFAULT '#E4E4FF',
    "ellipse77Color" TEXT NOT NULL DEFAULT '#9BD4DF',
    "ellipse78Color" TEXT NOT NULL DEFAULT '#A6E0CB',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonSegment" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "sectionTitle" TEXT,
    "contentType" "ContentType" NOT NULL,
    "bodyText" TEXT NOT NULL,
    "imageUrl" TEXT,
    "iconType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Phq2Survey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "q1Interest" INTEGER NOT NULL,
    "q2Depressed" INTEGER NOT NULL,
    "totalScore" INTEGER NOT NULL,

    CONSTRAINT "Phq2Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizOption" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "optionLabel" TEXT NOT NULL,
    "optionText" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "QuizOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizResponse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "selectedAnswer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triggerSource" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "triggerExcerpt" TEXT,
    "actionTaken" TEXT NOT NULL,

    CONSTRAINT "RiskAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" "SessionMode" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "transcript" TEXT NOT NULL,
    "aiFeedbackJSON" JSONB NOT NULL,
    "pcitCoding" JSONB NOT NULL,
    "tagCounts" JSONB NOT NULL,
    "masteryAchieved" BOOLEAN NOT NULL DEFAULT false,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "flaggedForReview" BOOLEAN NOT NULL DEFAULT false,
    "coachAlertSent" BOOLEAN NOT NULL DEFAULT false,
    "coachAlertSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "childMetrics" JSONB,
    "competencyAnalysis" JSONB,
    "overallScore" INTEGER,
    "elevenLabsJson" JSONB,
    "roleIdentificationJson" JSONB,
    "transcriptionService" TEXT,
    "transcribedAt" TIMESTAMP(3),
    "analysisStatus" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "analysisError" TEXT,
    "analysisFailedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetriedAt" TIMESTAMP(3),
    "permanentFailure" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Utterance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "startTime" DOUBLE PRECISION NOT NULL,
    "endTime" DOUBLE PRECISION NOT NULL,
    "role" TEXT,
    "pcitTag" TEXT,
    "noraTag" TEXT,
    "feedback" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Utterance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "attachments" JSONB,
    "status" "SupportRequestStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportPriority" NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolverNotes" TEXT,

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThirdPartyRequest" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "dataHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThirdPartyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "therapistId" TEXT,
    "childName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "lastSessionDate" TIMESTAMP(3),
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "childBirthYear" INTEGER NOT NULL,
    "childConditions" TEXT NOT NULL,
    "emailHash" TEXT,
    "childBirthday" TIMESTAMP(3),
    "issue" TEXT,
    "profileImageUrl" TEXT,
    "subscriptionEndDate" TIMESTAMP(3),
    "subscriptionPlan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "subscriptionStartDate" TIMESTAMP(3),
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
    "trialEndDate" TIMESTAMP(3),
    "trialStartDate" TIMESTAMP(3),
    "relationshipToChild" "RelationshipToChild" NOT NULL DEFAULT 'MOTHER',
    "childGender" "ChildGender",
    "pushToken" TEXT,
    "pushTokenUpdatedAt" TIMESTAMP(3),
    "currentPhase" "LessonPhase" NOT NULL DEFAULT 'CONNECT',
    "revenueCatCustomerId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLessonProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "status" "ProgressStatus" NOT NULL,
    "currentSegment" INTEGER NOT NULL DEFAULT 1,
    "totalSegments" INTEGER NOT NULL DEFAULT 4,
    "completedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserLessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WacbSurvey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parentingStressLevel" INTEGER NOT NULL,
    "q1Dawdle" INTEGER NOT NULL,
    "q2MealBehavior" INTEGER NOT NULL,
    "q3Disobey" INTEGER NOT NULL,
    "q4Angry" INTEGER NOT NULL,
    "q5Scream" INTEGER NOT NULL,
    "q6Destroy" INTEGER NOT NULL,
    "q7ProvokeFights" INTEGER NOT NULL,
    "q8Interrupt" INTEGER NOT NULL,
    "q9Attention" INTEGER NOT NULL,
    "totalScore" INTEGER NOT NULL,

    CONSTRAINT "WacbSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revenueCatEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expiresDate" TIMESTAMP(3),
    "revenueCatData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LearningProgress_userId_key" ON "LearningProgress"("userId");

-- CreateIndex
CREATE INDEX "LearningProgress_userId_idx" ON "LearningProgress"("userId");

-- CreateIndex
CREATE INDEX "Lesson_phaseNumber_idx" ON "Lesson"("phaseNumber");

-- CreateIndex
CREATE INDEX "Lesson_phase_dayNumber_idx" ON "Lesson"("phase", "dayNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_phaseNumber_dayNumber_key" ON "Lesson"("phaseNumber", "dayNumber");

-- CreateIndex
CREATE INDEX "LessonSegment_lessonId_idx" ON "LessonSegment"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonSegment_lessonId_order_key" ON "LessonSegment"("lessonId", "order");

-- CreateIndex
CREATE INDEX "ModuleHistory_userId_category_idx" ON "ModuleHistory"("userId", "category");

-- CreateIndex
CREATE INDEX "ModuleHistory_userId_idx" ON "ModuleHistory"("userId");

-- CreateIndex
CREATE INDEX "ModuleHistory_viewedAt_idx" ON "ModuleHistory"("viewedAt");

-- CreateIndex
CREATE INDEX "Phq2Survey_submittedAt_idx" ON "Phq2Survey"("submittedAt");

-- CreateIndex
CREATE INDEX "Phq2Survey_userId_idx" ON "Phq2Survey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_lessonId_key" ON "Quiz"("lessonId");

-- CreateIndex
CREATE INDEX "Quiz_lessonId_idx" ON "Quiz"("lessonId");

-- CreateIndex
CREATE INDEX "QuizOption_quizId_idx" ON "QuizOption"("quizId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizOption_quizId_optionLabel_key" ON "QuizOption"("quizId", "optionLabel");

-- CreateIndex
CREATE INDEX "QuizResponse_quizId_idx" ON "QuizResponse"("quizId");

-- CreateIndex
CREATE INDEX "QuizResponse_userId_quizId_idx" ON "QuizResponse"("userId", "quizId");

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_term_key" ON "Keyword"("term");

-- CreateIndex
CREATE INDEX "Keyword_term_idx" ON "Keyword"("term");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_userId_key" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_tokenHash_idx" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "RiskAuditLog_riskLevel_idx" ON "RiskAuditLog"("riskLevel");

-- CreateIndex
CREATE INDEX "RiskAuditLog_timestamp_idx" ON "RiskAuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "RiskAuditLog_userId_idx" ON "RiskAuditLog"("userId");

-- CreateIndex
CREATE INDEX "Session_createdAt_idx" ON "Session"("createdAt");

-- CreateIndex
CREATE INDEX "Session_flaggedForReview_idx" ON "Session"("flaggedForReview");

-- CreateIndex
CREATE INDEX "Session_mode_idx" ON "Session"("mode");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_analysisStatus_idx" ON "Session"("analysisStatus");

-- CreateIndex
CREATE INDEX "Utterance_sessionId_order_idx" ON "Utterance"("sessionId", "order");

-- CreateIndex
CREATE INDEX "Utterance_sessionId_idx" ON "Utterance"("sessionId");

-- CreateIndex
CREATE INDEX "SupportRequest_createdAt_idx" ON "SupportRequest"("createdAt");

-- CreateIndex
CREATE INDEX "SupportRequest_status_idx" ON "SupportRequest"("status");

-- CreateIndex
CREATE INDEX "SupportRequest_userId_idx" ON "SupportRequest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ThirdPartyRequest_requestId_key" ON "ThirdPartyRequest"("requestId");

-- CreateIndex
CREATE INDEX "ThirdPartyRequest_createdAt_idx" ON "ThirdPartyRequest"("createdAt");

-- CreateIndex
CREATE INDEX "ThirdPartyRequest_expiresAt_idx" ON "ThirdPartyRequest"("expiresAt");

-- CreateIndex
CREATE INDEX "ThirdPartyRequest_requestId_idx" ON "ThirdPartyRequest"("requestId");

-- CreateIndex
CREATE INDEX "ThirdPartyRequest_userId_idx" ON "ThirdPartyRequest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailHash_key" ON "User"("emailHash");

-- CreateIndex
CREATE UNIQUE INDEX "User_revenueCatCustomerId_key" ON "User"("revenueCatCustomerId");

-- CreateIndex
CREATE INDEX "User_emailHash_idx" ON "User"("emailHash");

-- CreateIndex
CREATE INDEX "User_therapistId_idx" ON "User"("therapistId");

-- CreateIndex
CREATE INDEX "User_pushToken_idx" ON "User"("pushToken");

-- CreateIndex
CREATE INDEX "UserLessonProgress_lessonId_idx" ON "UserLessonProgress"("lessonId");

-- CreateIndex
CREATE INDEX "UserLessonProgress_userId_status_idx" ON "UserLessonProgress"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserLessonProgress_userId_lessonId_key" ON "UserLessonProgress"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "WacbSurvey_submittedAt_idx" ON "WacbSurvey"("submittedAt");

-- CreateIndex
CREATE INDEX "WacbSurvey_userId_idx" ON "WacbSurvey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionEvent_revenueCatEventId_key" ON "SubscriptionEvent"("revenueCatEventId");

-- CreateIndex
CREATE INDEX "SubscriptionEvent_userId_idx" ON "SubscriptionEvent"("userId");

-- CreateIndex
CREATE INDEX "SubscriptionEvent_eventType_idx" ON "SubscriptionEvent"("eventType");

-- CreateIndex
CREATE INDEX "SubscriptionEvent_revenueCatEventId_idx" ON "SubscriptionEvent"("revenueCatEventId");

-- AddForeignKey
ALTER TABLE "LearningProgress" ADD CONSTRAINT "LearningProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonSegment" ADD CONSTRAINT "LessonSegment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleHistory" ADD CONSTRAINT "ModuleHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Phq2Survey" ADD CONSTRAINT "Phq2Survey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizOption" ADD CONSTRAINT "QuizOption_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizResponse" ADD CONSTRAINT "QuizResponse_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizResponse" ADD CONSTRAINT "QuizResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAuditLog" ADD CONSTRAINT "RiskAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Utterance" ADD CONSTRAINT "Utterance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThirdPartyRequest" ADD CONSTRAINT "ThirdPartyRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLessonProgress" ADD CONSTRAINT "UserLessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLessonProgress" ADD CONSTRAINT "UserLessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WacbSurvey" ADD CONSTRAINT "WacbSurvey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

