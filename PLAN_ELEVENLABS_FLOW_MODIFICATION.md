# Plan: Modify ElevenLabs Processing Flow

## Current Flow
```
ElevenLabs Output
  ↓
Parse & Group Utterances (in-memory, word-grouping)
  ↓
Store Transcript in DB (aiFeedbackJSON field)
  ↓
PCIT Analysis
```

## New Flow
```
ElevenLabs Output
  ↓
Store Raw JSON in DB (new: elevenLabsJson field)
  ↓
Parse & Group Utterances (sentence-grouping like process-transcript-for-llm.cjs)
  ↓
Store Formatted Transcript in DB (transcript field)
  ↓
PCIT Analysis (uses stored transcript)
```

---

## Step 1: Database Schema Changes

### Add New Field to Session Table

**File**: `prisma/schema.prisma`

**Change**:
```prisma
model Session {
  // ... existing fields ...

  transcript         String?  @db.Text
  aiFeedbackJSON     Json?    // Keep for backward compatibility

  // NEW FIELD: Store raw ElevenLabs response
  elevenLabsJson     Json?    // Raw ElevenLabs API response

  // ... rest of fields ...
}
```

**Migration**:
```bash
npx prisma migrate dev --name add_elevenlabs_json_field
```

---

## Step 2: Create Utility Function for Parsing

### Extract Parsing Logic from process-transcript-for-llm.cjs

**File**: `server/utils/parseElevenLabsTranscript.cjs` (NEW)

**Purpose**: Reusable function to parse ElevenLabs JSON into formatted utterances

**Function Signature**:
```javascript
/**
 * Parse ElevenLabs JSON response into structured utterances
 * Groups words by speaker and sentence boundaries
 *
 * @param {Object} elevenLabsJson - Raw ElevenLabs API response
 * @returns {Array} utterances - Array of {speaker, text, start, end, duration}
 */
function parseElevenLabsTranscript(elevenLabsJson) {
  // Logic from process-transcript-for-llm.cjs
  // Returns: [{ speaker, text, start, end, duration }, ...]
}
```

**Logic**:
1. Extract words array from JSON
2. Skip spacing tokens
3. Group by speaker changes
4. Split on sentence punctuation (。！？.!?)
5. Return structured utterances

---

## Step 3: Modify Recording Upload Flow

### Update transcribeRecording() Function

**File**: `server/routes/recordings.cjs`

**Location**: Lines 27-215 (transcribeRecording function)

**Changes**:

#### 3a. After ElevenLabs API Call (Line ~117)
```javascript
// BEFORE: Parse immediately
// AFTER: Store raw JSON first

const result = await elevenLabsResponse.json();

// STEP 1: Store raw ElevenLabs JSON in database
await prisma.session.update({
  where: { id: sessionId },
  data: {
    elevenLabsJson: result  // Store raw response
  }
});

console.log(`Raw ElevenLabs JSON stored for session ${sessionId}`);
```

#### 3b. Parse Using New Utility (Line ~128)
```javascript
// BEFORE: Manual word grouping logic
// AFTER: Use utility function

const { parseElevenLabsTranscript } = require('../utils/parseElevenLabsTranscript.cjs');

// STEP 2: Parse JSON into utterances
const utterances = parseElevenLabsTranscript(result);

console.log(`Parsed ${utterances.length} utterances from ElevenLabs response`);
```

#### 3c. Format Transcript for Storage (Line ~162)
```javascript
// BEFORE: Store in aiFeedbackJSON
// AFTER: Store in transcript field with structured format

// STEP 3: Format transcript for storage
let transcriptFormatted = '';
utterances.forEach((utt, idx) => {
  const timeRange = `${utt.start.toFixed(2)}-${utt.end.toFixed(2)}s`;
  transcriptFormatted += `[${String(idx + 1).padStart(2, '0')}] ${utt.speaker} | ${timeRange} | ${utt.text}\n`;
});

// Store formatted transcript
await prisma.session.update({
  where: { id: sessionId },
  data: {
    transcript: transcriptFormatted,
    // Keep aiFeedbackJSON for backward compatibility with segments
    aiFeedbackJSON: {
      utterances,  // Structured data for PCIT analysis
      transcribedAt: new Date().toISOString(),
      service: 'elevenlabs'
    }
  }
});

console.log(`Formatted transcript stored for session ${sessionId}`);
```

---

## Step 4: Update PCIT Analysis Function

### Modify analyzePCITCoding() to Use New Format

**File**: `server/routes/recordings.cjs`

**Location**: Lines 340-356 (analyzePCITCoding function start)

**Change**:
```javascript
// BEFORE: Receives transcriptSegments as parameter
async function analyzePCITCoding(sessionId, userId, transcriptSegments) {

// AFTER: Retrieve from database
async function analyzePCITCoding(sessionId, userId) {
  // Get session with stored utterances
  const session = await prisma.session.findUnique({
    where: { id: sessionId }
  });

  // Extract utterances from aiFeedbackJSON
  const utterances = session.aiFeedbackJSON?.utterances || [];

  // Format for PCIT analysis
  const formattedTranscript = utterances.map(utt => ({
    speaker: parseInt(utt.speaker.replace('speaker_', '')),
    text: utt.text
  }));

  // ... rest of function
}
```

---

## Step 5: Update Function Calls

### Update All Calls to analyzePCITCoding()

**File**: `server/routes/recordings.cjs`

**Locations**:
1. Line ~203 (after transcribeRecording)
2. Any other places calling this function

**Change**:
```javascript
// BEFORE:
analyzePCITCoding(sessionId, userId, transcriptSegments)

// AFTER:
analyzePCITCoding(sessionId, userId)
```

---

## Step 6: Update Web/Mobile Frontend (Optional)

### If Frontend Displays Transcript

**Files**:
- `nora-web/src/services/transcriptionService.js`
- `packages/nora-core/src/services/transcriptionService.ts`

**Change**:
- Frontend can continue using existing API endpoints
- Backend now returns parsed utterances in consistent format
- No breaking changes needed if API contract stays same

---

## Testing Plan

### 1. Unit Tests

**File**: `server/utils/parseElevenLabsTranscript.test.cjs` (NEW)

Test cases:
- ✓ Parse single speaker transcript
- ✓ Parse multi-speaker transcript
- ✓ Handle sentence boundaries correctly
- ✓ Handle speaker changes mid-sentence
- ✓ Handle empty or invalid JSON

### 2. Integration Tests

**Test recording upload flow**:
```bash
# Upload test audio file
POST /api/recordings/upload

# Verify database state:
1. elevenLabsJson is populated
2. transcript is formatted correctly
3. aiFeedbackJSON.utterances exists
4. PCIT analysis completes successfully
```

### 3. Manual Testing

**Test with existing audio file**:
```bash
node test-elevenlabs-config1.cjs
# Then check database for proper storage
```

---

## Migration Strategy

### Phase 1: Add New Field (Non-Breaking)
1. Add `elevenLabsJson` field to schema
2. Run migration
3. Keep existing code working

### Phase 2: Implement New Parsing (Backward Compatible)
1. Create `parseElevenLabsTranscript.cjs` utility
2. Update `transcribeRecording()` to use new parsing
3. Store in both old and new formats temporarily

### Phase 3: Update PCIT Analysis
1. Modify `analyzePCITCoding()` to read from new format
2. Test with old and new sessions

### Phase 4: Cleanup (Optional)
1. Remove old parsing logic
2. Deprecate `aiFeedbackJSON.transcriptSegments` (keep utterances)

---

## Rollback Plan

If issues occur:
1. Keep old code path available via feature flag
2. Database has both formats, can revert logic
3. No data loss - raw JSON always preserved

---

## Files to Modify

### New Files:
1. `server/utils/parseElevenLabsTranscript.cjs` - Parsing utility
2. `server/utils/parseElevenLabsTranscript.test.cjs` - Tests
3. `prisma/migrations/xxx_add_elevenlabs_json_field/` - Migration

### Modified Files:
1. `prisma/schema.prisma` - Add elevenLabsJson field
2. `server/routes/recordings.cjs` - Update transcribeRecording() and analyzePCITCoding()

### Potentially Modified:
3. `server/routes/transcription-proxy.cjs` - If web flow needs updates
4. Frontend services - If API contract changes

---

## Estimated Effort

- **Database Schema**: 30 min (migration + testing)
- **Parsing Utility**: 1 hour (extract + refactor + test)
- **Update Recording Flow**: 1.5 hours (modify + test)
- **Update PCIT Analysis**: 1 hour (modify + test)
- **End-to-End Testing**: 1 hour
- **Documentation**: 30 min

**Total**: ~5-6 hours

---

## Benefits

1. **Data Preservation**: Raw ElevenLabs JSON preserved for debugging/reprocessing
2. **Consistency**: Same parsing logic everywhere
3. **Flexibility**: Can reprocess transcripts without calling ElevenLabs again
4. **Debugging**: Easier to trace issues with raw data stored
5. **Cost Savings**: Can re-parse without re-transcribing

---

## Next Steps

1. Review and approve this plan
2. Create feature branch: `feature/elevenlabs-flow-refactor`
3. Implement Step 1 (Database Schema)
4. Implement Step 2 (Parsing Utility)
5. Implement Step 3 (Recording Flow)
6. Test thoroughly
7. Deploy to staging
8. Monitor and verify
9. Deploy to production
