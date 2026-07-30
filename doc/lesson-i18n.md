# i18n Architecture

This document covers both **content translations** (lesson and module text stored in the DB) and **UI translations** (buttons, labels, etc. in the app).

**Supported locales:** `en`, `zh-TW` (Traditional Chinese), `zh-CN` (Simplified Chinese).

> **zh-CN status:** UI strings, AI coach replies, session-analysis language handling, and weekly reports are fully wired up. Classic lesson content (`ModuleTranslation` / segment+quiz `LessonTranslation` fields) is **not yet seeded for zh-CN** — paused while lesson content is being reworked audio-first. Run step 3–4 of [Adding a new language](#adding-a-new-language) for `zh-CN` once that lands.

> **Audio-first (Content V2) lessons** now have per-locale schema + admin-editor + narration-backfill support (see [below](#audio-first-content-v2-lessons)) — but the `contentV2` script text itself is still translated **manually** per lesson (typed/pasted into the admin editor), there is no Claude batch-translate step for it the way `translateLessons.cjs` covers classic lessons.

---

## Architecture overview

| Layer | What is translated | How |
|---|---|---|
| Lesson content (classic, segment/quiz) | Lesson titles, segments, quizzes | DB translation tables; returned by API on `?lang=` |
| Module content | Module titles, descriptions | DB translation table (`ModuleTranslation`); returned by API on `?lang=` |
| App UI strings | Buttons, labels, error messages | `react-i18next` JSON files in `nora-mobile/src/i18n/locales/` |
| Lesson content (audio-first, Content V2) | `contentV2` script text, narration audio, `wordTimings` | `LessonTranslation` (same table, extra nullable fields); text is hand-translated in the admin editor, audio is TTS-generated per locale — see [below](#audio-first-content-v2-lessons) |

---

## Audio-first (Content V2) lessons

The podcast-style lesson format — `LearnScreen_v3`, `LessonViewerScreen_v2`, driven by `Lesson.contentV2`/`audioUrl`/`wordTimings` rather than `LessonSegment`/`Quiz` — is a separate content model from everything else in this document. Full architecture: `doc/learning/README.md`. It now has working per-locale translation plumbing for `zh-TW`/`zh-CN`, built directly on top of `LessonTranslation` rather than a separate table:

- **Schema**: `LessonTranslation` gained `contentV2`, `audioUrl`, `wordTimings`, `durationSeconds` — nullable and independent of the classic `title`/`subtitle`/`shortDescription`/`objectives` fields, so a row can have only Content V2 data, only classic fields, or both. A Content V2 translation is typically authored one lesson/one locale at a time via the admin editor, not the batch script.
- **Admin editor**: `admin/src/pages/LessonContentV2EditorPage.tsx` has a locale dropdown (English / `zh-TW` / `zh-CN`). Switching locale loads that row's `contentV2`/`audioUrl` via `GET /api/admin/lessons/:id?locale=`; saving text or uploading audio writes to `LessonTranslation` instead of `Lesson` once a non-`en` locale is selected (`PATCH /api/admin/lessons/:id/content-v2`, `POST /api/admin/lessons/:id/audio`, both accept `?locale=`/body `locale`).
- **Public API**: `applyLessonTx()` in `server/routes/lessons.cjs` merges the translation on `?lang=`. `contentV2` text falls back to the English source independently (still readable before narration exists for that locale), but `audioUrl`/`wordTimings`/`durationSeconds` do **not** fall back once `locale !== 'en'` — a user gets no audio rather than English narration they can't understand.
- **Narration generation**: `server/scripts/generateLessonNarration.cjs` is an ElevenLabs TTS backfill script — for any `LessonTranslation` row that already has `contentV2` text but no `audioUrl`, it generates narration audio + `wordTimings` using a locale-specific voice ID (`VOICE_IDS` in that script) and uploads it the same way the manual admin upload flow does. Safe to re-run (only fills rows with `audioUrl IS NULL`). Depends on `server/services/ttsService.cjs` and the tokenizer in `server/utils/lessonContentTokenizer.cjs` (a CJS port of the mobile `formatLessonContentV2`/word-tokenization logic, kept in sync to preserve `wordTimings` alignment with the renderer).

### What's still manual

**The `contentV2` script text itself is not machine-translated.** Unlike classic lessons (`translateLessons.cjs` calls Claude per lesson), there is no batch/AI translation step for Content V2 — someone writes or pastes the translated script directly into the admin editor per lesson, per locale. `generateLessonNarration.cjs` only picks up from there: it needs the translated text to already exist before it can generate audio for it. If a wholesale AI-translate step is wanted later, the natural approach is the same pattern as classic lessons — a Claude call per lesson bundle with the `customHtml`-style tag/placeholder preservation described in [Translation notes](#translation-notes) — but scoped to the single `contentV2` field and writing to these same `LessonTranslation` rows rather than a new table.

---

## DB schema — translation tables

Each row is keyed by `(entityId, locale)`. All tables have `autoTranslated`, `reviewed`, and `translatedAt` columns for content management.

| Table | Key | Translatable fields |
|---|---|---|
| `ModuleTranslation` | `(moduleId, locale)` | `title`, `description` |
| `LessonTranslation` | `(lessonId, locale)` | Classic: `title`, `subtitle`, `shortDescription`, `objectives`. Content V2: `contentV2`, `audioUrl`, `wordTimings`, `durationSeconds` — all independently nullable, see [Audio-first (Content V2) lessons](#audio-first-content-v2-lessons) |
| `LessonSegmentTranslation` | `(segmentId, locale)` | `sectionTitle`, `bodyText`, `idealAnswer`, `customHtml` |
| `QuizTranslation` | `(quizId, locale)` | `question`, `options` (JSON), `explanation`, `wrongExplanation` |

---

## Request flow

1. Client appends `?lang=<locale>` to all lesson/module API calls (e.g. `?lang=zh-TW`)
2. `server/middleware/locale.cjs` parses the param and sets `req.locale`
3. Route handlers fetch translation rows for that locale and merge over the English source fields — if no translation exists the English value is returned as fallback
4. The client uses the response as-is; no client-side key mapping is needed for content

---

## Key files

| File | Role |
|---|---|
| `server/middleware/locale.cjs` | Parses `?lang=` or `Accept-Language`, sets `req.locale` |
| `server/routes/modules.cjs` | Applies `ModuleTranslation` on `GET /api/modules` and `GET /api/modules/:key` |
| `server/routes/lessons.cjs` | Applies `LessonTranslation` / `LessonSegmentTranslation` / `QuizTranslation` on lesson endpoints |
| `server/services/translationService.cjs` | Calls Claude API to translate a lesson bundle |
| `server/scripts/translateLessons.cjs` | Batch migration script — translates all lessons |
| `packages/nora-core/src/services/lessonService.ts` | Appends `?lang=` to all lesson/module fetches |
| `nora-mobile/src/i18n/index.ts` | i18next init, device-locale detection, AsyncStorage persistence for UI language |
| `nora-mobile/src/i18n/locales/en.json` | English UI strings |
| `nora-mobile/src/i18n/locales/zh-TW.json` | Traditional Chinese UI strings |
| `nora-mobile/src/i18n/locales/zh-CN.json` | Simplified Chinese UI strings |
| `nora-mobile/src/screens/ProfileScreen.tsx` | Language picker (Settings → Language) |
| `nora-mobile/src/screens/LearnScreen_v3.tsx` | Also has its own language-switcher badge in the cover-band header (`handleLanguagePress`) — same picker options/persistence as `ProfileScreen.tsx`, duplicated rather than shared |
| `server/routes/auth.cjs` | `PATCH /api/auth/locale` — persists `User.preferredLocale`; has its own locale whitelist |
| `server/routes/coach.cjs` | AI coach chat — replies in the user's locale, has its own `LOCALE_NAMES` map |
| `server/utils/languageUtils.cjs` | Maps ElevenLabs transcription language codes to prompt instructions for session analysis |
| `server/services/pcitAnalysisService.cjs` | Honors `zh-TW`/`zh-CN` preference over the generic Mandarin ElevenLabs code (`zho`/`cmn`) |
| `server/services/weeklyReportService.cjs` | Weekly report narrative language + hardcoded metric/skill labels |
| `server/jobs/weeklyReportJob.cjs` | Weekly report push notification strings, keyed by locale |
| `admin/src/pages/LessonContentV2EditorPage.tsx` | Admin editor for Content V2 lessons — locale dropdown to author `contentV2`/audio per locale |
| `server/scripts/generateLessonNarration.cjs` | ElevenLabs TTS backfill — generates narration audio + `wordTimings` for translated `contentV2` text that has no audio yet |

---

## UI strings (react-i18next)

App UI strings (buttons, tab labels, error messages, etc.) are managed via `react-i18next`.

- **On first launch**, the app auto-detects the iPhone's system language via `expo-localization`:
  - Device locale is `zh-TW` or `zh-Hant*` → app starts in Traditional Chinese
  - Device locale is `zh-CN`, `zh-Hans*`, or `zh-SG` → app starts in Simplified Chinese
  - Any other locale → app starts in English
- The user can override in **Profile → Settings → Language** at any time, or via the language badge in the Learn tab's (`LearnScreen_v3`) header
- The choice is persisted in AsyncStorage; on subsequent launches the saved preference takes priority over device locale
- All screens and components use `const { t } = useTranslation()` and `t('key')`
- Keys are namespaced by screen/component: `home.*`, `report.*`, `profile.*`, `onboarding.*`, etc.

To add or update a UI string:
1. Add the English value to `en.json`
2. Add the translated value to `zh-TW.json` (use the same key, empty string `""` as placeholder if not yet translated)

---

## Onboarding i18n patterns

### Shared button components

`OnboardingButton`, `OnboardingButtonRow`, and `MultipleChoiceScreen` all default to `t('onboarding.continue')` when no explicit button text is passed. To use a custom label, pass `continueText={t('some.key')}` explicitly — the i18n call must happen at the screen/config level since these components accept a plain string.

The last WACB question (`WacbQuestion9`) demonstrates this: `wacbQuestions.config.ts` passes `continueText: t('onboarding.wacb.submitSurvey')`.

### Progress header

`OnboardingProgressHeader` reads `onboarding.progressHeader.title` and `onboarding.progressHeader.phase1` / `phase2` from the locale file. There are 2 phases total (phase 1 = basic data, phase 2 = developmental snapshot).

### Image overlays

Several onboarding screens replace baked-in English image text with a clean background image + absolutely positioned `<Text>` overlays:

```tsx
// imageContainer is sized to the exact pixel aspect ratio of the image
// so that percentage positions map directly to image coordinates
const IMAGE_W = SCREEN_WIDTH - 40;
const IMAGE_H = IMAGE_W * (imageHeight / imageWidth); // from `sips -g pixelWidth,pixelHeight`

<View style={{ width: IMAGE_W, height: IMAGE_H }}>
  <Image source={...} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
  <Text style={{ position: 'absolute', top: '53%', left: '35%' }}>
    {t('onboarding.screen.label')}
  </Text>
</View>
```

Key rules:
- Use `resizeMode="contain"` — `"stretch"` distorts the image
- Set `imageContainer` height to the exact pixel ratio (get dimensions via `sips -g pixelWidth pixelHeight <file>`) so there is no letterboxing and % positions are accurate
- Positions are relative to `imageContainer`, not the screen

### Dynamic child name interpolation

Screens that show the child's name use `useOnboarding().data.childName` with a fallback, then pass it to i18next interpolation:

```tsx
const childName = data.childName || 'K';
t('onboarding.screen.cardContent', { name: childName })
// en.json:  "cardContent": "{{name}}'s session today..."
// zh-TW.json: "cardContent": "{{name}} 今天的練習..."
```

---

## Adding a new language

The example below uses a hypothetical `es` (Spanish) locale to show the pattern. `zh-CN` was added following these same steps — see the note under each step for what that actually touched.

### 1. Add UI translations

Create a new locale JSON file:

```
nora-mobile/src/i18n/locales/<locale>.json   # e.g. es.json
```

> `zh-CN`: seeded by machine-converting the complete `zh-TW.json` (Traditional → Simplified characters + mainland lexicon, e.g. 軟體→软件) rather than translating from English from scratch, then spot-checked for key parity against `en.json`.

Register it in `nora-mobile/src/i18n/index.ts`:

```typescript
import es from './locales/es.json';

// In the i18next resources:
'es': { translation: es },
```

Update `detectDeviceLanguage()` in the same file to map the new locale:

```typescript
function detectDeviceLanguage(): string {
  const locales = getLocales();
  const primary = locales[0]?.languageTag ?? '';
  if (primary.startsWith('zh-TW') || primary.startsWith('zh-Hant')) return 'zh-TW';
  if (primary.startsWith('zh-CN') || primary.startsWith('zh-Hans') || primary.startsWith('zh-SG')) return 'zh-CN';
  if (primary.startsWith('es')) return 'es';  // add new mapping
  return 'en';
}
```

Add a `languagePicker.<locale>` label key to **every** locale JSON file (`en.json`, `zh-TW.json`, `zh-CN.json`, ...) — the picker needs a label for the new option in each language, not just the new language's own file.

Add the language option to the picker in `nora-mobile/src/screens/ProfileScreen.tsx` — both the iOS `ActionSheetIOS` branch and the Android `Alert` branch, plus the `currentLanguageLabel` lookup. **Repeat the same edit in `nora-mobile/src/screens/LearnScreen_v3.tsx`'s `handleLanguagePress`** — its header language badge duplicates this picker rather than sharing a component, so the two currently have to be kept in sync by hand.

### 2. Register the locale on the backend

In `server/middleware/locale.cjs`, add the new locale to `SUPPORTED_LOCALES` and add a fuzzy match if needed:

```javascript
const SUPPORTED_LOCALES = new Set(['en', 'zh-TW', 'zh-CN', 'es']); // add here

if (lang === 'es') return 'es';
```

In `server/routes/auth.cjs`, `PATCH /api/auth/locale` has its own whitelist — add it there too, or saving the preference silently 400s:

```javascript
const SUPPORTED = new Set(['en', 'zh-TW', 'zh-CN', 'es']); // add here
```

In `server/services/translationService.cjs`, add the locale name used in the Claude prompt (this also auto-extends `translateLessons.cjs`'s `TARGET_LOCALES`, which is derived from this map's keys):

```javascript
const LOCALE_NAMES = {
  'zh-TW': 'Traditional Chinese (Taiwan)',
  'zh-CN': 'Simplified Chinese (Mainland China)',
  'es': 'Spanish (Latin America)',   // add here
};
```

In `server/routes/coach.cjs`, add the locale to its own `LOCALE_NAMES` map so the AI coach replies in that language, plus skill-name translations in `buildSystemPrompt()` if the language needs them.

In `server/utils/languageUtils.cjs`, add the locale to `LANGUAGE_NAMES` (used for ElevenLabs session-analysis prompts) and, if relevant, a skill-name instruction branch in `getLanguageInstruction()`.

If the new locale is a Chinese variant, also extend the `CHINESE_LOCALES` set in `server/services/pcitAnalysisService.cjs` so a user's locale preference (not just the generic ElevenLabs `zho`/`cmn` code) is honored when picking the transcription language.

### 3. Translate module content

Seed the `ModuleTranslation` table manually (there are only a handful of modules):

```sql
INSERT INTO "ModuleTranslation" ("moduleId", "locale", "title", "description", "autoTranslated", "reviewed")
SELECT id, 'es', '<translated title>', '<translated description>', false, true
FROM "Module" WHERE key = 'GETTING_STARTED';
-- repeat for each module
```

Or via a Node script using Prisma:

```javascript
await prisma.moduleTranslation.createMany({
  data: [
    { moduleId: '<id>', locale: 'es', title: '...', description: '...', autoTranslated: false, reviewed: true },
    // ...
  ],
  skipDuplicates: true,
});
```

### 4. Translate lesson content

**Dev first:**

Make sure the dev DB tunnel is open (`./scripts/start-db-tunnel.sh`), then run:

```bash
node server/scripts/translateLessons.cjs es
```

The script translates all lessons sequentially, printing `OK` or `FAILED` per lesson. It is safe to re-run — lessons already marked `reviewed = true` are skipped; auto-translated ones are upserted.

**Spot-check the output:**

```bash
psql "$DATABASE_URL" -c \
  "SELECT \"lessonId\", title FROM \"LessonTranslation\" WHERE locale='es' LIMIT 5;"
```

**Translate against prod** (after deploying code):

```bash
# Open prod tunnel in one terminal
./scripts/start-prod-db-tunnel.sh

# Run script in another terminal with prod DATABASE_URL
DATABASE_URL="postgresql://nora_admin:<prod-pass>@localhost:5433/nora" \
  node server/scripts/translateLessons.cjs es
```

Prod password is in `.prod-infra-ids.txt` or retrieve via:

```bash
aws secretsmanager get-secret-value \
  --secret-id "arn:aws:secretsmanager:ap-southeast-1:059364397483:secret:nora/database-url-893xxi" \
  --region ap-southeast-1 \
  --query 'SecretString' --output text
```

### 5. Deploy

```bash
# Build nora-core first (client-side service changes)
cd packages/nora-core && npm run build && cd ../..

# Deploy backend to dev, test, then prod
./docker_deploy.sh
./docker_deploy_prod.sh
```

---

## Translation script options

```bash
# All locales defined in LOCALE_NAMES
node server/scripts/translateLessons.cjs

# Specific locale
node server/scripts/translateLessons.cjs zh-TW

# First N lessons only (for testing)
node server/scripts/translateLessons.cjs zh-TW --limit=1
```

---

## Marking translations as reviewed

Set `reviewed = true` to prevent the script from overwriting a human-edited translation:

```sql
-- Single lesson
UPDATE "LessonTranslation"
SET reviewed = true
WHERE locale = 'zh-TW' AND "lessonId" = 'EMOTIONS-0';

-- All lessons after a full review pass
UPDATE "LessonTranslation" SET reviewed = true WHERE locale = 'zh-TW';
UPDATE "LessonSegmentTranslation" SET reviewed = true WHERE locale = 'zh-TW';
UPDATE "QuizTranslation" SET reviewed = true WHERE locale = 'zh-TW';

-- Module translations (manually reviewed by default)
UPDATE "ModuleTranslation" SET reviewed = true WHERE locale = 'zh-TW';
```

---

## Translation notes

- `customHtml` is translated as a full HTML string — Claude preserves all tags and attributes
- Clinical terms are kept untranslated: **PCIT, CDI, PDI, PRIDE**
- `{{placeholders}}` are kept untranslated
- One Claude API call per lesson covers all segments and the quiz together
- Model used: `claude-opus-4-7` (no temperature — deprecated for this model)
- `bodyText` may be empty when a segment uses `customHtml` exclusively — this is correct
- Module translations are seeded manually (small fixed set); lesson translations are generated by the batch script

---

## Weekly report output language

Weekly reports are AI-generated narratives (not DB translation rows). Language is controlled via a `locale` parameter passed at generation time rather than a `?lang=` query string.

### How it works

`generateWeeklyReport(userId, weekStartDate, locale)` accepts an optional third argument (defaults to `'en'`). It maps the locale to a human-readable language name using `LOCALE_NAMES` in `weeklyReportService.cjs`, then injects `OUTPUT_LANGUAGE` into the `weeklyReportNarrative.txt` prompt. Claude writes all narrative text fields in that language; JSON field names stay in English.

```javascript
// server/services/weeklyReportService.cjs
const LOCALE_NAMES = {
  'en': 'English',
  'zh-TW': 'Traditional Chinese (Taiwan)',
  'zh-CN': 'Simplified Chinese (Mainland China)',
};
```

### Adding a new language

Add the locale → language-name entry to `LOCALE_NAMES` in `server/services/weeklyReportService.cjs`, plus `SKILL_NAME_LABELS` in the same file:

```javascript
const LOCALE_NAMES = {
  'en': 'English',
  'zh-TW': 'Traditional Chinese (Taiwan)',
  'zh-CN': 'Simplified Chinese (Mainland China)',
  'es': 'Spanish (Latin America)',  // add here
};
```

No prompt changes are needed — the language name is injected automatically.

### Generating a report in a specific language

```javascript
// Admin route or script
await generateWeeklyReport(userId, weekStartDate, 'zh-TW');
```

### Per-user locale

`User.preferredLocale` (added 2026-05-19, default `'en'`) is written by the mobile app on every auth check and whenever the user changes language in Profile → Language. `weeklyReportJob.cjs` reads it automatically — no explicit locale argument needed.

---

## Weekly report translation coverage

Only part of the weekly report is translated today. The table below tracks every text surface.

| Surface | Source | Translated? | Notes |
|---|---|---|---|
| `headline` | AI (Claude) | ✅ via `OUTPUT_LANGUAGE` | |
| `parentGrowthNarrative` | AI | ✅ | |
| `noraObservation` | AI | ✅ | |
| `childSpotlight` | AI | ✅ | |
| `growthSnapshots[].childQuote` | AI | ✅ | |
| `growthSnapshots[].meaning` | AI | ✅ | |
| `growthSnapshots[].category` | AI | ✅ | Prompt now instructs Claude to translate category names into `{{OUTPUT_LANGUAGE}}` |
| `childProgressNote` | AI | ✅ | |
| `focusHeading` | AI | ✅ | |
| `focusSubtext` | AI | ✅ | |
| `whyExplanation` | AI | ✅ | |
| `trendMessage` | AI | ✅ | |
| `childResponseSummary` | AI | ✅ | |
| `consistencyMessage` | AI | ✅ | |
| `growthMetrics[].label` | Hardcoded in service | ✅ | `GROWTH_METRIC_LABELS` map in `weeklyReportService.cjs` keyed by locale |
| `growthMetrics[].value` | Mechanical (numbers) | ✅ | Numeric — language-neutral |
| Weekly report UI labels | `react-i18next` | ✅ | `zh-TW.json` and `zh-CN.json` have full `weeklyReport.*` translations |
| Push notification title/body | Hardcoded in job | ✅ | `PUSH_STRINGS` map in `weeklyReportJob.cjs` keyed by locale; fetches `preferredLocale` per user before sending |

### Adding a new language

Add entries to `GROWTH_METRIC_LABELS` in `weeklyReportService.cjs` and `PUSH_STRINGS` in `weeklyReportJob.cjs` for the new locale. The AI narrative fields translate automatically via `OUTPUT_LANGUAGE`.
