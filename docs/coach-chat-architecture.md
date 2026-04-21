# Coach Chat Architecture

## Overview

The AI coaching chat feature lets parents converse with an AI coach that has contextual knowledge of their child's developmental data. It uses long-polling for real-time delivery, a Gemini-primary / Claude-fallback LLM agent, and a shared pub/sub bus that also feeds an admin portal.

---

## Key Files

| Layer | Path |
|---|---|
| Frontend screen | `nora-mobile/src/screens/CoachChatScreen.tsx` |
| Unread badge context | `nora-mobile/src/contexts/CoachUnreadContext.tsx` |
| Auth/request utility | `packages/nora-core/src/services/authService.ts` |
| Backend coach routes | `server/routes/coach.cjs` |
| Admin coach routes | `server/routes/admin.cjs` (lines 1636–1876) |
| Long-poll pub/sub bus | `server/services/chatBus.cjs` |
| In-flight LLM abort registry | `server/services/agentBus.cjs` |
| LLM gateway / logger | `server/llm/gateway.cjs`, `server/llm/logger.cjs` |
| Database schema | `prisma/schema.prisma` (`CoachChatMessage` model) |

---

## Database Schema

```prisma
model CoachChatMessage {
  id        String   @id @default(uuid())
  userId    String
  role      String   // 'user' | 'model' | 'psychologist'
  text      String
  createdAt DateTime @default(now())
  user      User     @relation(...)
  @@index([userId, createdAt])
}
```

The `psychologist` role is only inserted by the admin panel and renders as a distinct blue bubble in the mobile UI.

---

## Backend API Endpoints

All routes are under `/api/coach/` and protected by `requireAuth` middleware.

### `GET /api/coach/history`
Returns all `CoachChatMessage` rows for the authenticated user (oldest-first). Called once on screen mount to restore conversation from the database.

### `GET /api/coach/events?since=<ISO>`
Long-poll endpoint. Returns immediately if rows newer than `since` exist; otherwise holds the connection open up to 25 seconds via `chatBus.subscribe()`. Used for both real messages and transient status hints.

### `POST /api/coach/chat`
Body: `{ message: string }`

1. Saves user message to DB and publishes it to the bus (admin sees it immediately).
2. Loads the last 20 messages (`MAX_HISTORY_MESSAGES = 20`) as LLM context.
3. Registers an `AbortController` in `agentBus` for admin cancellation.
4. Runs `runAgentLoop` (Gemini primary).
5. On timeout/abort: retries once, then falls back to `runClaudeAgentLoop`.
6. On total failure: saves a sorry message to DB and publishes it.
7. On success: saves AI reply as `role: 'model'` and publishes it.
8. Returns `{ reply }` — the mobile client **ignores this** and receives the reply through the long-poll channel.

### `GET /api/coach/unread?since=<ISO>`
Returns `{ count }` of non-user messages created after the given timestamp.

---

## LLM Agent Loop

### Primary: Gemini (`gemini-3-pro-preview`)

`runAgentLoop` in `server/routes/coach.cjs` line ~250:

- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent`
- Up to 6 tool-call turns (`MAX_AGENT_TURNS = 6`)
- On each tool-call turn:
  1. Publishes a status hint to the long-poll bus (e.g. `"Checking recent progress..."`)
  2. Executes all requested tools in parallel via Prisma DB queries
  3. Appends results and sends the next Gemini request
  4. Repeats until Gemini returns a text part (no function calls)

### Fallback: Claude Sonnet (`claude-sonnet-4-6`)

`runClaudeAgentLoop` in `server/routes/coach.cjs` line ~350:

- Triggered after: Gemini timeout → retry → second timeout
- Endpoint: `https://api.anthropic.com/v1/messages`
- Converts Gemini tool declarations to Claude's `input_schema` format
- Enforces Claude's strict user/assistant turn alternation (merges consecutive same-role messages)
- Same 4 tools, same 6-turn limit
- `stop_reason === 'end_turn'` signals completion

### Available Tools

| Tool | Description |
|---|---|
| `get_child_parent_profile` | Last 2 developmental profiling snapshots |
| `get_child_milestone` | Milestone progress across 5 domains (radar chart data) |
| `get_recent_sessions` | Up to 10 recent play sessions with skill counts |
| `get_transcript` | Full utterance-level transcript of the most recent session |

### System Prompt

The system prompt (`SYSTEM_PROMPT`, line ~22 of `server/routes/coach.cjs`) instructs the AI to:
- Act as a PCIT therapist
- Always use tools before answering
- Never mention "PCIT" to parents (rebranded as "emotional massage")
- Format responses for mobile readability

---

## Real-time: Long-poll Mechanism

The app uses **long-polling**, not WebSockets or SSE.

### Server-side (`chatBus.cjs`)

```
waiters: Map<userId, Set<{resolve, timer}>>
```

- `subscribe(userId, resolve, timeoutMs=25000)` — registers a waiter with a 25-second timeout; returns an unsubscribe cleanup called on `req.on('close')`
- `publish(userId, messages)` — wakes all waiters for a user, clears timers, delivers messages immediately

### Client polling loop (`CoachChatScreen.tsx` line ~113)

1. On mount: fetch full history via `GET /api/coach/history`
2. Start `startPolling()` → `GET /api/coach/events?since=<last_createdAt>`
3. Server holds up to 25s; resolves immediately when `publish()` fires
4. Client appends new messages and immediately re-enters the loop via `.finally()`
5. Messages with `type === 'status'` display as animated `statusText` in the typing indicator; actual messages are appended to state

Status hints (e.g. `"Thinking..."`, `"Reviewing milestones..."`) are published to the bus but **never persisted to DB** — they appear only in the current session's typing indicator.

---

## Frontend Component

**`CoachChatScreen.tsx`** — self-contained, no external state management.

### Local state

| State | Purpose |
|---|---|
| `messages: Message[]` | Rendered conversation; starts with a hardcoded greeting bubble |
| `input: string` | Controlled TextInput value |
| `loading: boolean` | Disables send button, shows typing indicator |
| `statusText: string \| null` | Animated label while LLM executes a tool |
| Modal state | "Talk to a Psychologist" flow |

### Message interface

```ts
interface Message {
  id: string;
  role: 'user' | 'model' | 'psychologist';
  text: string;
  createdAt?: string;
}
```

### Bubble rendering

| Role | Alignment | Color | Icon |
|---|---|---|---|
| `user` | Right | Purple | — |
| `model` | Left | Grey | Sparkle |
| `psychologist` | Left | Blue | Person + label |

### Unread badge (`CoachUnreadContext.tsx`)

- Polls `GET /api/coach/unread?since=<ISO>` every 30 seconds
- Re-fetches on foreground resume
- Persists `lastReadAt` to `AsyncStorage` under key `@nora_coach_last_read_at`

---

## End-to-End Data Flow

```
User taps Send
  └─ handleSend() → POST /api/coach/chat { message }
       └─ Server:
            1. INSERT CoachChatMessage (role: 'user')
            2. publish(userId, [userMsg])            ← admin sees it instantly
            3. Load 20-msg history from DB
            4. runAgentLoop (Gemini):
               a. publish status "Thinking..."       ← client shows animated dots
               b. Gemini returns functionCall(s)
               c. publish status "Checking recent progress..."
               d. DB queries run in parallel
               e. Tool results sent back to Gemini
               f. Gemini returns text reply
            5. INSERT CoachChatMessage (role: 'model')
            6. publish(userId, [modelMsg])            ← long-poll delivers to mobile
            7. res.json({ reply })                   ← client ignores this

Mobile long-poll loop (running in parallel):
  GET /api/coach/events?since=T
    └─ Server holds up to 25s
    └─ chatBus.publish() wakes it at steps 2 and 6
    └─ Client appends messages to state, re-renders FlatList
    └─ Client immediately re-enters loop
```

---

## Admin Portal Integration

Admin routes in `server/routes/admin.cjs` share the same `chatBus` and `agentBus`.

| Route | Purpose |
|---|---|
| `GET /api/admin/coach/chats` | List all users with chat history |
| `GET /api/admin/coach/chats/:userId` | Full message history for a user |
| `GET /api/admin/coach/events/:userId?since=` | Admin long-poll for a specific user |
| `POST /api/admin/coach/chats/:userId/reply` | Inject a `model` or `psychologist` message; published via `chatBus` — appears in mobile within one poll cycle |
| `POST /api/admin/coach/chats/:userId/stop` | Abort the in-flight Gemini/Claude request via `agentBus.abort(userId)` |
| `GET /api/admin/coach/users?q=` | Paginated user search with chat count |
| `GET /api/admin/coach/psychologist-requests` | Open "Talk to a Psychologist" support tickets |
| `POST /api/admin/coach/psychologist-requests/:id/dismiss` | Mark a request resolved |

---

## Design Decisions and Trade-offs

**Long-polling instead of WebSockets/SSE**
Avoids connection state complexity on both client and server. Trade-off: `chatBus` is in-process memory — it does not work across multiple server instances without a shared broker (e.g. Redis pub/sub).

**Messages delivered via poll, not HTTP response**
The `POST /api/coach/chat` response body is intentionally ignored by the client. Both the user's own message and the AI reply arrive through the long-poll channel, providing a single consistent update path (including for admin-injected messages).

**Gemini → retry → Claude fallback chain**
Failures are silent to the user. Each attempt is logged via `logLLMCall` with structured JSON. An email alert is sent only on total failure of both providers.

**Status hints are not persisted**
`type: 'status'` pseudo-messages are published to the bus but never written to the DB. They appear only in the active session's typing indicator and are gone on reload.

**Admin abort via `agentBus`**
Each userId maps to one `AbortController`. An admin can kill a stuck or runaway LLM agent call from the portal in real time.
