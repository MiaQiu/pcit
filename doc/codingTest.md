# DPICS Coding Accuracy Test — Fixtures

Gold-standard CDI sessions seeded into the **dev** database (`nora_dev`) for testing
DPICS coding accuracy across different LLM models and prompt versions.

## Eval User

| Field | Value |
|---|---|
| User ID | `186e0b96-7d74-4d46-bb12-0579e03f3133` |
| Email | `dpics-eval@internal.test` |
| Tag | `eval` |

## Sessions

Ground-truth DPICS codes are stored in `Utterance.adminComment` (not `pcitTag`/`noraTag`,
which get overwritten every time the coding pipeline runs). `Utterance.role` is
pre-seeded from the source transcripts, so role identification is skipped — coding
accuracy is the only variable under test.

| Label | Session ID | Source file | Adult utterances | Coded |
|---|---|---|---|---|
| session-1 | `3304aa2a-cb0f-4954-b7fd-fd81f925317d` | `1.json` | 79 | 79 |
| session-2 | `07796393-52ae-425f-8cec-943b92591cd0` | `2.json` | 109 | 109 |
| session-3 | `e902214d-5e03-4261-a293-1e4e639f7339` | `3.json` | 101 | 101 |
| session-4 | `6a958b8d-e520-4bd3-8989-1857d278f241` | `4.json` | 46 | 46 |
| session-5 | `6b1ae428-b20a-401a-8017-d3b91d043aa2` | `5.json` | 51 | 51 |
| session-6 | `4d405557-84da-4df1-ab40-448b6b089898` | `6.json` | 66 | 66 |

Re-seeded 2026-06-18 after adding explicit `NC` (No Code — non-verbal/uncodeable)
ground truth for 23 adult utterances that previously had no code at all (incomplete
sentences, interrupted speech, pure sound effects). All adult utterances are now
coded — previously several were silently excluded from scoring because their ground
truth was `null`. Old session IDs from before this re-seed are no longer valid;
historical eval results in `eval-results/dpics/` that reference them are still valid
as self-contained records (they embed ground truth + predictions directly) but won't
resolve against the live DB anymore.

Note: only `dpicsCoding-v3.txt` explicitly lists `NC` as a valid output code. The
original `dpicsCoding.txt` and `dpicsCoding-v2.txt` never mention it, so re-running
those baselines may show new `NC`-related mismatches unrelated to prompt quality.

All sessions are `mode: CDI`. Label → session ID mapping is also kept machine-readable
at `eval-results/dpics/sessions.json`.

## Source fixtures

- Original gold-standard transcripts (Word docs, human DPICS-IV coded): `server/scripts/cdi sessions/`
- Parsed JSON fixtures fed into the seed script: `server/scripts/cdi sessions/json/`
- Seed script: `server/scripts/dpics-eval-seed.cjs`

## Re-seeding

```bash
node server/scripts/dpics-eval-seed.cjs "server/scripts/cdi sessions/json"
```

Re-running reuses the existing eval user (matched by email hash) and creates fresh
Session/Utterance rows each time (sessions are not deduped by label — re-seeding
will create duplicates unless old sessions are deleted first).
