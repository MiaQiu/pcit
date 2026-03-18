-- Add detectionCount to ChildMilestone
-- Tracks how many sessions the LLM has re-detected this milestone (used for EMERGING -> ACHIEVED promotion)
-- Existing rows default to 1 (the initial detection)
ALTER TABLE "ChildMilestone" ADD COLUMN "detectionCount" INTEGER NOT NULL DEFAULT 1;
