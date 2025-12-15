# PRIDE to PEN Skills Migration Plan

## Overview
Changing from **PRIDE** skills to **PEN** skills:

### Skill Mapping:
| Old (PRIDE) | New (PEN) | Change Type |
|-------------|-----------|-------------|
| **P**raise | **P**raise | ✅ Keep (no change) |
| **R**eflecting | **E**cho | 🔄 Rename |
| **I**mitating | ❌ Removed | 🗑️ Delete |
| **D**escribing | **N**arration | 🔄 Rename |
| **E**njoyment | ❌ Removed | 🗑️ Delete |

---

## 🗄️ DATABASE CHANGES

### 1. Session Table - `tagCounts` JSON field
**Current Structure:**
```json
{
  "praise": 10,
  "reflect": 8,
  "describe": 12,
  "imitate": 5,
  "question": 3,
  "command": 2,
  "criticism": 1,
  "negative_phrases": 0,
  "neutral": 4,
  "totalPride": 35,
  "totalAvoid": 6
}
```

**New Structure:**
```json
{
  "praise": 10,
  "echo": 8,          // was "reflect"
  "narration": 12,    // was "describe"
  "question": 3,
  "command": 2,
  "criticism": 1,
  "negative_phrases": 0,
  "neutral": 4,
  "totalPen": 30,     // was "totalPride" (praise + echo + narration)
  "totalAvoid": 6
}
```

**Migration needed:**
- Create database migration script to rename fields in existing sessions
- Update all `tagCounts` JSON objects

---

## 📝 BACKEND CHANGES

### 2. `server/routes/pcit-proxy.cjs`

#### Lines to Update:

**Line 104-112:** CDI Coding Rules
```javascript
// OLD:
**PCIT Coding Rules:**
[DO: Praise] - Labeled or unlabeled praise
[DO: Reflect] - Repeating or paraphrasing
[DO: Describe] - Describing child's behavior
[DO: Imitate] - Imitating child's play action

// NEW:
**PCIT Coding Rules (PEN Skills):**
[DO: Praise] - Labeled or unlabeled praise
[DO: Echo] - Repeating or paraphrasing child's words
[DO: Narration] - Narrating child's ongoing behavior
```

**Line 222-254:** Competency Analysis Prompt
```javascript
// OLD:
- Labeled Praises: ${counts.praise}
- Reflections: ${counts.reflect}
- Behavioral Descriptions: ${counts.describe}
- Imitations: ${counts.imitate}

**2. Analysis Instructions:**
...
**3. PRIDE Skills Assessment:**
- Total DO skills (PRIDE): ${totalDos}

**Mastery Criteria (for CDI completion):**
- 10+ Praises per 5 minutes
- 10+ Reflections per 5 minutes
- 10+ Behavioral Descriptions per 5 minutes

// NEW:
- Labeled Praises: ${counts.praise}
- Echo (Reflections): ${counts.echo}
- Narration (Behavioral Descriptions): ${counts.narration}

**2. Analysis Instructions:**
...
**3. PEN Skills Assessment:**
- Total DO skills (PEN): ${totalDos}

**Mastery Criteria (for CDI completion):**
- 10+ Praises per 5 minutes
- 10+ Echo per 5 minutes
- 10+ Narration per 5 minutes
```

**Validation Changes (Line 197-202):**
```javascript
// OLD:
const requiredFields = ['praise', 'reflect', 'describe', 'imitate', 'question', 'command', 'criticism', 'negative_phrases', 'neutral'];

// NEW:
const requiredFields = ['praise', 'echo', 'narration', 'question', 'command', 'criticism', 'negative_phrases', 'neutral'];
```

**Total Calculation (Line 216-217):**
```javascript
// OLD:
const totalDos = counts.praise + counts.reflect + counts.describe + counts.imitate;

// NEW:
const totalDos = counts.praise + counts.echo + counts.narration;
```

---

### 3. `server.cjs` (Deprecated Endpoints)

**Line 257:** Update PRIDE reference
```javascript
// OLD:
Look for Parent "PRIDE" Skills:

// NEW:
Look for Parent "PEN" Skills:
```

**Line 282:** Update skill list
```javascript
// OLD:
"Natural" conversation fillers... that do not fit the PRIDE skills

// NEW:
"Natural" conversation fillers... that do not fit the PEN skills
```

---

### 4. `scripts/seed-mock-data.cjs`

**Line 78:**
```javascript
// OLD:
totalPride: praise + reflect + imitate + describe,

// NEW:
totalPen: praise + echo + narration,
```

---

## 🎨 FRONTEND CHANGES

### 5. `src/services/pcitService.js`

**Function: `validateCounts` (Lines 32-43)**
```javascript
// OLD:
const requiredFields = ['praise', 'reflect', 'describe', 'imitate', 'question', 'command', 'criticism', 'negative_phrases', 'neutral'];

// NEW:
const requiredFields = ['praise', 'echo', 'narration', 'question', 'command', 'criticism', 'negative_phrases', 'neutral'];
```

**Function: `countPcitTags` (Lines 98-121)**
```javascript
// OLD:
const counts = {
  describe: (codingText.match(/\[DO:\s*Describe\]/gi) || []).length,
  reflect: (codingText.match(/\[DO:\s*Reflect\]/gi) || []).length,
  praise: (codingText.match(/\[DO:\s*Praise\]/gi) || []).length,
  imitate: (codingText.match(/\[DO:\s*Imitate\]/gi) || []).length,
  ...
};

counts.totalPride = counts.describe + counts.reflect + counts.praise + counts.imitate;

// NEW:
const counts = {
  narration: (codingText.match(/\[DO:\s*Narration\]/gi) || []).length,
  echo: (codingText.match(/\[DO:\s*Echo\]/gi) || []).length,
  praise: (codingText.match(/\[DO:\s*Praise\]/gi) || []).length,
  ...
};

counts.totalPen = counts.narration + counts.echo + counts.praise;
```

**Function: `checkCdiMastery` (Lines 220-238)**
```javascript
// OLD:
const criteria = {
  praise: { target: 10, met: counts.praise >= 10 },
  reflect: { target: 10, met: counts.reflect >= 10 },
  describe: { target: 10, met: counts.describe >= 10 },
  ...
};

const mastered = criteria.praise.met &&
                 criteria.reflect.met &&
                 criteria.describe.met &&
                 ...

// NEW:
const criteria = {
  praise: { target: 10, met: counts.praise >= 10 },
  echo: { target: 10, met: counts.echo >= 10 },
  narration: { target: 10, met: counts.narration >= 10 },
  ...
};

const mastered = criteria.praise.met &&
                 criteria.echo.met &&
                 criteria.narration.met &&
                 ...
```

---

### 6. `src/screens/HomeScreen.jsx`

**Learning Deck Content Updates:**

**Deck 2 - Card 2 (Lines 75-82):**
```javascript
// OLD:
title: "The 5 'Do's",
focus: "The PRIDE Skills",
content: "P.R.I.D.E. is the key to CDI. Use these skills during 'Special Time' and throughout the day.",
tip: "PRIDE = Praise, Reflect, Imitate, Describe, Enjoy"

// NEW:
title: "The 3 'Do's",
focus: "The PEN Skills",
content: "P.E.N. is the key to CDI. Use these skills during 'Special Time' and throughout the day.",
tip: "PEN = Praise, Echo, Narration"
```

**Deck 2 - Card 4 (Line 99):**
```javascript
// OLD:
tip: "Action: Focus on noticing and mentally naming one PRIDE skill your child displays today."

// NEW:
tip: "Action: Focus on noticing and mentally naming one PEN skill your child displays today."
```

**Deck 3-6:** Rename deck titles and content
- Deck 3: "Praise" ✅ (no change)
- Deck 4: "Reflecting" → "Echo"
- Deck 5: ~~"Imitating"~~ → **DELETE THIS DECK**
- Deck 6: "Describing" → "Narration"
- Deck 7: ~~"Enjoyment"~~ → **DELETE THIS DECK**

**After deletions, renumber all decks:**
- Decks 8-15 become Decks 6-13

**Deck titles to update:**
- Line 79: "The PRIDE Skills" → "The PEN Skills"
- Line 261: References to "PRIDE skill"
- Line 271: "Combine PRIDE skills" → "Combine PEN skills"
- Line 317: "filter it through a PRIDE skill" → "filter it through a PEN skill"
- Line 583: "Do you use PRIDE skills naturally" → "Do you use PEN skills naturally"

**CDI Progress Calculation (Lines 673-700):**
```javascript
// OLD:
const criteria = {
  praise: { current: tagCounts.praise || 0, target: 10 },
  reflect: { current: tagCounts.reflect || 0, target: 10 },
  describe: { current: tagCounts.describe || 0, target: 10 },
  avoid: { current: tagCounts.totalAvoid || 0, target: 3 }
};

const praiseProgress = ...
const reflectProgress = ...
const describeProgress = ...

const overallProgress = (praiseProgress + reflectProgress + describeProgress + avoidProgress) / 4;

// NEW:
const criteria = {
  praise: { current: tagCounts.praise || 0, target: 10 },
  echo: { current: tagCounts.echo || 0, target: 10 },
  narration: { current: tagCounts.narration || 0, target: 10 },
  avoid: { current: tagCounts.totalAvoid || 0, target: 3 }
};

const praiseProgress = ...
const echoProgress = ...
const narrationProgress = ...

const overallProgress = (praiseProgress + echoProgress + narrationProgress + avoidProgress) / 4;
```

**CDI Progress Display (Lines 1073-1137):**
```javascript
// OLD:
<span className="text-gray-600">Reflection</span>
<span className="font-medium">
  {cdiProgress.criteria.reflect.current}/{cdiProgress.criteria.reflect.target}
</span>

<span className="text-gray-600">Description</span>
<span className="font-medium">
  {cdiProgress.criteria.describe.current}/{cdiProgress.criteria.describe.target}
</span>

// NEW:
<span className="text-gray-600">Echo</span>
<span className="font-medium">
  {cdiProgress.criteria.echo.current}/{cdiProgress.criteria.echo.target}
</span>

<span className="text-gray-600">Narration</span>
<span className="font-medium">
  {cdiProgress.criteria.narration.current}/{cdiProgress.criteria.narration.target}
</span>
```

---

### 7. `src/screens/RecordingScreen.jsx`

**Mock Data (Lines 115-120):**
```javascript
// OLD:
totalPride: 6,
describe: 2,
reflect: 1,
imitate: 1,

// NEW:
totalPen: 3,
narration: 2,
echo: 1,
```

**CDI Analysis Comment (Line 229):**
```javascript
// OLD:
// CDI Mode: PRIDE skills analysis

// NEW:
// CDI Mode: PEN skills analysis
```

**Display Tags (Lines 918-950):**
```javascript
// OLD:
<h4>Pride Skills (DO)</h4>
...
<div>Reflect: {tagCounts.reflect}</div>
<div>Describe: {tagCounts.describe}</div>
<div>Imitate: {tagCounts.imitate}</div>
...
<span>Total "Pride" Skills</span>
<span>{tagCounts.totalPride}</span>

// NEW:
<h4>PEN Skills (DO)</h4>
...
<div>Echo: {tagCounts.echo}</div>
<div>Narration: {tagCounts.narration}</div>
...
<span>Total "PEN" Skills</span>
<span>{tagCounts.totalPen}</span>
```

---

### 8. `src/screens/ProgressScreen.jsx`

**Line 277:**
```javascript
// OLD:
DO Skills (PRIDE)

// NEW:
DO Skills (PEN)
```

**Skill Display:**
Update any display of individual skills to show Echo/Narration instead of Reflect/Describe/Imitate

---

### 9. `src/screens/LearnScreen.jsx`

Search for any PRIDE references and update deck navigation if needed.

---

## 📚 DOCUMENTATION CHANGES

### 10. `DATABASE_SCHEMA.md`

**Line 58:**
```markdown
<!-- OLD: -->
| `tagCounts` | Json | NOT NULL | Summary of tag counts (praise, reflect, etc.) |

<!-- NEW: -->
| `tagCounts` | Json | NOT NULL | Summary of tag counts (praise, echo, narration, etc.) |
```

### 11. `TESTING_PLAN.md`

Update all test cases that reference PRIDE skills

### 12. `pocket PCIT.txt`

Update training documentation:
- Line 12: "The PRIDE Skills" → "The PEN Skills"
- Line 64-93: Update all PRIDE references
- Line 100: Update skill mentions
- Line 165: Update mastery criteria

---

## 🔄 DATA MIGRATION SCRIPT

### Create: `scripts/migrate-pride-to-pen.cjs`

This script needs to:

1. **Update all existing session records:**
   ```javascript
   // For each session in database:
   - Rename tagCounts.reflect → tagCounts.echo
   - Rename tagCounts.describe → tagCounts.narration
   - Remove tagCounts.imitate
   - Recalculate tagCounts.totalPen = praise + echo + narration
   - Remove tagCounts.totalPride
   ```

2. **Backup before migration:**
   - Export all sessions to JSON backup file
   - Store in `/backups/pride-to-pen-migration-[timestamp].json`

3. **Update pcitCoding JSON:**
   - Replace all `[DO: Reflect]` → `[DO: Echo]`
   - Replace all `[DO: Describe]` → `[DO: Narration]`
   - Remove all `[DO: Imitate]` and `[DO: Enjoy]` references

---

## ✅ IMPLEMENTATION CHECKLIST

### Phase 1: Backend & Database (Do First)
- [ ] Create data migration script
- [ ] Backup existing database
- [ ] Run migration on tagCounts fields
- [ ] Update `server/routes/pcit-proxy.cjs`
- [ ] Update `server.cjs` deprecated endpoints
- [ ] Update `scripts/seed-mock-data.cjs`
- [ ] Test API endpoints return new field names

### Phase 2: Frontend Services
- [ ] Update `src/services/pcitService.js`
  - [ ] validateCounts function
  - [ ] countPcitTags function
  - [ ] checkCdiMastery function

### Phase 3: Frontend Screens
- [ ] Update `src/screens/HomeScreen.jsx`
  - [ ] Learning deck content (remove Imitate/Enjoy decks)
  - [ ] Renumber decks 8-15 → 6-13
  - [ ] Update all PRIDE → PEN references
  - [ ] Update progress calculation
  - [ ] Update progress display UI
- [ ] Update `src/screens/RecordingScreen.jsx`
  - [ ] Mock data
  - [ ] Tag display UI
  - [ ] Total calculation
- [ ] Update `src/screens/ProgressScreen.jsx`
  - [ ] Skill labels
  - [ ] Display components
- [ ] Check `src/screens/LearnScreen.jsx` for references

### Phase 4: Documentation
- [ ] Update `DATABASE_SCHEMA.md`
- [ ] Update `TESTING_PLAN.md`
- [ ] Update `pocket PCIT.txt`
- [ ] Update any README files

### Phase 5: Testing
- [ ] Test new session creation
- [ ] Test PCIT analysis with new tags
- [ ] Test mastery calculation
- [ ] Test progress display
- [ ] Test learning deck navigation
- [ ] Verify migrated sessions display correctly

---

## 🚨 RISKS & CONSIDERATIONS

1. **Existing Sessions:**
   - Old sessions have `reflect`, `describe`, `imitate` data
   - Migration must preserve data integrity
   - Consider keeping old field names as aliases temporarily

2. **Mastery Criteria:**
   - CDI mastery now requires only 3 skills instead of 5
   - May need to adjust target counts
   - Review if 10+ for each skill is still appropriate

3. **Total Score Calculation:**
   - `totalPride` was sum of 4 skills (P+R+I+D)
   - `totalPen` is sum of 3 skills (P+E+N)
   - Historical comparison may be affected

4. **Deck Renumbering:**
   - Deleting decks 5 (Imitate) and 7 (Enjoy) means:
   - User progress tracking needs migration
   - `currentDeck` and `unlockedDecks` may need adjustment
   - Learning progress database may need update

---

## 📊 ESTIMATED EFFORT

- **Backend Changes:** 2-3 hours
- **Frontend Changes:** 3-4 hours
- **Data Migration Script:** 2 hours
- **Testing:** 2-3 hours
- **Documentation:** 1 hour

**Total:** ~10-12 hours

---

## 🎯 MIGRATION ORDER

1. Create and test migration script (offline)
2. Backup production database
3. Run migration script on development database
4. Update all backend code
5. Update all frontend code
6. Test thoroughly in development
7. Deploy backend changes
8. Deploy frontend changes
9. Monitor for issues
10. Update documentation

---

**Created:** 2025-11-26
**Status:** Planning Phase
**Priority:** High
