# Learning V2 (Content V2 / Podcast-Style Lesson Player)

A second lesson experience that runs alongside the original segmented lesson flow (`LessonViewerScreen` — multi-segment cards, quizzes, keyword glossary). Learning V2 lessons are simpler: one audio narration track plus a single block of formatted text, presented as a podcast-style player with a live-highlighting script and a sibling-lesson playlist.

The two systems are intentionally decoupled — a lesson uses **either** the classic `segments`/`quiz` model **or** the V2 `contentV2`/`audioUrl` model, selected by which modules it belongs to (see [Module routing](#module-routing) below). Nothing about the original admin lesson editor or `LessonViewerScreen` was changed to build this.

`LearnScreen_v3.tsx` is the current live "Learn" tab (`nora-mobile/src/screens/index.ts` exports it as `LearnScreen`) — a single-course-style browsing UI purpose-built for the V2 modules, with an inline mini-player so lessons can be listened to without leaving the list. `LearnScreen_v2.tsx` (the previous tab, per-module horizontal-scroll cards) remains in the repo unreferenced rather than deleted.

---

## Why this exists

The four new curriculum modules (`WELCOME`, `POSITIVE_PLAY`, `CALM_DISCIPLINE`, `BIG_FEELINGS_TANTRUMS`) come from a linear, narrated parenting course (audio-first, script-driven) rather than the interactive multi-segment lessons the rest of the app uses. Rather than force that content into the segment/quiz model, it gets its own lightweight content type and its own player screen.

---

## Data model

Added directly to the existing `Lesson` table (`prisma/schema.prisma`) — no new tables:

| Field | Type | Purpose |
|---|---|---|
| `contentV2` | `String?` | Lightweight-markdown lesson text: `**bold**`, `* ` bullets, blank-line paragraph breaks. Same authoring convention as segment `bodyText`. |
| `audioUrl` | `String?` | S3 key/URL for the narration audio file. Bucket is **private** — always read through `resolveLessonAudioUrl()` (presigned GET), never the raw stored value. |
| `wordTimings` | `Json?` | Array of `{ text, start, end }` (seconds) from ElevenLabs forced transcription. Drives word-by-word highlighting in the live script view. `null`/absent for most lessons — the player falls back to a coarser paragraph-level estimate. |
| `durationSeconds` | `Int?` | Narration length, computed as `Math.floor(lastWordTiming.end)` when audio is uploaded/transcribed. `null` until a lesson has audio. Mobile UI shows a `2:00` placeholder when `null` rather than fabricating a number. |

New `LessonModule` enum values: `WELCOME`, `POSITIVE_PLAY`, `CALM_DISCIPLINE`, `BIG_FEELINGS_TANTRUMS` (plus matching `Module` rows for admin dropdowns / mobile module browsing). Existing modules and lessons were not touched.

**Content status as of this writing**: of the 23 lessons across the four V2 modules, only `WELCOME-1` has `audioUrl`/`wordTimings`/`durationSeconds` populated — the rest have `contentV2` text but no narration yet. Anything gated on "has audio" (inline mini-player playback, word-level highlighting, real duration) only applies to that one lesson today; everything else falls back to its no-audio behavior (see [Known gaps](#known-gaps--not-built)). `WELCOME-1` is also the first lesson authored with `**bold**` spans and an inline image, so it exercises the full formatting pipeline end to end.

### Module routing

There's no `Lesson.contentType` flag — instead, both the admin UI and mobile app hard-code which modules are "V2":

- Admin: `CONTENT_V2_MODULES` in `admin/src/pages/LessonContentV2ListPage.tsx`
- Mobile: `CONTENT_V2_MODULES` in `nora-mobile/src/constants/contentV2Modules.ts`

Both currently list the same four module keys. Adding a fifth V2 module means updating both constants.

---

## Admin: authoring Content V2 lessons

A **new, separate** admin section — the existing Lessons list/editor (segments, quiz) is untouched.

| Page | Route | Purpose |
|---|---|---|
| `LessonContentV2ListPage.tsx` | `/content-v2` | Lists lessons belonging only to the four V2 modules |
| `LessonContentV2EditorPage.tsx` | `/content-v2/:id` | Edit one lesson's `contentV2` text and `audioUrl` |

### Text formatting

The content textarea supports the same `**bold**` / `* bullet` syntax as segment `bodyText`, with a Bold/Bullet toolbar and Ctrl/Cmd+B shortcut. The keyboard-shortcut logic was extracted from `SegmentEditor.tsx` into `admin/src/utils/textFormatting.ts` (`handleBoldShortcut`, `insertTextareaMarker`) so both editors share one implementation.

### Inline images

An "Insert Image" button next to Bold/Bullet uploads a file (`POST /api/admin/lessons/:id/content-image`) and inserts a `![](key)` marker at the cursor, on its own blank-line-separated paragraph. Unlike the toolbar's bold/bullet markers, this doesn't wrap a selection — it just drops the marker in, and the admin repositions it by cutting/pasting the `![](...)` line like any other text.

A few things worth knowing:

- **Unlike `dragonImageUrl`** (one fixed S3 key per lesson, overwritten on re-upload), a lesson can have many inline images — each upload gets its own key under `lessons/{id}/content-images/{uuid}.{ext}` (`uploadLessonContentImage()` in `storage-s3.cjs`).
- **The raw S3 key is what's saved** in `contentV2` (bucket is private, so a presigned URL baked into the saved text would eventually expire). It's resolved to a presigned URL only when `contentV2` is returned to a mobile client — `resolveContentImageUrls()` scans the text for `![](...)` markers and re-signs each one, called from the lesson-detail response in `server/routes/lessons.cjs`.
- **The admin textarea has no image preview** — it's still a plain-text editor, so the admin sees the raw `![](lessons/...)` marker, not a rendered thumbnail. Uploading returns a presigned `url` in the response too, in case a future preview is added; today it's unused by the editor UI.
- **Removing an image** means deleting its `![](...)` line from the textarea and saving — there's no separate delete-from-S3 step (matches how a removed `**bold**` marker doesn't delete anything either; orphaned S3 objects are just unreferenced, not cleaned up automatically).

### Audio upload → auto-transcription

Uploading an audio file (`POST /api/admin/lessons/:id/audio`) does three things in one request:

1. Uploads the file to S3 (`uploadLessonAudio()` in `storage-s3.cjs`, mirrors the existing `uploadLessonImage()` pattern).
2. Sends the same buffer to **ElevenLabs speech-to-text** (`transcribeLessonNarration()` in `transcriptionService.cjs` — reuses the `callElevenLabs()` client already used for coaching-session transcription, with `scribe_v2` and diarization off since it's a single narrator).
3. Saves the returned word-level timings to `Lesson.wordTimings`.

The response also includes the plain transcript text, which the editor page auto-fills into the Lesson Content textarea (asking for confirmation first if there's already unsaved text) — the admin then adds `**bold**`/bullets on top of the raw transcript rather than typing from scratch.

Transcription failure does **not** fail the upload — the audio is saved either way, and the editor shows "Audio saved, but transcription failed: …". Removing audio (`PATCH /api/admin/lessons/:id/content-v2` with `audioUrl: null`) also clears `wordTimings` so stale timings can't point at a deleted file.

### Server endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/admin/lessons/:id/audio` | Upload narration audio; uploads to S3 + transcribes via ElevenLabs; persists `audioUrl` + `wordTimings` |
| `POST /api/admin/lessons/:id/content-image` | Upload an inline content image; uploads to S3 under a per-image unique key. Doesn't touch any lesson field — returns `{ key, marker, url }` and the admin inserts `marker` into the text themselves, same as bold/bullets. |
| `PATCH /api/admin/lessons/:id/content-v2` | Update `contentV2` / `audioUrl` / `wordTimings` independently. Deliberately **not** routed through the classic `PUT /lessons/:id` handler, which replaces `segments`/`quiz` whenever those keys are present — this endpoint can never touch them. |

`content-v2`/`audio`/`content-image` are scoped to `contentV2`/`audioUrl`/`wordTimings` only; segments and quiz continue to go through the original `POST/PUT /api/admin/lessons/:id`.

---

## Mobile: browsing — `LearnScreen_v3`

The live Learn tab. Single-course layout instead of ~26 per-module horizontally-scrolling sections:

```
┌─────────────────────────────┐
│  [image]  Title / Subtitle   │  cover band            ┐
├─────────────────────────────┤                         │ fixed —
│  N / M lessons · X% learned  │  progress card          │ does not
│  [Continue ▶]                │                         │ scroll
├─────────────────────────────┤                         │
│  [Module ▾]      [Unfinished]│  filter row (in the     │
│ ─────────────────────────── │  same white card as the │
│  Welcome (1 lessons)          │  scrollable list below) ┘
│  Introduction  [Last viewed]  │
│    2:18  [Read] ▶            │  section-headed list — the only
│  Positive Play (8 lessons)    │  scrollable region
│  You're Playing…  2:00 [Read]▶│
│  ...                          │
├─────────────────────────────┤
│  [♪] Title          ⏸ ✕      │  mini-player (only while playing)
└─────────────────────────────┘
```

- **Progress card**: `{completed}/{total} lessons · {percent}% learned`, derived live from each lesson's `UserLessonProgress.status`. **Continue** starts inline playback of the first not-completed lesson (via the same play logic as a row's play circle — see below) rather than navigating into the full player.
- **Module filter / "Only unfinished"**: client-side filters over the already-fetched lesson list; no extra requests. Filter row and the lesson list live inside one white "playlist" card (matching the progress card's styling) below the fixed header.
- **Per-row play circle**: tapping it plays that lesson's narration inline via the mini-player, *without* navigating away — the row's title turns purple while it's the active track. Lessons with no `audioUrl` yet fall back to the normal navigate-to-full-player behavior (same as tapping the title). The circle's appearance doesn't change for completed lessons — completion is shown only via the title color and a `"2:18 | completed"` duration tag, not a different play-button state.
- **"Read" button**: beside the play circle on every row, independent of playback. Opens a full-screen, blog-formatted reader (module tag, title, day/duration meta, then the parsed body) — see [The Read page](#the-read-page) below.
- **"Continue" line / "Last viewed" badge**: while a lesson is actively playing, both the progress card's `Continue: {title}` line and the row-level "Last viewed" badge follow the *currently playing* lesson rather than stale `UserLessonProgress.lastViewedAt` history — computed as `playingLesson ?? (the progress-derived one)` so they fall back to real history once nothing is playing.
- **Mini-player**: appears pinned to the bottom once a lesson is playing. Shows title, duration, and a play/pause button ringed with a circular playback-progress indicator (`react-native-svg`). Closing it (✕) stops playback entirely.

### The Read page

Tapping "Read" fetches the lesson's full detail (`lessonService.getLessonDetail()`, since the list endpoint's `LessonCardData` doesn't carry `contentV2`) and renders it through the same `formatLessonContentV2` + `LessonContentBlocks` pipeline as the full player, so `**bold**`, bullets, and inline images all render — not a separate, more limited renderer.

For a lesson whose `contentV2` is still a raw, unformatted transcript blob (no paragraph breaks, no bold, no bullets, no images — i.e. nothing for the parser to key off), `LearnScreen_v3.tsx`'s `isUnformattedBlob()`/`splitIntoSentenceParagraphs()` group it into ~7-sentence paragraphs instead of rendering one giant wall of text. Once a lesson has *any* real formatting, that fallback never touches it — an author-written paragraph is trusted verbatim no matter how long, rather than being re-chunked by sentence count.

## Mobile: the full player — `LessonViewerScreen_v2`

**Entry point:** registered as the `LessonViewerV2` route, pushed from `LearnScreen_v3`, `LearnScreen_v2.tsx`, and `ModuleDetailScreen.tsx` (all branch on `CONTENT_V2_MODULES` when a lesson is tapped — V2-module lessons push `LessonViewerV2`, everything else still pushes the original `LessonViewer`).

### Layout

```
┌─────────────────────────────┐
│  ⌄        Day N · Title      │  header (close, module label)
├─────────────────────────────┤
│                               │
│      LiveScriptCard           │  live-scrolling script, tap ⤢ to expand
│                               │
├─────────────────────────────┤
│  ◄◄15   ━━━●━━━━━  30►►      │  AudioPlayBar
│        ⏮  ▶  ⏭  1×          │
├─────────────────────────────┤
│  Sibling lessons (day order)  │  LessonPlaylistSheet
└─────────────────────────────┘
```

### Shared audio state — `LessonPlayerContext`

Both this screen and the `LearnScreen_v3` mini-player read/control the **same** `expo-av` `Sound` instance through `nora-mobile/src/contexts/LessonPlayerContext.tsx`, an app-wide provider wrapping the navigator (added to `App.tsx`). This exists so a lesson started in one surface doesn't get silently restarted or duplicated when the other surface mounts — e.g. starting playback from the mini-player, then opening that same lesson's full player, shows the exact same play/pause state and scrub position instead of reloading from 0:00.

Key pieces of the context's API:

- `loadLesson(lessonId, audioUrl)` — switches the active track and always autoplays. **No-ops if `lessonId` is already the active track** — this is what makes the sync work: `LessonViewerScreen_v2` calls this on every lesson-data load, and if that lesson is already playing (started from the mini-player), the call is a no-op and the existing state is inherited untouched.
- `play()` / `pause()` / `seekTo()` / `seekBy()` / `cycleRate()` — same shape as the old per-screen hook, so `AudioPlayBar` (presentational, all state via props) and `LiveScriptCard` (needs position/duration to estimate the active word/paragraph) didn't need to change.
- `setOnFinish(cb)` — whichever screen is currently **focused** registers its own "what plays next" handler via `useFocusEffect` (`LearnScreen_v3` advances through the full cross-module list; `LessonViewerScreen_v2` advances through the current module's day-ordered playlist). The context calls the currently-registered handler with the id of the lesson that just finished; both handlers also call `lessonService.completeLesson(lessonId)` there — see [Completion tracking](#completion-tracking).

The older `nora-mobile/src/hooks/useLessonAudioPlayer.ts` (one `Sound` instance per call, no cross-screen sharing) still exists but is no longer imported anywhere — kept rather than deleted in case a future single-screen-only use case needs it.

### Live script highlighting — `LiveScriptCard`

Two render modes, chosen automatically by whether `lesson.wordTimings` is present:

- **Word-level (has `wordTimings`)**: `contentV2`/`blocks` — **not** `wordTimings`' own text — is the source of truth for what's displayed, via `flattenBlocksToChunks()` (`nora-mobile/src/utils/formatLessonContentV2.ts`). This exists because an admin can edit `contentV2` after the audio was transcribed (removing filler words, cleaning up punctuation, adding `**bold**`/images), so `wordTimings`' word list — straight from the original ElevenLabs transcript — can drift out of sync with the text. `flattenBlocksToChunks()` walks `blocks` and produces a flat sequence of `{ type: 'sentence', words }` / `{ type: 'image', url }` chunks (image blocks always become their own chunk so they render — and stay visible — in place, instead of vanishing from a text-only flatten):
  - If `wordTimings.length` still equals the chunk stream's total word count, each `wordTimings[i]`'s timestamp drives exactly which word is "spoken" (precise sync).
  - If the counts have diverged (the common case once a lesson's text has been edited), that falls back to a proportional estimate — `floor((position/duration) × wordCount)` — over `contentV2`'s own word list. Sync is less precise, but the *text* (and its bold formatting) is always correct.
  - Auto-scroll targets whichever chunk contains the current word index (`activeChunkIndex`), via per-chunk `onLayout` offsets + `ScrollView.scrollTo`.
- **Paragraph-level fallback (no `wordTimings`)**: `contentV2` is parsed into blocks by `formatLessonContentV2()` (bold/bullet/paragraph/image — same rendering as the classic segment `bodyText`, extracted into the shared `LessonContentBlocks.tsx` component). The "active" paragraph is estimated as `floor((position/duration) × blockCount)` — a coarse approximation with no per-word data, since most lessons don't have `wordTimings` yet.

Tapping the expand icon opens a full-screen modal with the complete script in the same format (word-colored/image chunks or paragraph blocks) — it reuses the same render function as the compact view rather than duplicating the logic.

> **Yoga/layout gotcha hit twice while building this**: a `flex: 1` child inside a parent sized only by `minHeight`/`maxHeight` (not a fixed height) can resolve to zero height in React Native and silently render nothing. `LiveScriptCard`'s outer card therefore uses a fixed `height`, and `LessonContentBlocks`' paragraph `Text` only gets `flex: 1` where it's actually load-bearing (next to a bullet dot in a row) — not in the single-child paragraph case.

> **Font-weight gotcha**: `fontWeight: '700'` is a silent no-op on this app's bold styling — PlusJakartaSans is loaded via `expo-google-fonts` as separate per-weight font families (`PlusJakartaSans_400Regular`/`_600SemiBold`/`_700Bold`, see `FONTS` in `constants/assets.ts`), not weight variants of one family that `fontWeight` can select between. Any "bold" style on custom-font text must set `fontFamily: FONTS.bold` instead. Both `LessonContentBlocks`' `bold` style and `LiveScriptCard`'s `wordBold` style were fixed this way after bold spans first shipped rendering as plain text.

### Controls — `AudioPlayBar`

Presentational only (no `expo-av` import). Row 1: skip ‑15s / scrubber+times / skip +30s. Row 2: previous lesson / play-pause / next lesson / playback speed (1× → 1.25× → 1.5× → 2× cycle).

### Playlist — `LessonPlaylistSheet`

Lists the *other* lessons in the same module (fetched once in the screen via `lessonService.getLessons(moduleKey)`, passed down as a prop — not re-fetched per component), fixed day order (no sort toggle). Tapping a row updates `currentLessonId` state in the screen (re-running the existing fetch effect) rather than pushing a new screen, so the player persists across track changes. No delete/reorder controls — it's a fixed curriculum, not a user queue.

Previous/next-track buttons and auto-advance-on-finish use the same day-ordered sibling list.

---

## Completion tracking

A lesson's `UserLessonProgress.status` becomes `COMPLETED` through two independent paths that don't overlap:

- **Classic lessons** (`LessonViewerScreen.tsx`, segments/quiz): completed when the user taps through every segment and the quiz to the last item, which calls `lessonService.updateProgress(lessonId, { status: 'COMPLETED' })`.
- **Content V2 lessons**: completed when a lesson's narration plays to the end (`expo-av`'s `didJustFinish`) in **either** the mini-player or the full player — both register an `onFinish` handler on `LessonPlayerContext` (see above) that calls `lessonService.completeLesson(lessonId)`, then refetches the lesson list so the progress card and row state update immediately.

**Gap**: opening a Content V2 lesson in the full player and *reading* it without ever letting the audio finish (or a lesson with no audio at all) never marks it complete — there's no segment/scroll-based completion signal for this content type, only "listened to the end."

---

## Key files

| File | Role |
|---|---|
| `prisma/schema.prisma` | `Lesson.contentV2` / `audioUrl` / `wordTimings` / `durationSeconds`, new `LessonModule` values |
| `server/routes/admin.cjs` | `POST /lessons/:id/audio`, `POST /lessons/:id/content-image`, `PATCH /lessons/:id/content-v2` |
| `server/routes/lessons.cjs` (mobile-facing) | `formatLessonCard()` resolves `audioUrl`/`durationSeconds` for the list endpoint; lesson-detail endpoint resolves `audioUrl` and inline image URLs in `contentV2` |
| `server/services/storage-s3.cjs` | `uploadLessonAudio()`, `uploadLessonContentImage()`, `resolveLessonAudioUrl()`/`resolveContentImageUrls()` (presigned reads — bucket is private) |
| `server/services/transcriptionService.cjs` | `transcribeLessonNarration()` — ElevenLabs speech-to-text, diarization off |
| `packages/nora-core/src/types/index.ts` | `Lesson`/`LessonCardData` `contentV2`/`audioUrl`/`wordTimings`/`durationSeconds`, `WordTiming` type, extended `LessonModule` union |
| `admin/src/pages/LessonContentV2ListPage.tsx` / `LessonContentV2EditorPage.tsx` | Admin authoring UI, incl. the "Insert Image" upload button |
| `admin/src/api/adminApi.ts` | `updateLessonContentV2()`, `uploadLessonAudio()`, `uploadLessonContentImage()` |
| `admin/src/utils/textFormatting.ts` | Shared bold/bullet textarea helpers (also used by `SegmentEditor.tsx`) |
| `nora-mobile/src/screens/LearnScreen_v3.tsx` | Live Learn tab — browsing list, filters, progress card, mini-player, "Read" page reader |
| `nora-mobile/src/screens/LessonViewerScreen_v2.tsx` | Full player screen, owns lesson-switching (`currentLessonId`) |
| `nora-mobile/src/contexts/LessonPlayerContext.tsx` | App-wide shared `expo-av` playback state (mini-player ⇄ full player sync), wrapped in `App.tsx` |
| `nora-mobile/src/hooks/useLessonAudioPlayer.ts` | Superseded per-screen playback hook — no longer imported anywhere, kept unreferenced |
| `nora-mobile/src/components/LiveScriptCard.tsx` | Live script view (word-level chunk highlighting, incl. inline images, or paragraph fallback) |
| `nora-mobile/src/components/LessonContentBlocks.tsx` | Shared paragraph/bullet/image renderer |
| `nora-mobile/src/components/AudioPlayBar.tsx` | Playback controls (presentational) |
| `nora-mobile/src/components/LessonPlaylistSheet.tsx` | Sibling-lesson list |
| `nora-mobile/src/utils/formatLessonContentV2.ts` | Parses `contentV2` (bold/bullet/image/paragraph) into blocks; `flattenBlocksToChunks()`/`countChunkWords()` for `LiveScriptCard`'s word-level mode |
| `nora-mobile/src/utils/groupWordTimings.ts` | Superseded by `flattenBlocksToChunks()` — no longer imported anywhere, kept unreferenced |
| `nora-mobile/src/constants/contentV2Modules.ts` | The module-routing list (keep in sync with the admin copy) |

---

## Known gaps / not built

- **No i18n for `contentV2`** — unlike `LessonTranslation`/`LessonSegmentTranslation`, there's no per-locale translation table for V2 content yet.
- **No "% listened" / resume-position tracking** — `positionMillis` lives only in `LessonPlayerContext`'s in-memory state; it's lost on app restart or when a different lesson is loaded, and the playlist/list don't show partial-listen progress. Would need a position-persistence endpoint.
- **Only one lesson has real narration today** (`WELCOME-1` — see [Content status](#data-model)). The mini-player, inline play circles, and word-level highlighting only actually engage for that lesson; every other row falls back to navigate-to-full-player, which then shows text-only with no audio controls.
- **Content V2 lessons only get marked complete by listening to the end** — there's no "mark as read" path for the text-only case, unlike classic lessons which complete via the segment/quiz flow regardless of audio. Reading the full script via the Read page or the full player, without ever finishing the audio, doesn't count either.
- **`wordTimings` only auto-populates on new audio uploads.** Lessons whose audio was uploaded before the ElevenLabs integration was wired in (or where transcription failed) simply have no word-level sync until the audio is re-uploaded — the player falls back gracefully in that case, it's not an error state.
- **No admin-side image preview.** The "Insert Image" button uploads and drops a `![](key)` marker into the plain-text textarea, but the editor doesn't render a thumbnail — the admin has to save and check the mobile app (or the Read page) to see how it actually looks.
- **No orphaned-image cleanup.** Deleting a `![](...)` line from `contentV2` (or replacing an image) doesn't delete the underlying S3 object — it's just unreferenced. Not a correctness problem (unreferenced keys are never resolved/shown), but storage isn't reclaimed automatically.
- **Module routing is a hard-coded list in two places** (admin + mobile), not a DB flag — easy to forget to update both when adding a new V2 module.
