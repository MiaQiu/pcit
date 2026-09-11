-- CreateTable
CREATE TABLE "HomeCardTranslation" (
    "homeCardId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "message" TEXT,
    "attribution" TEXT,
    "detailTitle" TEXT,
    "autoTranslated" BOOLEAN NOT NULL DEFAULT true,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "translatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeCardTranslation_pkey" PRIMARY KEY ("homeCardId","locale")
);

-- CreateTable
CREATE TABLE "HomeCardComponentTranslation" (
    "componentId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "text" TEXT,
    "ctaLabel" TEXT,
    "inputLabel" TEXT,
    "inputPlaceholder" TEXT,
    "autoTranslated" BOOLEAN NOT NULL DEFAULT true,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "translatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeCardComponentTranslation_pkey" PRIMARY KEY ("componentId","locale")
);

-- CreateIndex
CREATE INDEX "HomeCardTranslation_locale_idx" ON "HomeCardTranslation"("locale");

-- CreateIndex
CREATE INDEX "HomeCardComponentTranslation_locale_idx" ON "HomeCardComponentTranslation"("locale");

-- AddForeignKey
ALTER TABLE "HomeCardTranslation" ADD CONSTRAINT "HomeCardTranslation_homeCardId_fkey" FOREIGN KEY ("homeCardId") REFERENCES "HomeCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeCardComponentTranslation" ADD CONSTRAINT "HomeCardComponentTranslation_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "HomeCardComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
