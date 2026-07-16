# Learning V2 (Content V2 / Podcast-Style Lesson Player)

A second lesson experience that runs alongside the original segmented lesson flow (`LessonViewerScreen` — multi-segment cards, quizzes, keyword glossary). Learning V2 lessons are simpler: one audio narration track plus a single block of formatted text, presented as a podcast-style player with a live-highlighting script and a sibling-lesson playlist.

The two systems are intentionally decoupled — a lesson uses **either** the classic `segments`/`quiz` model **or** the V2 `contentV2`/`audioUrl` model, selected by which modules it belongs to (see [Module routing](#module-routing) below). Nothing about the original admin lesson editor or `LessonViewerScreen` was changed to build this.

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

New `LessonModule` enum values: `WELCOME`, `POSITIVE_PLAY`, `CALM_DISCIPLINE`, `BIG_FEELINGS_TANTRUMS` (plus matching `Module` rows for admin dropdowns / mobile module browsing). Existing modules and lessons were not touched.

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
| `PATCH /api/admin/lessons/:id/content-v2` | Update `contentV2` / `audioUrl` / `wordTimings` independently. Deliberately **not** routed through the classic `PUT /lessons/:id` handler, which replaces `segments`/`quiz` whenever those keys are present — this endpoint can never touch them. |

Both are scoped to `contentV2`/`audioUrl`/`wordTimings` only; segments and quiz continue to go through the original `POST/PUT /api/admin/lessons/:id`.

---

## Mobile: the player

**Entry point:** `LessonViewerScreen_v2.tsx`, registered as the `LessonViewerV2` route. `LearnScreen_v2.tsx` and `ModuleDetailScreen.tsx` branch on `CONTENT_V2_MODULES` when a lesson is tapped — V2-module lessons push `LessonViewerV2`, everything else still pushes the original `LessonViewer`.

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
│  Timer ⏮  ▶  ⏭  1×          │
├─────────────────────────────┤
│  Sibling lessons (sort:       │  LessonPlaylistSheet
│  day order / recent)          │
└─────────────────────────────┘
```

### Shared audio state — `useLessonAudioPlayer`

`nora-mobile/src/hooks/useLessonAudioPlayer.ts` owns the `expo-av` `Sound` lifecycle (preload on mount without autoplay — so duration is available before the user presses play — play/pause, seek, ±ms skip, playback-rate cycling). Both `LiveScriptCard` (needs position/duration to estimate the active word/paragraph) and `AudioPlayBar` (presentational, all state via props) read from this single hook, so switching lessons is just re-keying the hook by a new `audioUrl` — no screen remount.

### Live script highlighting — `LiveScriptCard`

Two render modes, chosen automatically by whether `lesson.wordTimings` is present:

- **Word-level (has `wordTimings`)**: words are grouped into sentences (`groupWordTimingsIntoSentences()` in `nora-mobile/src/utils/groupWordTimings.ts`, splits on `.`/`!`/`?`). Each word renders black once `word.start <= currentPlaybackSeconds`, grey otherwise — updating continuously as playback advances. The view auto-scrolls (via per-sentence `onLayout` offsets + `ScrollView.scrollTo`) to keep the active sentence in view.
- **Paragraph-level fallback (no `wordTimings`)**: `contentV2` is parsed into blocks by `formatLessonContentV2()` (bold/bullet/paragraph — same rendering as the classic segment `bodyText`, extracted into the shared `LessonContentBlocks.tsx` component). The "active" paragraph is estimated as `floor((position/duration) × blockCount)` — a coarse approximation with no per-word data, since most lessons don't have `wordTimings` yet.

Tapping the expand icon opens a full-screen modal with the complete script in the same format (word-colored or paragraph blocks).

> **Yoga/layout gotcha hit twice while building this**: a `flex: 1` child inside a parent sized only by `minHeight`/`maxHeight` (not a fixed height) can resolve to zero height in React Native and silently render nothing. `LiveScriptCard`'s outer card therefore uses a fixed `height`, and `LessonContentBlocks`' paragraph `Text` only gets `flex: 1` where it's actually load-bearing (next to a bullet dot in a row) — not in the single-child paragraph case.

### Controls — `AudioPlayBar`

Presentational only (no `expo-av` import). Row 1: skip ‑15s / scrubber+times / skip +30s. Row 2: sleep timer (15/30/45/60 min presets, local `setTimeout`) / previous lesson / play-pause / next lesson / playback speed (1× → 1.25× → 1.5× → 2× cycle).

### Playlist — `LessonPlaylistSheet`

Lists the *other* lessons in the same module (fetched once in the screen via `lessonService.getLessons(moduleKey)`, passed down as a prop — not re-fetched per component). Sort toggle: day order vs. most-recently-active. Tapping a row updates `currentLessonId` state in the screen (re-running the existing fetch effect) rather than pushing a new screen, so the player persists across track changes. No delete/reorder controls — it's a fixed curriculum, not a user queue.

Previous/next-track buttons and auto-advance-on-finish use the same day-ordered sibling list.

---

## Key files

| File | Role |
|---|---|
| `prisma/schema.prisma` | `Lesson.contentV2` / `audioUrl` / `wordTimings`, new `LessonModule` values |
| `server/routes/admin.cjs` | `POST /lessons/:id/audio`, `PATCH /lessons/:id/content-v2` |
| `server/services/storage-s3.cjs` | `uploadLessonAudio()`, `resolveLessonAudioUrl()` (presigned reads — bucket is private) |
| `server/services/transcriptionService.cjs` | `transcribeLessonNarration()` — ElevenLabs speech-to-text, diarization off |
| `packages/nora-core/src/types/index.ts` | `Lesson.contentV2/audioUrl/wordTimings`, `WordTiming` type, extended `LessonModule` union |
| `admin/src/pages/LessonContentV2ListPage.tsx` / `LessonContentV2EditorPage.tsx` | Admin authoring UI |
| `admin/src/utils/textFormatting.ts` | Shared bold/bullet textarea helpers (also used by `SegmentEditor.tsx`) |
| `nora-mobile/src/screens/LessonViewerScreen_v2.tsx` | Player screen, owns lesson-switching + audio-player state |
| `nora-mobile/src/hooks/useLessonAudioPlayer.ts` | Shared `expo-av` playback state |
| `nora-mobile/src/components/LiveScriptCard.tsx` | Live script view (word-level or paragraph fallback) |
| `nora-mobile/src/components/LessonContentBlocks.tsx` | Shared paragraph/bullet renderer |
| `nora-mobile/src/components/AudioPlayBar.tsx` | Playback controls (presentational) |
| `nora-mobile/src/components/LessonPlaylistSheet.tsx` | Sibling-lesson list |
| `nora-mobile/src/utils/formatLessonContentV2.ts` | Parses `contentV2` markdown-like text into blocks |
| `nora-mobile/src/utils/groupWordTimings.ts` | Groups flat word-timing array into sentences |
| `nora-mobile/src/constants/contentV2Modules.ts` | The module-routing list (keep in sync with the admin copy) |

---

## Known gaps / not built

- **No i18n for `contentV2`** — unlike `LessonTranslation`/`LessonSegmentTranslation`, there's no per-locale translation table for V2 content yet.
- **No "% listened" tracking** — the playlist doesn't show listening progress; would need a new position-persistence endpoint.
- **No global mini-player** — closing the screen stops playback entirely; there's no app-wide persistent player (would need a global audio context spanning navigation).
- **`wordTimings` only auto-populates on new audio uploads.** Lessons whose audio was uploaded before the ElevenLabs integration was wired in (or where transcription failed) simply have no word-level sync until the audio is re-uploaded — the player falls back gracefully in that case, it's not an error state.
- **Module routing is a hard-coded list in two places** (admin + mobile), not a DB flag — easy to forget to update both when adding a new V2 module.
