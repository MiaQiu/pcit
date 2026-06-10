CREATE TABLE "FreeAccountWhitelist" (
  "id"        TEXT      NOT NULL,
  "emailHash" TEXT      NOT NULL,
  "email"     TEXT      NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FreeAccountWhitelist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FreeAccountWhitelist_emailHash_key" ON "FreeAccountWhitelist"("emailHash");
CREATE INDEX "FreeAccountWhitelist_emailHash_idx" ON "FreeAccountWhitelist"("emailHash");
