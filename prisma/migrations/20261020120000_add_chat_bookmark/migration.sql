-- AlterTable
ALTER TABLE "CoachChatMessage" ADD COLUMN "scripted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ChatBookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT,
    "moduleKey" TEXT,
    "text" TEXT NOT NULL,
    "messageCreatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatBookmark_userId_createdAt_idx" ON "ChatBookmark"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatBookmark_userId_messageId_key" ON "ChatBookmark"("userId", "messageId");

-- AddForeignKey
ALTER TABLE "ChatBookmark" ADD CONSTRAINT "ChatBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatBookmark" ADD CONSTRAINT "ChatBookmark_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CoachChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
