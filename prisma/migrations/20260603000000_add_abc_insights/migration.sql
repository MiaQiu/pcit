-- CreateTable: AbcInsight — stores AI-generated ABC log insights per user
CREATE TABLE "AbcInsight" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "insight"   JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AbcInsight_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AbcInsight" ADD CONSTRAINT "AbcInsight_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "AbcInsight_userId_createdAt_idx" ON "AbcInsight"("userId", "createdAt");
