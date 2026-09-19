# Prod Content Sync Plan (learn_v3 + Demo Videos + Nora Daily)

Three content trees exist only in dev and need the same dev→prod treatment:
Phase 1 (Content V2 lessons) is done; Phase 2 (Demo Videos) and Phase 3
(Nora Daily / HomeCard) are planned below, not yet executed.

## Phase 1: Content V2 (learn_v3) lessons

Status: **executed 2026-09-18**.

## Execution log (2026-09-18)

1. Backed up prod's `Module`/`ModuleTranslation`/`Lesson`/`LessonTranslation`/
   `LessonSegment`/`LessonSegmentTranslation`/`Quiz`/`QuizOption` tables via
   `pg_dump --data-only --column-inserts` before any writes.
2. Wrote `scripts/sync-content-v2-to-prod.cjs` — extends the old sync script
   with the missing `Lesson` columns and adds `ModuleTranslation` /
   `LessonTranslation` upserts, hardcoded to the 5 `CONTENT_V2_MODULES` keys.
   One fix needed post-write: `wordTimings` is a `Json` column — node-pg
   needs it `JSON.stringify`'d before binding, passing the parsed object
   directly failed with `invalid input syntax for type json`.
3. Copied S3 objects (`audio.mp3`, `audio-zh-CN.mp3`, `audio-zh-TW.mp3`,
   `content-images/`, `content-videos/`) for all 23 lesson IDs from
   `nora-audio-059364397483-sg` (dev) to `nora-audio-059364397483-prod`
   (prod) via `aws s3 cp --recursive` per lesson prefix.
4. Ran `scripts/sync-content-v2-to-prod.cjs` — committed: 5 modules, 10
   module translations, 23 lessons, 46 lesson translations (0
   segments/quizzes, as expected for Content V2 lessons).
5. Verified: prod now has all 10 modules; the original 5
   (`GETTING_STARTED`/`EMOTIONAL_MASSAGE`/`EMOTIONS`/`DISCIPLINE`/`ADHD`)
   have unchanged lesson counts; the 5 new modules' lesson counts match dev
   exactly; `WELCOME-1` has `contentV2` populated; zh-CN/zh-TW translation
   counts are 23/23 as expected; copied S3 objects confirmed present in the
   prod bucket via `aws s3 ls`.

**Not verified end-to-end**: didn't hit an authenticated prod API endpoint
to confirm `resolveLessonAudioUrl` actually presigns a working playback URL
in the running App Runner service (would need a real prod user session/token,
not available in this session) — the unauthenticated `/health` and
`/api/lessons/:id/share-image.png` probes both 404'd, which is inconclusive
(could be a stale deployed image per `[[project_prod_db_and_migration_gap]]`,
or just the wrong route) rather than a real signal either way. Recommend a
manual check in the mobile app (or admin panel) pointed at prod before
calling this fully done.

## Background

`LearnScreen_v3.tsx` (the current Learn tab) only renders modules listed in
`nora-mobile/src/constants/contentV2Modules.ts` — the "Content V2" modules,
authored via the admin Content V2 editor as `contentV2` text + `audioUrl`
(no `LessonSegment`/`Quiz` rows, unlike the classic lesson editor):

- `WELCOME`
- `POSITIVE_PLAY`
- `CALM_DISCIPLINE`
- `BIG_FEELINGS_TANTRUMS`
- `COMMONLY_ASKED_QUESTIONS`

These exist only in the dev DB (`nora_dev`, tunnel on `localhost:5432`).
Prod (`nora`, tunnel on `localhost:5433`) still has only the original 5
modules (`GETTING_STARTED`, `EMOTIONAL_MASSAGE`, `EMOTIONS`, `DISCIPLINE`,
`ADHD`). This plan populates the 5 Content V2 modules into prod **without
touching the existing 5**.

## Findings (as of 2026-09-18)

Prod schema is **not** drifted — `_prisma_migrations` on prod is current
(latest applied: `20260831120000_add_child_snapshot_survey`) and
`Lesson` table columns match dev exactly. (Supersedes the older
"prod is ~24 migrations behind" note — that gap has since been closed.)

Content gap, scoped to the 5 Content V2 modules:

| | Dev | Prod | Missing |
|---|---|---|---|
| Modules | 5 | 0 | 5 |
| Lessons | 23 | 0 | 23 (all with `contentV2` + `audioUrl` populated) |
| `ModuleTranslation` rows | 10 | 0 | 10 |
| `LessonTranslation` rows (zh-CN / zh-TW) | 46 | 0 | 46 |
| `Quiz` / `LessonSegment` for these lessons | 0 / 0 | 0 / 0 | n/a — Content V2 lessons don't use these tables |

## Two things beyond a straight DB copy

1. **The existing sync script is stale.** `scripts/sync-lessons-to-prod.cjs`
   already does dev→prod lesson sync, but its `INSERT`/`UPDATE` column lists
   predate the Content V2 fields — it omits `contentV2`, `audioUrl`,
   `wordTimings`, `durationSeconds`, `shareTitle`, `shareSubtitle`,
   `shareCountBase` on `Lesson`, and never touches `ModuleTranslation`,
   `LessonTranslation`, or `LessonSegmentTranslation` at all. Running it
   as-is would insert the new lessons with those fields null/dropped and
   skip translations entirely. It needs to be extended (see Step 2 below),
   not run unmodified.

2. **Audio (and lesson image) files live in the dev S3 bucket and must be
   copied to prod's bucket.** `Lesson.audioUrl` / `LessonTranslation.audioUrl`
   store full S3 URLs pointing at the dev bucket
   (`nora-audio-059364397483-sg`), e.g.
   `https://nora-audio-059364397483-sg.s3.ap-southeast-1.amazonaws.com/lessons/WELCOME-1/audio.mp3`.
   The server never serves that raw URL — `resolveLessonAudioUrl` /
   `resolveDragonImageUrl` in `server/services/storage-s3.cjs` (~line 438-444)
   strip the URL down to its S3 key and re-presign it against **whichever
   bucket the running server is configured for** (comment: "Always re-sign
   with current bucket regardless of source bucket (handles dev→prod
   syncs)"). So once the DB rows are synced, the prod app will request
   `lessons/WELCOME-1/audio.mp3` from the **prod** bucket
   (`nora-audio-059364397483-prod`) — and that object doesn't exist there
   yet. Same failure class as the demo-videos S3 IAM gap documented
   previously. The audio files (and any `dragonImageUrl` images) must be
   copied S3→S3 for all 23 lesson IDs before/alongside the DB sync. No IAM
   change is needed — the prod App Runner role already grants
   `lessons/*` access.

## Scope guarantee — old 5 modules are untouched

Every part of this plan is scoped to the 5 Content V2 module keys:

- All dev-side `SELECT`s filter `WHERE module = ANY([...5 keys...])` (or
  join through `Module.key` for `ModuleTranslation`) — rows for
  `GETTING_STARTED` / `EMOTIONAL_MASSAGE` / `EMOTIONS` / `DISCIPLINE` /
  `ADHD` are never read from dev, so they can't be written to prod.
- Upserts are `ON CONFLICT (key) DO UPDATE` (`Module`) / `ON CONFLICT (id)
  DO UPDATE` (`Lesson`), scoped to that same result set — no `DELETE`-then-
  reinsert of prod's full table, so nothing about the existing 5 modules'
  rows is updated or removed.
- S3 copy is per-lesson-ID, limited to the 23 new lesson IDs' `lessons/<id>/`
  prefixes — existing prod audio/image objects are untouched.

## Steps

1. **Back up prod DB** via `scripts/backup-database.cjs` pointed at prod,
   before making any prod writes.
2. **Extend the sync script** — copy `scripts/sync-lessons-to-prod.cjs` to
   `scripts/sync-content-v2-to-prod.cjs` and add:
   - The missing `Lesson` columns (`contentV2`, `audioUrl`, `wordTimings`,
     `durationSeconds`, `shareTitle`, `shareSubtitle`, `shareCountBase`) to
     the upsert.
   - A `ModuleTranslation` upsert, keyed on `(moduleId, locale)`.
   - A `LessonTranslation` upsert, keyed on `(lessonId, locale)`, including
     its own `contentV2` / `audioUrl` / `wordTimings`.
   - Hardcode the 5 Content V2 module keys as the query filter (not "sync
     everything") so the script physically cannot touch the other 5
     modules.
3. **Copy S3 objects.** For each of the 23 lesson IDs:
   ```
   aws s3 cp --recursive \
     s3://nora-audio-059364397483-sg/lessons/<id>/ \
     s3://nora-audio-059364397483-prod/lessons/<id>/
   ```
   Covers `audio.mp3` plus any locale variants (`audio-zh-CN.mp3`,
   `audio-zh-TW.mp3`) and lesson images if `dragonImageUrl` is set.
4. **Run the sync** (dev→prod, transactional — `BEGIN`/`COMMIT` like the
   existing script), printing before/after row counts for each table.
5. **Verify**: hit prod's lesson/module API (or the prod App Runner URL)
   for one lesson per module, confirm `contentV2` renders and the
   presigned `audioUrl` returns 200, and spot-check a zh-CN translation.

## Open question for execution time (Phase 1)

None blocking — plan is ready to implement pending go-ahead to run writes
against prod (DB + S3).

---

## Phase 2: Demo Videos

Status: **executed 2026-09-18**. Written 2026-09-18, triggered by
user report "i don't see the demo videos" on prod.

### Execution log (2026-09-18)

1. Backed up prod's `DemoVideo`/`DemoVideoTranslation` (and Phase 3's
   tables in the same pass) via `pg_dump --data-only --column-inserts`.
2. Applied the IAM fix (see Phase 2+3 combined IAM log below).
3. Wrote `scripts/sync-demo-videos-to-prod.cjs` — upserts `DemoVideo` by id
   and `DemoVideoTranslation` by `(demoVideoId, locale)`, no filtering
   needed (single flat table).
4. Copied S3 objects: dev's `demo-videos/` prefix actually has **9**
   subfolders, not 7 — 2 are orphaned (no matching `DemoVideo` row in dev
   either; presumably a deleted-video's leftover files). Copied all 9
   folders anyway (harmless — the sync script only inserts what's in the
   DB, so the 2 extra folders just sit unreferenced in prod too, matching
   dev's own state).
5. Ran the sync — committed 7 `DemoVideo` + 7 `DemoVideoTranslation` rows.
6. Verified: row counts match dev exactly (7/7), `UserDemoVideoProgress`
   in prod still at 0 (untouched, as intended), S3 object count in prod's
   `demo-videos/` prefix is 25 (matches what was copied).

### Findings

Two independent, stacked causes — both need fixing:

1. **`DemoVideo` table is empty in prod.** Table exists in both (no schema
   drift), but dev has 7 rows and prod has 0. The videos were simply never
   synced — same shape of gap as Phase 1, different table.
2. **Prod's S3 IAM role is still missing the `demo-videos/*` prefix.**
   Checked `nora-prod-apprunner-role`'s inline policy
   `NoraProdAudioBucketAccess` directly (`aws iam get-role-policy`) — it
   only grants `s3:GetObject`/`PutObject`/`HeadObject` on `audio/*`,
   `lessons/*`, `branding/*`, `profiles/*`, `support/*`. No `demo-videos/*`,
   and also no `home-cards/*` (relevant to Phase 3 below). This is the gap
   `[[project_prod_db_and_migration_gap]]` noted on 2026-08-27 — that fix
   was applied to the **dev** role (`NoraAppRunnerTaskRole`) only, never to
   `nora-prod-apprunner-role`. Fixing #1 alone would still 403 on video
   playback once the rows exist.

Content shape (all bare S3 keys, e.g. `demo-videos/<id>/<uuid>.mov`, not
full URLs — simpler than Lesson's full-URL convention):

| | Dev | Prod | Missing |
|---|---|---|---|
| `DemoVideo` rows | 7 | 0 | 7 |
| `DemoVideoTranslation` rows | 7 | 0 | 7 |

`DemoVideo.videoUrl` / `.thumbnailUrl` and `DemoVideoTranslation.videoUrl`
are bare keys under `demo-videos/<id>/...` (translation variants under
`demo-videos/<id>/<locale>/...`), resolved the same way as lesson audio via
`resolveDragonImageUrl` in `server/services/storage-s3.cjs`.

**Not synced (user data, must stay prod-native):** `UserDemoVideoProgress`
— per-user progress rows, dev's are meaningless in prod and syncing them
would either collide with or fabricate prod user state.

### Steps

1. **Back up** prod's `DemoVideo` / `DemoVideoTranslation` tables
   (`pg_dump --data-only --column-inserts`), same pattern as Phase 1.
2. **Add IAM prefixes.** Add two statements (or extend existing ones) to
   `NoraProdAudioBucketAccess` on `nora-prod-apprunner-role`:
   - `s3:GetObject`/`PutObject` on `arn:aws:s3:::nora-audio-059364397483-prod/demo-videos/*`
   - Add `demo-videos/*` to the `BucketList` statement's `s3:prefix` condition list.
   (Bundling `home-cards/*` into the same change makes sense since Phase 3
   needs the identical fix — see below.)
3. **Extend the sync script** — add a `syncDemoVideos()` path (new script
   `scripts/sync-demo-videos-to-prod.cjs`, or fold into
   `sync-content-v2-to-prod.cjs` as a second scoped block) that upserts
   `DemoVideo` by id and `DemoVideoTranslation` by `(demoVideoId, locale)`.
   No module-key filter needed here since it's a single flat table, not
   filtered by module — sync all 7 dev rows.
4. **Copy S3 objects**: for each of the 7 `DemoVideo` ids,
   `aws s3 cp --recursive s3://nora-audio-059364397483-sg/demo-videos/<id>/ s3://nora-audio-059364397483-prod/demo-videos/<id>/`.
5. **Run the sync**, then **verify**: row counts match, spot check one
   video's presigned URL returns 200 from prod (needs an authenticated
   session or the admin portal — same verification gap noted in Phase 1).

---

## Phase 3: Nora Daily (HomeCard)

Status: **executed 2026-09-18**. Written 2026-09-18, found while
investigating Phase 2 (same IAM policy check surfaced the `home-cards/*`
gap too).

### Execution log (2026-09-18)

1. Backup covered in Phase 2's step 1 (same `pg_dump` pass included
   `HomeCardBadge`/`HomeCard`/`HomeCardTranslation`/`HomeCardComponent`/
   `HomeCardComponentTranslation`).
2. IAM fix — see combined log below.
3. Wrote `scripts/sync-home-cards-to-prod.cjs`. **Ran into an id-mismatch
   the plan hadn't anticipated**: migration
   `20260730154210_add_home_card_badges_and_components` seeds the 5
   default `HomeCardBadge` rows with `gen_random_uuid()` — independently
   per environment — so dev's id for e.g. "Science Bite" is *not* prod's
   id for the same badge, even though both seeded from the same migration.
   First run failed fast (transaction rolled back cleanly) with a
   name-collision error. Fixed by matching badges on the unique `name`
   column and building a `devBadgeId -> prodBadgeId` map, only inserting
   dev's own id for a genuinely new badge prod doesn't have (dev has one
   extra: "Quote", added later via the admin UI, not part of the migration
   seed). `HomeCard.badgeId` is written through that map, not dev's raw id.
4. Copied S3 objects: 12 `home-cards/<id>/` folders from dev's bucket
   (covers both `HomeCard.image` and `HomeCardComponent.image`, since both
   use the same `home-cards/<homeCardId>/<uuid>.<ext>` key convention).
5. Ran the sync — committed 6 badges (5 matched by name + 1 new), 54
   cards, 106 card translations, 46 components, 74 component translations.
6. Verified: all 7 row counts (badges through component translations)
   match dev exactly; zero `HomeCard` rows with a dangling `badgeId` FK;
   `HomeCardLike`/`HomeCardImpression` still at 0 in prod (untouched); S3
   object count in prod's `home-cards/` prefix is 14 (matches what was
   copied — 12 folders, some with multiple files).

### Findings

"Nora Daily" (`t('homeV2.noraDaily')` in `HomeScreen_v2.tsx`, ~line 1584;
server-side comment in `server/routes/config.cjs` line 96: `Picks (and
durably records) this user's single "Nora Daily" card`) is the `HomeCard`
feature — mobile only ever renders `homeCards[0]` from
`recordingService.getHomeCards()`. Entirely empty in prod:

| | Dev | Prod | Missing |
|---|---|---|---|
| `HomeCardBadge` rows | 6 | 0 | 6 |
| `HomeCard` rows | 54 | 0 | 54 |
| `HomeCardTranslation` rows | 106 | 0 | 106 |
| `HomeCardComponent` rows | 46 | 0 | 46 |
| `HomeCardComponentTranslation` rows | 74 | 0 | 74 |

Same IAM gap as Phase 2: `nora-prod-apprunner-role`'s
`NoraProdAudioBucketAccess` policy has no `home-cards/*` prefix, so
`HomeCard.image` / `HomeCardComponent.image` (bare keys like
`home-cards/<homeCardId>/<uuid>.png`) would 403 even after the DB sync —
fix in the same IAM change as Phase 2, step 2.

**Not synced (user data, must stay prod-native):** `HomeCardLike`,
`HomeCardImpression`, `HomeCardUserInputResponse` — all per-user
interaction/state rows tied to prod's real users, not content. Syncing
these would fabricate fake likes/impressions/answers on prod, or collide
with real ones. Only the content tables listed above get synced.

`HomeCard.badgeId` is a foreign key to `HomeCardBadge` (`onDelete`
unspecified, unique on `HomeCardBadge.name`) — `HomeCardBadge` must be
synced **before** `HomeCard` in the same transaction, upserted by `id`
(not `name`) so the FK values on synced `HomeCard` rows stay valid; check
at execution time that prod has no pre-existing badges with the same
`name` under a different `id` (would violate the unique constraint).

### Steps

1. **Back up** prod's `HomeCardBadge` / `HomeCard` / `HomeCardTranslation`
   / `HomeCardComponent` / `HomeCardComponentTranslation` tables before
   writing (all currently empty in prod, so this is a formality, but keep
   the same discipline as Phases 1-2).
2. **IAM fix** — same change as Phase 2 step 2, adding `home-cards/*` to
   `NoraProdAudioBucketAccess` alongside `demo-videos/*` in one edit.
3. **Extend the sync script** — add a `syncHomeCards()` path: upsert
   `HomeCardBadge` by id, then `HomeCard` by id (all 54, no filter — this
   is the whole table), then `HomeCardTranslation` by `(homeCardId,
   locale)`, then `HomeCardComponent` by id, then
   `HomeCardComponentTranslation` by `(componentId, locale)`. Explicitly
   exclude `HomeCardLike`/`HomeCardImpression`/`HomeCardUserInputResponse`
   from the script entirely (not just "don't call it" — don't give the
   script the ability to touch those tables at all).
4. **Copy S3 objects**: for each `HomeCard.image` / `HomeCardComponent.image`
   that's set, `aws s3 cp --recursive` its `home-cards/<homeCardId>/`
   prefix from dev to prod bucket (some of the 54 cards may have no image —
   only copy prefixes that exist).
5. **Run the sync**, then **verify**: row counts match; open the app (or
   admin) against prod and confirm a Nora Daily card renders with its badge
   color/text and any image.

---

## Combined IAM log (Phase 2 + 3)

Applied 2026-09-18 via `aws iam put-role-policy` on `nora-prod-apprunner-role`,
policy `NoraProdAudioBucketAccess`. Added two new statements —
`DemoVideoAccess` (`s3:GetObject`/`PutObject` on `.../demo-videos/*`) and
`HomeCardImageAccess` (same actions on `.../home-cards/*`) — and extended
the existing `BucketList` statement's `s3:prefix` condition to include both
new prefixes alongside the existing `audio/*`, `lessons/*`, `branding/*`,
`profiles/*`, `support/*`. Verified via `aws iam get-role-policy` that all
7 statement Sids are present post-update. Purely additive — no existing
statement was narrowed or removed.

## Status summary

All three phases executed and verified at the DB/S3 layer as of
2026-09-18. **Still open across all phases**: no authenticated
end-to-end check against the running prod App Runner service (audio
playback, video playback, image rendering via presigned URLs) — every
verification so far is DB row counts + `aws s3 ls` confirming objects
exist, not a live request through the app. Recommend a manual pass in the
mobile app (or admin portal) pointed at prod: Learn tab (5 new modules),
a demo video open + play, and the Nora Daily card on the home screen.
