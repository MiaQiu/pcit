CREATE TYPE "AbcLogType" AS ENUM ('CHALLENGING', 'POSITIVE');

CREATE TABLE "AbcLog" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "childId"        TEXT NOT NULL,
    "logType"        "AbcLogType" NOT NULL DEFAULT 'CHALLENGING',
    "antecedents"    TEXT[],
    "behaviors"      TEXT[],
    "consequences"   TEXT[],
    "intensity"      INTEGER,
    "durationBucket" TEXT,
    "recordedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbcLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AbcLog_userId_idx" ON "AbcLog"("userId");
CREATE INDEX "AbcLog_userId_recordedAt_idx" ON "AbcLog"("userId", "recordedAt");
CREATE INDEX "AbcLog_childId_recordedAt_idx" ON "AbcLog"("childId", "recordedAt");

ALTER TABLE "AbcLog" ADD CONSTRAINT "AbcLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AbcLog" ADD CONSTRAINT "AbcLog_childId_fkey"
    FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
