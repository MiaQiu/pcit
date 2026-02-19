# Field Audit: AI Call → DB → API → Mobile App

Traces every field from AI output through database storage to client display.

---

## Call 1: Role Identification

| AI Output Field | DB Storage | API Response | Mobile App |
|---|---|---|---|
| speaker_identification | Session.roleIdentificationJson | Not returned | Not used |
| confidence, utterance_count | Session.roleIdentificationJson | Not returned | Not used |

**Status:** Internal only — no waste.

---

## Call 2: PCIT Coding

| AI Output Field | DB Storage | API Response | Mobile App |
|---|---|---|---|
| code | Utterance.pcitTag, Utterance.noraTag | transcript[i].tag | USED (transcript view) |
| feedback | Utterance.feedback | transcript[i].feedback | USED (tips) |
| full response | Session.pcitCoding | pcitCoding (full object) | **NEVER DISPLAYED** |
| (aggregated) | Session.tagCounts | skills[], areasToAvoid[] | USED (progress bars) |

**Dead:** `Session.pcitCoding` — full AI response stored and returned but never used by client. Only `tagCounts` matters.

---

## Call 3: Combined Feedback

| AI Output Field | DB Storage | API Response | Mobile App |
|---|---|---|---|
| topMoment.quote | competencyAnalysis.topMoment | topMoment | USED |
| topMoment.utteranceNumber | competencyAnalysis.topMomentUtteranceNumber | topMomentUtteranceNumber + start/end times | USED (audio playback) |
| Feedback | competencyAnalysis.feedback | feedback | USED (header) |
| activity | competencyAnalysis.activity | activity | USED (weekly report) |
| **ChildReaction** | **competencyAnalysis.childReaction** | **childReaction** | **DEAD — commented out** |
| **reminder** | **competencyAnalysis.reminder** | **reminder** | **DEAD — commented out** |
| exampleUtteranceNumber | competencyAnalysis.example | exampleIndex | USED (ReportScreen.tsx:758 — example utterance display) |
| (hardcoded null) | **competencyAnalysis.tips** | **tips** | **DEAD — always null** |

**Dead fields:** childReaction, reminder, tips — stored and returned but never displayed. `exampleUtteranceNumber` is actively used.

---

## Call 4: Review Feedback

| AI Output Field | DB Storage | API Response | Mobile App |
|---|---|---|---|
| feedback | Utterance.revisedFeedback | transcript[i].revisedFeedback | USED (TranscriptScreen.tsx:382 — preferred over original feedback) |
| additional_tip | Utterance.additionalTip | transcript[i].additionalTip | USED (TranscriptScreen.tsx:420 — shown as tip with lightbulb icon) |

**Status:** Fully used. `revisedFeedback` is the preferred feedback source (`segment.revisedFeedback || segment.feedback`), and `additionalTip` is displayed for desirable skills.

---

## Call 5: Developmental Profiling

| AI Output Field | DB Storage | API Response | Mobile App |
|---|---|---|---|
| developmental_observation.summary | ChildProfiling.summary | developmentalObservation.summary | **NOT DISPLAYED** |
| developmental_observation.domains | ChildProfiling.domains | developmentalObservation.domains | **NOT DISPLAYED** |
| session_metadata | ChildProfiling.metadata | (not returned) | Not used |
| (transformed) | — | aboutChild | **DEAD — backward compat, never referenced** |

**Status:** Data feeds into milestone detection (useful internally) but is never displayed to the user. The `aboutChild` backward-compat transform is dead code.

---

## Call 6: CDI Coaching (Gemini Pro + Format)

| AI Output Field | DB Storage | API Response | Mobile App |
|---|---|---|---|
| coachingSummary (raw report) | Session.coachingSummary | coachingSummary | USED (legacy fallback) |
| sections[] | Session.coachingCards.sections | coachingCards | USED (Coach's Corner) |
| tomorrowGoal | Session.coachingCards.tomorrowGoal | (inside coachingCards) | USED |
| (transformed) | — | childPortfolioInsights | **DEAD — backward compat, never referenced** |

**Dead:** `childPortfolioInsights` backward-compat transform.

---

## Call 7: PDI Two Choices Flow

| AI Output Field | DB Storage | API Response | Mobile App |
|---|---|---|---|
| pdiSkills[] | competencyAnalysis.pdiSkills | pdiSkills | **PARTIAL — skill names shown, details commented out** |
| commandSequences[] | competencyAnalysis.pdiCommandSequences | pdiCommandSequences | USED |
| tomorrowGoal | competencyAnalysis.pdiTomorrowGoal | pdiTomorrowGoal | USED |
| encouragement | competencyAnalysis.pdiEncouragement | pdiEncouragement | USED |
| summary | competencyAnalysis.pdiSummary | pdiSummary | USED |

**Partial:** `pdiSkills` performance/feedback details are returned but the UI code to render them is commented out.

---

## Call 8: Milestone Detection

| AI Output Field | DB Storage | API Response | Mobile App |
|---|---|---|---|
| detected_milestones | ChildMilestone records | milestoneCelebrations | USED |
| baseline_achieved | ChildMilestone records | milestoneCelebrations | USED |

**Status:** Fully used, no waste.

---

## Summary: Dead Data

### Never displayed (wasting output tokens in prompt):
| Field | Source Call | Est. Tokens |
|---|---|---|
| childReaction | Combined Feedback | ~50 |
| reminder | Combined Feedback | ~40 |
| tips | (hardcoded null) | 0 |

### Stored in DB but never shown to user:
| Data | DB Location | Notes |
|---|---|---|
| Full pcitCoding response | Session.pcitCoding | Only tagCounts used |
| Developmental domains | ChildProfiling.domains | Feeds milestones only, not displayed |
| aboutChild transform | (computed at API time) | Dead backward-compat code |
| childPortfolioInsights transform | (computed at API time) | Dead backward-compat code |

### Decisions needed:
- **childReaction / reminder** — Intentionally removed from UI or just unimplemented? If removed, strip from the Combined Feedback prompt to save tokens.
- **Developmental profiling** — Only feeds milestone detection. If milestone detection works without it, this call could be removed too.
- **pdiSkills detail rendering** — The commented-out UI code for skill badges: implement or remove?
