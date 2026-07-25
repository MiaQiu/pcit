-- Add a new Content V2 module enum value. Postgres requires ADD VALUE to be
-- committed before it can be referenced by any row, so this migration only
-- adds the value — the Module row + lesson reassignment happen afterward,
-- once this has been deployed and the Prisma client regenerated.
ALTER TYPE "LessonModule" ADD VALUE 'COMMONLY_ASKED_QUESTIONS';
