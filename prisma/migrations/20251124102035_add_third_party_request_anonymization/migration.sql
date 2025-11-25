-- CreateTable
CREATE TABLE "ThirdPartyRequest" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "dataHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThirdPartyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ThirdPartyRequest_requestId_key" ON "ThirdPartyRequest"("requestId");

-- CreateIndex
CREATE INDEX "ThirdPartyRequest_requestId_idx" ON "ThirdPartyRequest"("requestId");

-- CreateIndex
CREATE INDEX "ThirdPartyRequest_userId_idx" ON "ThirdPartyRequest"("userId");

-- CreateIndex
CREATE INDEX "ThirdPartyRequest_createdAt_idx" ON "ThirdPartyRequest"("createdAt");

-- CreateIndex
CREATE INDEX "ThirdPartyRequest_expiresAt_idx" ON "ThirdPartyRequest"("expiresAt");

-- AddForeignKey
ALTER TABLE "ThirdPartyRequest" ADD CONSTRAINT "ThirdPartyRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
