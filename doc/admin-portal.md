# Admin Portal

Web-based admin interface for managing lessons (CRUD with live mobile preview) and sending push notifications to users. Built with React + Vite, backed by Express API routes.

## Quick Start

```bash
# Start backend
node server.cjs

# Start admin dev server (in separate terminal)
cd admin && npm run dev
```

Open `http://localhost:5173/admin` and log in with the `ADMIN_PASSWORD` from `.env`.

For production, build and serve statically:

```bash
cd admin && npm run build
# Served automatically at /admin by server.cjs
```

## Architecture

| Layer | Technology | Location |
|-------|-----------|----------|
| Frontend | React 18 + Vite + TypeScript | `admin/` |
| API | Express routes at `/api/admin/*` | `server/routes/admin.cjs` |
| Auth middleware | JWT with `{ role: 'admin' }` | `server/middleware/adminAuth.cjs` |
| Database | Prisma (same as mobile app) | `prisma/schema.prisma` |

The Vite dev server proxies `/api` requests to `localhost:3001`. In production, `server.cjs` serves the built SPA from `admin/dist/` at the `/admin` path.

## Authentication

Simple password-based auth — no user accounts needed.

1. Admin enters password on login page
2. `POST /api/admin/auth/login` compares against `ADMIN_PASSWORD` env var using `crypto.timingSafeEqual`
3. Returns a JWT (24h expiry) signed with existing `JWT_ACCESS_SECRET`, payload: `{ role: 'admin' }`
4. Frontend stores token in `localStorage` and injects via `Authorization: Bearer <token>` header
5. `requireAdminAuth` middleware verifies token and checks `role === 'admin'`

**Environment variable:** Add `ADMIN_PASSWORD` to `.env` (see `.env.example`).

## API Endpoints

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/admin/auth/login` | No | Login with password, returns JWT |
| `GET` | `/api/admin/auth/verify` | Yes | Verify current token is valid |

### Lessons

All require admin auth.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/lessons?module=X` | List lessons with segment count, optional module filter |
| `GET` | `/api/admin/lessons/:id` | Full lesson detail (segments + quiz + options) |
| `POST` | `/api/admin/lessons` | Create lesson + segments + quiz in one transaction |
| `PUT` | `/api/admin/lessons/:id` | Update lesson metadata, replace segments + quiz |
| `DELETE` | `/api/admin/lessons/:id` | Delete lesson (cascades to segments, quiz, progress) |
| `GET` | `/api/admin/modules` | List modules for filter dropdowns |
| `POST` | `/api/admin/modules` | Create a new module |
| `PUT` | `/api/admin/modules/:key` | Update module details |

### Notifications

All require admin auth.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/users` | List users with push token status and session count |
| `POST` | `/api/admin/notifications/send` | Send push notification to selected users |

## Lesson ID Convention

IDs are deterministic, not UUIDs:

| Entity | Pattern | Example |
|--------|---------|---------|
| Lesson | `{MODULE}-{dayNumber}` | `FOUNDATION-1` |
| Segment | `{lessonId}-seg-{order}` | `FOUNDATION-1-seg-1` |
| Quiz | `{lessonId}-quiz` | `FOUNDATION-1-quiz` |
| Quiz option | `{lessonId}-quiz-opt-{A\|B\|C\|D}` | `FOUNDATION-1-quiz-opt-A` |

When updating, segments and quiz options are fully replaced (delete + recreate) to keep IDs consistent with order.

## Frontend Structure

```
admin/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── main.tsx                          # Entry point
    ├── App.tsx                           # Router with protected routes
    ├── api/
    │   ├── client.ts                     # Fetch wrapper with JWT injection
    │   └── adminApi.ts                   # Typed API functions
    ├── auth/
    │   ├── AuthContext.tsx                # Auth state context + login/logout
    │   └── ProtectedRoute.tsx            # Route guard (redirects to /login)
    ├── pages/
    │   ├── LoginPage.tsx                 # Password login
    │   ├── LessonListPage.tsx            # Module-filterable table with delete
    │   ├── LessonEditorPage.tsx          # Split-pane: form + live preview
    │   └── NotificationsPage.tsx         # User selection + notification sender
    ├── components/
    │   ├── layout/
    │   │   └── AdminLayout.tsx           # Sidebar + content shell
    │   ├── lessons/
    │   │   ├── MetadataForm.tsx          # Lesson metadata fields
    │   │   ├── SegmentList.tsx           # Drag-reorderable segment list (dnd-kit)
    │   │   ├── SegmentEditor.tsx         # Single segment editor form
    │   │   └── QuizEditor.tsx            # Quiz question + 4 options editor
    │   ├── preview/
    │   │   ├── PhonePreview.tsx          # iPhone frame CSS wrapper
    │   │   └── LessonPreview.tsx         # Renders segments inside phone frame
    │   └── notifications/
    │       ├── UserList.tsx              # User table with checkboxes
    │       └── NotificationSender.tsx    # Title/body inputs + send button
    └── styles/
        └── globals.css                   # Admin styles + preview CSS
```

## Pages

### Lesson List (`/admin/lessons`)

- Table showing all lessons with ID, module, day, title, segment count, quiz status, last updated
- Module filter dropdown (populated from `/api/admin/modules`)
- Click row to edit, "Delete" button per row with confirmation
- "+ New Lesson" button navigates to editor
- "+ Add Module" button opens a modal to create a new module (key selected from available `LessonModule` enum values)
- "Edit Module" button appears next to the filter when a module is selected — opens the same modal pre-filled for editing title, shortName, description, displayOrder, and backgroundColor

### Lesson Editor (`/admin/lessons/new` or `/admin/lessons/:id`)

Split-pane layout:

- **Left panel:** Form with three sections:
  - **Metadata** — module, day number, title, subtitle, description, objectives, categories, colors
  - **Segments** — drag-reorderable list (using `@dnd-kit`), each with section title, content type, body text. `TEXT_INPUT` type shows extra fields for ideal answer and AI check mode
  - **Quiz** — optional, with question, 4 options (click letter to mark correct), explanation

- **Right panel:** Live iPhone preview
  - Reuses iPhone frame CSS from `public/share-lesson.html`
  - `formatBodyText` / `formatInlineText` ported from share page (supports `**bold**` and `* bullets`)
  - Content types styled: TIP (yellow), SCRIPT (blue), EXAMPLE (purple border), CALLOUT (purple bg), TEXT_INPUT (green bg with placeholder input)
  - Navigate between segments with arrow buttons
  - Preview updates on form changes (debounced 300ms)
  - iPhone 13 frame (390x844pt), scaled to 52% to fit the sidebar
  - Preview styles match the real mobile app (font sizes, colors, button styles)

### Text Formatting

The body text textarea supports:
- `**bold text**` — Ctrl+B (or Cmd+B) toggles bold on selected text
- `* bullet item` — lines starting with `* ` render as styled bullet points
- Blank lines add spacing

### Notifications (`/admin/notifications`)

- Left: user table with checkboxes (only users with push tokens are selectable)
- Right: compose panel with title/body inputs, preview box, and send button
- Default message: "Your Weekly Report is Ready!" / "Check out your progress this week"
- Uses existing `sendPushNotificationToUser` from `server/services/pushNotifications.cjs`

## Content Types

Segments support these `contentType` values (matching the Prisma `ContentType` enum):

| Type | Preview Style | Use |
|------|--------------|-----|
| `TEXT` | Default white | General content |
| `TIP` | Yellow background | Tips and best practices |
| `SCRIPT` | Blue background | Example scripts to say |
| `EXAMPLE` | Purple left border | Real-world examples |
| `CALLOUT` | Purple background | Important callouts |
| `TEXT_INPUT` | Green bg + input placeholder | Interactive text response with AI evaluation |

## Create/Update Flow

### Creating a lesson (`POST /api/admin/lessons`)

Request body:
```json
{
  "lesson": {
    "module": "FOUNDATION",
    "dayNumber": 5,
    "title": "Using Labeled Praise",
    "subtitle": "Day 5",
    "shortDescription": "Learn to praise specific behaviors",
    "objectives": ["Identify labeled praise", "Practice 3 examples"],
    "estimatedMinutes": 3,
    "teachesCategories": ["LABELED_PRAISE"],
    "backgroundColor": "#E4E4FF",
    "ellipse77Color": "#9BD4DF",
    "ellipse78Color": "#A6E0CB"
  },
  "segments": [
    {
      "sectionTitle": "What is Labeled Praise?",
      "contentType": "TEXT",
      "bodyText": "Labeled praise tells your child **exactly** what they did well.\n\n* \"Great job sharing your toys!\"\n* \"I love how you used gentle hands!\""
    },
    {
      "sectionTitle": "Try It!",
      "contentType": "TIP",
      "bodyText": "Next time your child does something positive, describe the specific behavior you noticed."
    }
  ],
  "quiz": {
    "question": "Which is an example of labeled praise?",
    "correctAnswer": "B",
    "explanation": "Labeled praise describes the specific behavior.",
    "options": [
      { "optionText": "Good job!" },
      { "optionText": "Great job putting your shoes on by yourself!" },
      { "optionText": "You're awesome!" },
      { "optionText": "Nice work!" }
    ]
  }
}
```

### Updating a lesson (`PUT /api/admin/lessons/:id`)

Same body structure. Segments and quiz are fully replaced (delete + recreate via `createMany`). Lesson metadata fields are patched (only provided fields are updated). Transaction timeout is 15 seconds.

### Creating a module (`POST /api/admin/modules`)

```json
{
  "key": "EMOTIONS",
  "title": "Managing Emotions",
  "shortName": "Emotions",
  "description": "Help your child understand and manage big feelings",
  "displayOrder": 2,
  "backgroundColor": "#E4E4FF"
}
```

`key` must be a valid `LessonModule` enum value. `displayOrder` auto-increments if omitted.

### Updating a module (`PUT /api/admin/modules/:key`)

```json
{
  "title": "Managing Big Emotions",
  "shortName": "Emotions",
  "description": "Updated description",
  "displayOrder": 3,
  "backgroundColor": "#FFE4E4"
}
```

Only provided fields are updated. `key` cannot be changed.
