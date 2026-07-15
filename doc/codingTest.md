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

## Second batch (`session2`, seeded 2026-07-09)

Six more gold-standard sessions from a separate sample batch (`pcit samples 2`), three
of which are father-child (案父) rather than mother-child (案母) like the original six.
Seeded under a distinct `session2-*` label prefix so the original `session-1..6` entries
in `eval-results/dpics/sessions.json` weren't overwritten.

| Label | Session ID | Source file | Adult utterances | Coded |
|---|---|---|---|---|
| session2-1 | `cd61a37c-7c09-479a-9de8-1fcd797da587` | `1.json` (Pretreatment CLP, 案父) | 73 | 70 |
| session2-2 | `982a4030-0b63-41c0-b804-bb24c88b7124` | `2.json` (Pretreatment PLP, 案父) | 99 | 98 |
| session2-3 | `fab1ff13-08ce-4fa5-84c5-0167cfd26ba8` | `3.json` (Pretreatment CU, 案父) | 98 | 96 |
| session2-4 | `5c096f66-415c-4e81-ac3b-2a0be7e2fefd` | `4.json` (CDI Session 5) | 69 | 65 |
| session2-5 | `ec3cd220-ff09-436e-b8c5-e946fdf99d4d` | `5.json` (CDI Session 7) | 96 | 89 |
| session2-6 | `39a52134-a243-4347-ad00-0757a8e9f668` | `6.json` (CDI Session 5) | 85 | 83 |

Source fixtures: `server/scripts/cdi sessions 2/` (docx) and
`server/scripts/cdi sessions 2/json/` (parsed JSON). Unlike the first batch, these JSONs
were parsed straight from the docx dialogue table by a script (not hand-split into
`text`/`visual_observation`/`comment`), then run through
`dpics-extract-verbalization.cjs` (now generalized to accept a directory and file list
as CLI args, defaulting to the original `cdi sessions/json` + `4.json,5.json` behavior)
to populate the `verbalization` field for all 6 files.

Re-seed with:

```bash
node server/scripts/dpics-eval-seed.cjs "server/scripts/cdi sessions 2/json" --label-prefix session2
```
