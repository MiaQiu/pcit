-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('EMERGING', 'ACHIEVED');

-- CreateTable
CREATE TABLE "Child" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthday" TIMESTAMP(3),
    "gender" "ChildGender",
    "conditions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildMilestone" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "status" "MilestoneStatus" NOT NULL,
    "firstObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "achievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Child_userId_idx" ON "Child"("userId");

-- CreateIndex
CREATE INDEX "ChildMilestone_childId_idx" ON "ChildMilestone"("childId");

-- CreateIndex
CREATE INDEX "ChildMilestone_milestoneId_idx" ON "ChildMilestone"("milestoneId");

-- CreateIndex
CREATE INDEX "ChildMilestone_childId_status_idx" ON "ChildMilestone"("childId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ChildMilestone_childId_milestoneId_key" ON "ChildMilestone"("childId", "milestoneId");

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildMilestone" ADD CONSTRAINT "ChildMilestone_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildMilestone" ADD CONSTRAINT "ChildMilestone_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "milestone_library"("id") ON DELETE CASCADE ON UPDATE CASCADE;
