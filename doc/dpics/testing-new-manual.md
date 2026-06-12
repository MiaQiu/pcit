# Testing DPICS with a New Manual

When evaluating a different version of the DPICS manual, use the two scripts below to copy a real prod session into dev and run coding against the new PDF without touching production data.

---

## Scripts

| Script | Purpose |
|---|---|
| `scripts/_tmp_copy_session_to_dev.cjs` | Pull a prod session + utterances into the dev database |
| `scripts/_tmp_dpics_new_manual.cjs` | Re-run DPICS coding with a new manual PDF; persist the Gemini cache across runs |

---

## Step 1 — Copy Prod Session to Dev

Requires the prod DB tunnel to be running on `localhost:5433`.

```bash
PROD_DATABASE_URL="postgresql://nora_admin:<pw>@localhost:5433/nora" \
  node scripts/_tmp_copy_session_to_dev.cjs
```

**What it does:**
- Fetches the target session + all utterances from prod (speaker roles are preserved — role identification is already complete)
- Creates a stub `User` row in dev under the same `userId` if it doesn't already exist
- Upserts the session into dev with `pcitCodingDone = false` so the test script starts fresh
- Replaces any existing utterances for that session ID in dev

**What it does NOT do:**
- Modify prod in any way
- Copy subscription data, child profiling, milestone records, etc. — only session + utterances

The target session ID is hardcoded at the top of the script (`PROD_SESSION_ID`). Change it there to test a different session.

---

## Step 2 — Run Coding with the New Manual

```bash
# Dry-run: prints results, writes nothing to DB
node scripts/_tmp_dpics_new_manual.cjs

# Persist results to dev DB
node scripts/_tmp_dpics_new_manual.cjs --write
```

The new manual path is hardcoded at the top of the script (`NEW_MANUAL`). Change it there to point to a different PDF.

---

## Cache Behaviour

The script persists Gemini context cache state to `scripts/.dpics-newmanual-cache.json` so the PDF is uploaded and the cache is created only once per day.

```
First run:
  Upload PDF → Files API           (billed once)
  POST /cachedContents (24 h TTL)  (billed once)
  Save cache name + expiry to .dpics-newmanual-cache.json

Subsequent runs today:
  Read .dpics-newmanual-cache.json
  Send cachedContent: <name> with each coding request
  (no re-upload, no re-creation)
```

The cache file is `.gitignore`'d. After 24 hours it expires and the next run recreates it automatically.

This is separate from the production cache (`dpics-cdi` / `dpics-pdi`) which uses a different variant key and in-memory registry. The test cache does not affect production.

---

## Output

Each run prints:

```
── Code distribution ─────────────────────────────
  LP2    14
  BD     11
  RF      9
  Q       6
  ...

── Tag summary ───────────────────────────────────
  Labeled Praise (goal 10+): 18  [LP1:3 LP2:9 LP3:4 LP4:2]
  Echo/Reflection (goal 10+): 9
  Narration (goal 10+):       11
  Questions (reduce):         6
  Commands (reduce/target):   3  [DC:1 IC:2]
  Criticism (eliminate):      0
  References cited: 42/43 | Assumptions flagged: 3

── Sample results (first 8) ──────────────────────
  [  0] LP2    "Great job putting that piece in!"
         ref: p.34 — Labeled Praise requires specific label describing behavior
         feedback: Specific praise — you named the exact action. Keep it up!
  ...
```

The `reference` field cites the page number and rule from the new manual that justifies each code. The `assumption` field flags any utterance where the coding required an interpretation call. Both fields are useful for evaluating whether the new manual's rules produce different or better results than the current one.

---

## Comparing Results

After a `--write` run, the dev session's utterances have the new codes applied. To compare against the original prod codes:

1. Run the copy script again to reset to prod codes
2. Run the test script in dry-run mode (no `--write`) and inspect the distribution diff manually

Or: before writing, capture the existing dev codes from the DB and diff the two `codingResults` arrays.

---

## Resetting the Dev Session

To reset the dev session back to a clean copy of prod:

```bash
PROD_DATABASE_URL="postgresql://nora_admin:<pw>@localhost:5433/nora" \
  node scripts/_tmp_copy_session_to_dev.cjs
```

Re-running the copy script replaces utterances and resets `pcitCodingDone = false`.
