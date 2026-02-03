-- CreateTable
CREATE TABLE "milestone_library" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "grouping_stage" TEXT NOT NULL,
    "display_title" TEXT NOT NULL,
    "detection_mode" TEXT NOT NULL,
    "threshold_value" INTEGER NOT NULL,
    "median_age_months" INTEGER NOT NULL,
    "mastery_90_age_months" INTEGER NOT NULL,
    "source_reference" TEXT NOT NULL,
    "action_tip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestone_library_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "milestone_library_key_key" ON "milestone_library"("key");

-- CreateIndex
CREATE INDEX "milestone_library_category_idx" ON "milestone_library"("category");

-- CreateIndex
CREATE INDEX "milestone_library_median_age_months_idx" ON "milestone_library"("median_age_months");
