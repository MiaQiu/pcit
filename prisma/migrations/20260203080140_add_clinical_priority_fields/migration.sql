-- CreateEnum
CREATE TYPE "ClinicalLevel" AS ENUM ('STABILIZE', 'DE_ESCALATE', 'DIRECT', 'SUPPORT', 'FLOURISH');

-- CreateEnum
CREATE TYPE "InterventionStrategy" AS ENUM ('AGGRESSIVE_DE_ESCALATION', 'DIFFERENTIAL_ATTENTION', 'POSITIVE_REINFORCEMENT', 'RELATIONSHIP_BUFFERING', 'SKILL_COACHING');

-- AlterTable
ALTER TABLE "Child" ADD COLUMN     "primaryIssue" "ClinicalLevel",
ADD COLUMN     "primaryStrategy" "InterventionStrategy",
ADD COLUMN     "secondaryIssue" "ClinicalLevel",
ADD COLUMN     "secondaryStrategy" "InterventionStrategy";
