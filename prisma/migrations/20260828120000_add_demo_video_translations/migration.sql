-- CreateTable
CREATE TABLE "DemoVideoTranslation" (
    "demoVideoId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "additionalText" TEXT,
    "videoUrl" TEXT,
    "autoTranslated" BOOLEAN NOT NULL DEFAULT true,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "translatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoVideoTranslation_pkey" PRIMARY KEY ("demoVideoId","locale")
);

-- CreateIndex
CREATE INDEX "DemoVideoTranslation_locale_idx" ON "DemoVideoTranslation"("locale");

-- AddForeignKey
ALTER TABLE "DemoVideoTranslation" ADD CONSTRAINT "DemoVideoTranslation_demoVideoId_fkey" FOREIGN KEY ("demoVideoId") REFERENCES "DemoVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
