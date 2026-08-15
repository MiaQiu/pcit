-- CreateTable
CREATE TABLE "UserDemoVideoProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "demoVideoId" TEXT NOT NULL,
    "status" "ProgressStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "completedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserDemoVideoProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserDemoVideoProgress_demoVideoId_idx" ON "UserDemoVideoProgress"("demoVideoId");

-- CreateIndex
CREATE INDEX "UserDemoVideoProgress_userId_status_idx" ON "UserDemoVideoProgress"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserDemoVideoProgress_userId_demoVideoId_key" ON "UserDemoVideoProgress"("userId", "demoVideoId");

-- AddForeignKey
ALTER TABLE "UserDemoVideoProgress" ADD CONSTRAINT "UserDemoVideoProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDemoVideoProgress" ADD CONSTRAINT "UserDemoVideoProgress_demoVideoId_fkey" FOREIGN KEY ("demoVideoId") REFERENCES "DemoVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
