-- CreateTable
CREATE TABLE "DemoVideo" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "videoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemoVideo_isActive_displayOrder_idx" ON "DemoVideo"("isActive", "displayOrder");
