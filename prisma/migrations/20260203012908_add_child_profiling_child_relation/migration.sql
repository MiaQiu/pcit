-- AlterTable
ALTER TABLE "ChildProfiling" ADD COLUMN     "childId" TEXT;

-- CreateIndex
CREATE INDEX "ChildProfiling_childId_idx" ON "ChildProfiling"("childId");

-- AddForeignKey
ALTER TABLE "ChildProfiling" ADD CONSTRAINT "ChildProfiling_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE SET NULL ON UPDATE CASCADE;
