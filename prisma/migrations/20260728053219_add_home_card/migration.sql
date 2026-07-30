-- CreateTable
CREATE TABLE "HomeCard" (
    "id" TEXT NOT NULL,
    "badgeText" TEXT NOT NULL,
    "badgeColor" TEXT NOT NULL DEFAULT '#8C49D5',
    "message" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeCard_isActive_displayOrder_idx" ON "HomeCard"("isActive", "displayOrder");
