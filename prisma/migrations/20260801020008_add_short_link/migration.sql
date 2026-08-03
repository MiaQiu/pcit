-- CreateTable
CREATE TABLE "ShortLink" (
    "code" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShortLink_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShortLink_targetUrl_key" ON "ShortLink"("targetUrl");
