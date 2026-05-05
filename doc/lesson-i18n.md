# i18n Architecture

This document covers both **content translations** (lesson and module text stored in the DB) and **UI translations** (buttons, labels, etc. in the app).

---

## Architecture overview

| Layer | What is translated | How |
|---|---|---|
| Lesson content | Lesson titles, segments, quizzes | DB translation tables; returned by API on `?lang=` |
| Module content | Module titles, descriptions | DB translation table (`ModuleTranslation`); returned by API on `?lang=` |
| App UI strings | Buttons, labels, error messages | `react-i18next` JSON files in `nora-mobile/src/i18n/locales/` |

---

## DB schema — translation tables

Each row is keyed by `(entityId, locale)`. All tables have `autoTranslated`, `reviewed`, and `translatedAt` columns for content management.

| Table | Key | Translatable fields |
|---|---|---|
| `ModuleTranslation` | `(moduleId, locale)` | `title`, `description` |
| `LessonTranslation` | `(lessonId, locale)` | `title`, `subtitle`, `shortDescription`, `objectives` |
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
| `nora-mobile/src/i18n/index.ts` | i18next init + AsyncStorage persistence for UI language |
| `nora-mobile/src/i18n/locales/en.json` | English UI strings |
| `nora-mobile/src/i18n/locales/zh-TW.json` | Traditional Chinese UI strings (fill in values to translate) |

---

## UI strings (react-i18next)

App UI strings (buttons, tab labels, error messages, etc.) are managed via `react-i18next`.

- Language is selected by the user in **Profile → Settings → Language**
- The choice is persisted in AsyncStorage and restored on next launch
- All screens and components use `const { t } = useTranslation()` and `t('key')`
- Keys are namespaced by screen/component: `home.*`, `report.*`, `profile.*`, etc.

To add or update a UI string:
1. Add the English value to `en.json`
2. Add the translated value to `zh-TW.json` (use the same key, empty string `""` as placeholder if not yet translated)

---

## Adding a new language

### 1. Add UI translations

Create a new locale JSON file:

```
nora-mobile/src/i18n/locales/<locale>.json   # e.g. es.json
```

Register it in `nora-mobile/src/i18n/index.ts`:

```typescript
import es from './locales/es.json';

// In the i18next resources:
'es': { translation: es },
```

Add the language option to the picker in `nora-mobile/src/screens/ProfileScreen.tsx`.

### 2. Register the locale on the backend

In `server/middleware/locale.cjs`, add the new locale to `SUPPORTED_LOCALES` and add a fuzzy match if needed:

```javascript
const SUPPORTED_LOCALES = new Set(['en', 'zh-TW', 'es']); // add here

if (lang === 'es') return 'es';
```

In `server/services/translationService.cjs`, add the locale name used in the Claude prompt:

```javascript
const LOCALE_NAMES = {
  'zh-TW': 'Traditional Chinese (Taiwan)',
  'es': 'Spanish (Latin America)',   // add here
};
```

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
