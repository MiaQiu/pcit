-- CreateTable
CREATE TABLE "ModuleTranslation" (
    "moduleId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "autoTranslated" BOOLEAN NOT NULL DEFAULT true,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "translatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleTranslation_pkey" PRIMARY KEY ("moduleId","locale")
);

-- CreateIndex
CREATE INDEX "ModuleTranslation_locale_idx" ON "ModuleTranslation"("locale");

-- AddForeignKey
ALTER TABLE "ModuleTranslation" ADD CONSTRAINT "ModuleTranslation_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;
