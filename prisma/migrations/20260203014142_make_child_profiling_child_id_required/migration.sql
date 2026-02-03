/*
  Warnings:

  - Made the column `childId` on table `ChildProfiling` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "ChildProfiling" DROP CONSTRAINT "ChildProfiling_childId_fkey";

-- AlterTable
ALTER TABLE "ChildProfiling" ALTER COLUMN "childId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "ChildProfiling" ADD CONSTRAINT "ChildProfiling_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
