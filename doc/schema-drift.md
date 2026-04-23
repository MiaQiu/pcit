# Schema Drift — Columns Applied Without Migrations

These columns exist in the dev DB and in `prisma/schema.prisma` but have **no migration file**. They were applied with `prisma db push` instead of `prisma migrate dev`. As a result, **prod does not have them** and `prisma migrate deploy` will not apply them automatically on the next deploy.

To ship any of these to prod you must either:
1. Create a proper migration file (see below), or
2. Run the SQL directly on prod via the bastion tunnel.

---

## Pending columns

### `LessonSegment.customHtml`
```sql
ALTER TABLE "LessonSegment" ADD COLUMN IF NOT EXISTS "customHtml" TEXT;
```
Used by: custom HTML lesson cards (full-screen WebView segments).

---

### `User.developmentalVisible`
```sql
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "developmentalVisible" BOOLEAN NOT NULL DEFAULT false;
```
Used by: admin toggle that controls whether the developmental milestones section is visible to a given user.

---

### `Quiz.wrongExplanation`
```sql
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "wrongExplanation" TEXT;
```
Used by: separate feedback text shown when a user selects a wrong quiz answer (falls back to `explanation` if null).

---

### `Quiz.quizPosition`
```sql
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "quizPosition" INTEGER;
```
Used by: controls where the quiz appears in the lesson segment sequence. `NULL` = after all segments (default). `0` = before first segment. `N` = after segment N.

---

### `LessonModule` enum — new values
```sql
ALTER TYPE "LessonModule" ADD VALUE IF NOT EXISTS 'GETTING_STARTED';
ALTER TYPE "LessonModule" ADD VALUE IF NOT EXISTS 'DISCIPLINE';
ALTER TYPE "LessonModule" ADD VALUE IF NOT EXISTS 'EMOTIONAL_MASSAGE';
ALTER TYPE "LessonModule" ADD VALUE IF NOT EXISTS 'ADHD';
```
Used by: lesson content organised under these new module categories.

---

## How to fix properly (create migration files)

Run these **one at a time**, waiting at least one second between each, to avoid duplicate timestamps:

```bash
npx prisma migrate dev --name add_lesson_segment_custom_html
npx prisma migrate dev --name add_user_developmental_visible
npx prisma migrate dev --name add_quiz_wrong_explanation
npx prisma migrate dev --name add_quiz_position
```

Since the dev DB already has these columns, Prisma will detect no actual change to apply on dev — it will only write the migration file. Commit the new files and deploy; `prisma migrate deploy` on prod startup will apply them in order.

> **Note:** Prisma may detect the existing schema as already matching and refuse to create a migration. In that case, create the migration directory manually:
> ```bash
> mkdir prisma/migrations/$(date +%Y%m%d%H%M%S)_add_lesson_segment_custom_html
> # write the ALTER TABLE SQL into migration.sql inside that directory
> ```
> Then mark it applied on dev:
> ```bash
> npx prisma migrate resolve --applied <migration_name>
> ```

---

## Applying directly to prod (quick path)

If you need prod updated immediately without a full deploy, open the prod tunnel and run all four statements:

```bash
./scripts/start-prod-db-tunnel.sh
```

```sql
ALTER TABLE "LessonSegment" ADD COLUMN IF NOT EXISTS "customHtml" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "developmentalVisible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "wrongExplanation" TEXT;
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "quizPosition" INTEGER;
ALTER TYPE "LessonModule" ADD VALUE IF NOT EXISTS 'GETTING_STARTED';
ALTER TYPE "LessonModule" ADD VALUE IF NOT EXISTS 'DISCIPLINE';
ALTER TYPE "LessonModule" ADD VALUE IF NOT EXISTS 'EMOTIONAL_MASSAGE';
ALTER TYPE "LessonModule" ADD VALUE IF NOT EXISTS 'ADHD';
```

After doing this, still create the migration files so future deploys stay consistent.
