/**
 * PCIT Analysis Service
 * Handles PCIT coding, feedback generation, and score calculation
 */
const prisma = require('./db.cjs');
const { parseJsonResponse } = require('./claudeService.cjs');
const { llmCall } = require('../llm/gateway.cjs');
const SCHEMAS = require('../llm/schemas/index.cjs');
const { getUtterances, updateUtteranceRoles, updateUtteranceTags, updateRevisedFeedback, SILENT_SPEAKER_ID } = require('../utils/utteranceUtils.cjs');
const { DPICS_TO_TAG_MAP, calculateNoraScore } = require('../utils/scoreConstants.cjs');
const { loadPrompt, loadPromptWithVariables } = require('../prompts/index.cjs');
const { getGoalDirective, tagCountsToSession, recordToProfile, computeMasteryUpdates } = require('../utils/goalDirective.cjs');
const { decryptSensitiveData } = require('../utils/encryption.cjs');
const { getLanguageInstruction } = require('../utils/languageUtils.cjs');
const { classifySpeakersML } = require('./mlDiarizationService.cjs');

// DPICS asset paths — referenced by gateway cache config for coding and review feedback
const DPICS_PDF_PATH      = process.env.DPICS_PDF_PATH      || require('path').join(__dirname, '../assets/DPICS-Manual.2.18.pdf');

// ============================================================================
// Session Quality Gate
// ============================================================================

/**
 * Thrown when a recording fails the quality gate.
 * Signals to callers that retries are pointless and no team alert is needed.
 */
class SessionQualityError extends Error {
  constructor(userMessage) {
    super(userMessage);
    this.name = 'SessionQualityError';
    this.userMessage = userMessage;
  }
}

/**
 * Thrown when a recording cannot be processed due to a permanent data problem.
 * Signals to callers that retries are pointless (unlike transient network errors).
 * Does NOT trigger a team Slack alert — these are data/config issues, not system bugs.
 */
class PermanentFailureError extends Error {
  constructor(message, userMessage) {
    super(message);
    this.name = 'PermanentFailureError';
    this.userMessage = userMessage || 'An error occurred while analyzing your recording. Please try again.';
  }
}

/**
 * Validate that a session is suitable for PCIT analysis.
 * Runs cheap heuristics first, then one LLM call for everything else.
 * Throws SessionQualityError if the session should not be processed.
 */
async function validateSessionQuality(utterances, durationSeconds, roleIdentificationJson, sessionId = null) {
  const SILENT_ID = SILENT_SPEAKER_ID;
  const nonSilent = utterances.filter(u => u.speaker !== SILENT_ID);
  const speakerIds = new Set(nonSilent.map(u => u.speaker));

  // --- Heuristic pre-filters (no LLM cost) ---
  if (nonSilent.length < 10) {
    throw new SessionQualityError(
      'Your recording didn\'t capture enough speech to generate a report. This can happen if the recording started too late or the audio was too quiet. Try starting the recording before your play session begins and ensure the device is nearby.'
    );
  }

  if (durationSeconds < 60) {
    throw new SessionQualityError(
      'Your recording was too short to generate a report. A play session needs to be at least a few minutes long for a meaningful analysis. Try recording a longer session next time.'
    );
  }

  // --- LLM quality check ---
  const sample = nonSilent.slice(0, 60).map(u => ({
    speaker: u.speaker,
    text: u.text,
    start: u.startTime,
    end: u.endTime
  }));

  const prompt = loadPromptWithVariables('sessionQualityCheck', {
    DURATION_SECONDS: String(durationSeconds),
    UTTERANCE_COUNT: String(nonSilent.length),
    SPEAKER_COUNT: String(speakerIds.size),
    UTTERANCES_SAMPLE: JSON.stringify(sample, null, 2),
    ROLE_IDENTIFICATION: roleIdentificationJson ? JSON.stringify(roleIdentificationJson, null, 2) : 'Not available'
  });

  const result = await llmCall(prompt, {
    profile:  'quality-check',
    label:    'session-quality-check',
    sessionId,
  });

  if (result.valid === false) {
    throw new SessionQualityError(
      result.userMessage || 'Your recording could not be analyzed. Please try recording a play session with your child again.'
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate child's age from birth year or birthday
 * @param {number} birthYear - Child's birth year
 * @param {Date} birthday - Child's birthday (optional, more precise)
 * @returns {number} Child's age in years
 */
function calculateChildAge(birthYear, birthday) {
  const today = new Date();
  if (birthday) {
    const birthDate = new Date(birthday);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }
  return today.getFullYear() - birthYear;
}

/**
 * Calculate child's age in months from birthday
 * @param {Date} birthday - Child's birthday
 * @param {number} birthYear - Child's birth year (fallback)
 * @returns {number} Child's age in months
 */
function calculateChildAgeInMonths(birthday, birthYear) {
  const today = new Date();
  if (birthday) {
    const birthDate = new Date(birthday);
    const months = (today.getFullYear() - birthDate.getFullYear()) * 12 + (today.getMonth() - birthDate.getMonth());
    return months;
  }
  // Fallback: assume mid-year birth if only year is available
  return (today.getFullYear() - birthYear) * 12;
}

/**
 * Extract child speaker from role identification JSON
 * @param {Object} roleIdentificationJson - Role identification data
 * @returns {string|null} Speaker ID of the child, or null if not found
 */
function getChildSpeaker(roleIdentificationJson) {
  const speakerIdentification = roleIdentificationJson?.speaker_identification || {};
  for (const [speakerId, info] of Object.entries(speakerIdentification)) {
    if (info.role === 'CHILD') {
      return speakerId;
    }
  }
  return null;
}

/**
 * Format gender enum to readable text
 * @param {string} genderEnum - Gender enum value (BOY, GIRL, OTHER)
 * @returns {string} Readable gender text
 */
function formatGender(genderEnum) {
  const genderMap = {
    'BOY': 'boy',
    'GIRL': 'girl',
    'OTHER': 'child'
  };
  return genderMap[genderEnum] || 'child';
}

/**
 * Format utterances for prompt display
 * Handles silent slots specially to make them visible as coaching opportunities
 * @param {Array} utterances - Array of utterance objects
 * @returns {string} Formatted transcript string
 */
function formatUtterancesForPrompt(utterances) {
  return utterances.map((u, i) => {
    if (u.speaker === SILENT_SPEAKER_ID) {
      const duration = (u.endTime - u.startTime).toFixed(1);
      return `[${String(i).padStart(2, '0')}] ⏸️ SILENCE (${duration}s) - opportunity to narrate or praise`;
    }
    const roleLabel = u.role === 'adult' ? 'Parent' : u.role === 'child' ? 'Child' : u.speaker;
    const tagSuffix = u.pcitTag ? ` [${u.pcitTag}]` : '';
    return `[${String(i).padStart(2, '0')}] ${roleLabel}: ${u.text}${tagSuffix}`;
  }).join('\n');
}

// ============================================================================
// Performance vs Goal Section Builder
// ============================================================================

const METRIC_ALIASES = {
  praise:    ['praise', 'praises', 'labeled praise', 'labeled praises'],
  echo:      ['refl', 'reflection', 'reflections', 'echo'],
  narration: ['behav_desc', 'behavioral description', 'behavioral descriptions', 'narrate', 'narration'],
  question:  ['question', 'questions', 'ques'],
  command:   ['command', 'commands', 'cmd'],
  criticism: ['criticism', 'criticisms', 'crit'],
};
const METRIC_DISPLAY = {
  praise: 'Praises', echo: 'Refl', narration: 'Narrate',
  question: 'Ques', command: 'Cmd', criticism: 'Crit',
};

function parseGoalMeta(goalText) {
  if (!goalText) return null;
  const lower = goalText.toLowerCase();
  let metricKey = null;
  for (const [key, aliases] of Object.entries(METRIC_ALIASES)) {
    if (aliases.some(a => lower.includes(a))) { metricKey = key; break; }
  }
  const numMatch = goalText.match(/\b(\d+)\b/);
  const target = numMatch ? parseInt(numMatch[1], 10) : null;
  return metricKey && target ? { metricKey, target } : null;
}

function buildPerformanceVsGoalSection(historicalCdiSessions, currentTagCounts, yesterdayGoal) {
  const sessions = historicalCdiSessions || [];
  if (sessions.length === 0 && !yesterdayGoal) return 'No prior sessions.';

  const fmtDate = (d) => {
    const dt = new Date(d);
    return `${dt.toLocaleString('en-US', { month: 'short' })} ${dt.getDate()}`;
  };

  const lines = [];

  sessions.forEach((s, i) => {
    const tc = s.tagCounts || {};
    const prev = i > 0 ? sessions[i - 1] : null;
    const goalText = s.sessionGoal || prev?.tomorrowGoal || null;
    const meta = parseGoalMeta(goalText);
    const prevTc = prev?.tagCounts || {};

    const goalPart = meta
      ? `Goal: ${METRIC_DISPLAY[meta.metricKey]} (${meta.target})`
      : goalText ? `Goal: ${goalText.substring(0, 35)}` : 'Goal: -';
    const actualPart = meta
      ? ` | actual ${prevTc[meta.metricKey] ?? '-'} -> ${tc[meta.metricKey] ?? 0}`
      : '';

    lines.push(`[${fmtDate(s.createdAt)}, S${i + 1}] ${goalPart}${actualPart}`);
  });

  // Current session row
  const lastTc = sessions[sessions.length - 1]?.tagCounts || {};
  const meta = parseGoalMeta(yesterdayGoal);
  const goalPart = meta
    ? `Goal: ${METRIC_DISPLAY[meta.metricKey]} (${meta.target})`
    : yesterdayGoal ? `Goal: ${yesterdayGoal.substring(0, 35)}` : 'Goal: -';
  const actualPart = meta
    ? ` | actual ${lastTc[meta.metricKey] ?? '-'} -> ${currentTagCounts[meta.metricKey] ?? 0}`
    : '';
  lines.push(`[Today] ${goalPart}${actualPart}`);

  return lines.join('\n');
}

// ============================================================================
// Quality-Gate Retry Helper
// ============================================================================

/**
 * Run callFn up to twice; if output fails isComplete, escalate to escalateFn.
 * Returns the first complete result, or null if all attempts fail/are incomplete.
 * Throws only if callFn throws on the first attempt — caller wraps in try/catch.
 */
async function withQualityRetry(callFn, isComplete, escalateFn) {
  let result = await callFn();
  if (isComplete(result)) return result;
  result = await callFn();
  if (isComplete(result)) return result;
  try {
    const escalated = await escalateFn();
    if (isComplete(escalated)) return escalated;
  } catch (_) {}
  return null;
}

// ============================================================================
// Child Profiling — Developmental + Coaching
// ============================================================================

/**
 * Format utterances for psychologist review
 * @param {Array} utterances - Array of utterance objects with roles
 * @returns {string} Formatted transcript for psychologist
 */
function formatUtterancesForPsychologist(utterances) {
  return utterances
    .filter(u => u.speaker !== SILENT_SPEAKER_ID)
    .map((u, i) => {
      const roleLabel = u.role === 'adult' ? 'Parent' : u.role === 'child' ? 'Child' : u.speaker;
      return `${roleLabel}: ${u.text}`;
    }).join('\n');
}

/**
 * Build shared template variables for child profiling prompts
 * @param {Object} childInfo - Child's info (name, ageMonths, gender, clinicalPriority)
 * @param {Object} tagCounts - Session metrics from PCIT coding
 * @param {Array} utterances - Utterances with roles
 * @returns {Object} Template variables object
 */
function buildProfilingVariables(childInfo, tagCounts, utterances) {
  const { name, ageMonths, gender, clinicalPriority, isFirstSession, durationSeconds, achievedMilestoneKeys, historicalCdiSessions, yesterdayGoal } = childInfo;
  const transcript = formatUtterancesForPsychologist(utterances);

  const formatLevel = (level) => level ? level.replace(/_/g, ' ').toLowerCase() : 'none';
  const formatStrategy = (strategy) => strategy ? strategy.replace(/_/g, ' ').toLowerCase() : 'none';

  const formatRowDetails = (row) => {
    const parts = [];
    if (row.fromUserIssue && row.userIssues) {
      const issues = JSON.parse(row.userIssues).map(i => i.replace(/_/g, ' '));
      parts.push(`User-reported: ${issues.join(', ')}`);
    }
    if (row.fromWacb && row.wacbQuestions) {
      const qs = JSON.parse(row.wacbQuestions);
      parts.push(`WACB signals: ${qs.join(', ')}${row.wacbScore ? ` (score: ${row.wacbScore})` : ''}`);
    }
    return parts.length > 0 ? parts.join('. ') : 'none';
  };

  const primaryRow = (clinicalPriority?.issuePriorities || []).find(r => r.priorityRank === 1);
  const otherPriorities = (clinicalPriority?.issuePriorities || []).filter(r => r.priorityRank > 1);

  // Extract human-readable issue names from issuePriority rows
  const formatIssueLabel = (row) => {
    if (row?.fromUserIssue && row.userIssues) {
      try {
        return JSON.parse(row.userIssues).map(i => i.replace(/_/g, ' ').toLowerCase()).join(', ');
      } catch (_) {}
    }
    if (row?.fromWacb && row.wacbQuestions) {
      try {
        return JSON.parse(row.wacbQuestions).join(', ');
      } catch (_) {}
    }
    return formatLevel(row?.clinicalLevel);
  };

  const primaryIssueText = primaryRow ? formatIssueLabel(primaryRow) : 'none';
  const otherIssuesText = otherPriorities.length > 0
    ? otherPriorities.map(r => `  - ${formatIssueLabel(r)}`).join('\n')
    : '  none';

  const sessionMetrics = `- Labeled Praises: ${tagCounts.praise || 0} (goal: 10+)
- Reflections: ${tagCounts.echo || 0} (goal: 10+)
- Behavioral Descriptions: ${tagCounts.narration || 0} (goal: 10+)
- Questions: ${tagCounts.question || 0} (reduce)
- Commands: ${tagCounts.command || 0} (reduce)
- Criticisms: ${tagCounts.criticism || 0} (eliminate)`;

  const totalMinutes = durationSeconds ? Math.floor(durationSeconds / 60) : null;
  const totalSeconds = durationSeconds ? durationSeconds % 60 : null;
  const sessionDuration = durationSeconds
    ? (totalMinutes > 0 ? `${totalMinutes} min ${totalSeconds} sec` : `${totalSeconds} sec`)
    : 'unknown';

  const formatSessionDate = (createdAt) => {
    const d = new Date(createdAt);
    return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
  };

  const historicalMetrics = historicalCdiSessions && historicalCdiSessions.length > 0
    ? historicalCdiSessions.map(s => {
        const tc = s.tagCounts || {};
        return `- [${formatSessionDate(s.createdAt)}]: Praise ${tc.praise || 0}, Echo ${tc.echo || 0}, Narrate ${tc.narration || 0} | Questions ${tc.question || 0}, Commands ${tc.command || 0}, Criticism ${tc.criticism || 0}`;
      }).join('\n')
    : null;

  return {
    CHILD_NAME: name || 'the child',
    CHILD_AGE_MONTHS: String(ageMonths || 'unknown'),
    CHILD_GENDER: gender || 'child',
    PRIMARY_ISSUE: primaryIssueText,
    PRIMARY_STRATEGY: formatStrategy(clinicalPriority?.primaryStrategy),
    PRIMARY_DETAILS: primaryRow ? formatRowDetails(primaryRow) : 'none',
    OTHER_ISSUES: otherIssuesText,
    SESSION_METRICS: sessionMetrics,
    SESSION_DURATION: sessionDuration,
    HISTORICAL_METRICS_SECTION: historicalMetrics
      ? `**Historical Session Metrics (last sessions, oldest → most recent):**\n${historicalMetrics}`
      : '',
    YESTERDAY_GOAL_SECTION: yesterdayGoal
      ? `**Yesterday's Focus Goal:**\n${yesterdayGoal}\nWhen setting the "key focus for tomorrow", acknowledge whether yesterday's goal was achieved before setting the next one.`
      : '',
    TRANSCRIPT: transcript,
    FIRST_SESSION_NOTE: isFirstSession
      ? `This is the first session the parent has with Nora. Your primary goal is to hook the user in, set expectations that Nora will be very helpful, and get them excited about the emotional massage and the discipline coaching (available once their emotional bank account is ready). Commit them to making daily sessions their priority.

After your main coaching report, include the following "First Session Foundation" section verbatim in structure but translated to the appropriate language and consistent in tone with the rest of your report:

---

Your 5-Minute Foundation:
Great job on your first session! Think of this 5-minute block as a Training Gym where you and your child both benefit:
For your child: It is an "emotional massage" that repairs self-esteem and lowers frustration.
For you: It is a "practice lab" to master expert skills until they become natural habits.

Your PEN Skill Challenge
Don't worry about being perfect right away—this requires practice! We will break down these skills and lead you step-by-step to make each session more effective.

Aim for these targets during your session:

10 Labeled Praises: Be specific ("I love how you shared those blocks").

10 Echoes: Repeat what they say to show you are truly listening.

10 Narrations: Describe their play like a sports broadcaster.

The "Avoids": No Questions, Commands, or Criticism. Let your child lead!

Over time, these skills will naturally show up in your daily life—during routines and even stressful moments. You won't need to force it forever; with practice, it becomes a habit.

Important Reminder: The Three Modes
Child-led play does not mean child-led all day. We are building the "Play Time" foundation first. Once it's rock-solid, Nora will guide you through the other essential modes:

Play Time (Child-Led): Building the emotional "bank account."

Teaching Mode: Reading, learning, and coaching new skills.

Leadership Mode: Routines, boundaries, and discipline.

Healthy parenting uses all three modes to raise resilient, successful children.

Why it Works
This "Emotional Massage" builds the foundation needed for later leadership. Research shows it:

Reduces Opposition: A stronger bond makes them want to cooperate.

Improves Focus: It builds frustration tolerance and longer play periods.

Breaks the Cycle: No matter how tough the day was, it always ends with a win.

Consistency is your superpower. Even on bad days, don't skip your 5 minutes. See you for Day 2!`
      : '',
    ACHIEVED_MILESTONE_KEYS: achievedMilestoneKeys && achievedMilestoneKeys.length > 0
      ? JSON.stringify(achievedMilestoneKeys)
      : '[] (none yet)',
    IS_FIRST_SESSION_BASELINE: isFirstSession
      ? `FIRST SESSION — BASELINE ASSESSMENT:
This is the child's first profiling session. In addition to detecting emerging milestones in "detected_milestone_keys",
also identify milestones the child has CLEARLY ALREADY MASTERED based on age and transcript evidence.
- Only include in "baseline_achieved" if the child's age is at or past the typical mastery age AND the transcript shows clear evidence
- These will be marked directly as ACHIEVED (not EMERGING)
Return these in the top-level "baseline_achieved" array.`
      : 'This is NOT the first session. Leave "baseline_achieved" as an empty array [].'
  };
}

/**
 * Generate developmental profiling
 * Produces developmental observations (5 clinical domains) with milestone library framework
 * @param {Array} utterances - Utterances with roles
 * @param {Object} childInfo - Child's info (name, ageMonths, gender, clinicalPriority)
 * @param {Object} tagCounts - Session metrics from PCIT coding
 * @returns {Promise<Object|null>} { developmentalObservation, metadata } or null on failure
 */
async function generateDevelopmentalProfiling(utterances, childInfo, tagCounts = {}, childSpeaker = null, sessionId = null, language = null) {
  const variables = buildProfilingVariables(childInfo, tagCounts, utterances);
  variables.LANGUAGE_INSTRUCTION = getLanguageInstruction(language);
  const prompt = loadPromptWithVariables('developmentalProfiling', variables);

  console.log(`📊 [DEV-PROFILING] Generating developmental profiling...`);

  try {
    const parsed = await llmCall(prompt, {
      profile:  'dev-profiling',
      schema:   SCHEMAS.DEV_PROFILING,
      label:    'dev-profiling',
      sessionId,
    });

    const result = {
      developmentalObservation: parsed.developmental_observation || null,
      metadata: parsed.session_metadata || null,
      baselineAchieved: parsed.baseline_achieved || []
    };

    console.log(`✅ [DEV-PROFILING] Response parsed — ${result.developmentalObservation?.domains?.length || 0} domains, ${result.baselineAchieved.length} baseline achieved`);
    return result;
  } catch (error) {
    console.error('❌ [DEV-PROFILING] Error:', error.message);
    return null;
  }
}

// ============================================================================
// About Child — Psychologist Narrative + Observation Extraction
// ============================================================================

/**
 * Generate "About Child" observations via two sequential LLM calls.
 *
 * Step 1 — Free-form psychologist narrative (prose output)
 * Step 2 — Extract structured observations from the narrative (JSON array)
 *
 * @param {Array}  utterances - Utterances with roles
 * @param {Object} childInfo  - { name, ageMonths, gender }
 * @param {Object} tagCounts  - Session metrics from PCIT coding
 * @returns {Promise<Array|null>} Array of AboutChildItem or null on failure
 */
async function generateAboutChild(utterances, childInfo, tagCounts = {}, sessionId = null, language = null) {
  const { name, ageMonths, gender } = childInfo;
  const transcript = formatUtterancesForPsychologist(utterances);
  const ageDisplay = ageMonths ? `${ageMonths} months old` : 'unknown age';
  const languageInstruction = getLanguageInstruction(language);

  // ── Step 1: Free-form psychologist narrative ──────────────────────────────
  const step1Prompt = loadPromptWithVariables('aboutChildStep1', {
    CHILD_NAME: name || 'Child',
    AGE_DISPLAY: ageDisplay,
    GENDER: gender || 'child',
    PRAISE: String(tagCounts.praise || 0),
    ECHO: String(tagCounts.echo || 0),
    NARRATION: String(tagCounts.narration || 0),
    QUESTION: String(tagCounts.question || 0),
    COMMAND: String(tagCounts.command || 0),
    CRITICISM: String(tagCounts.criticism || 0),
    TRANSCRIPT: transcript,
  });
  const step1PromptFinal = languageInstruction ? `${step1Prompt}\n\n${languageInstruction}` : step1Prompt;

  console.log(`📊 [ABOUT-CHILD] Step 1: Generating psychologist narrative...`);

  let narrativeText;
  try {
    narrativeText = await llmCall(step1PromptFinal, {
      profile:  'about-child-narrative',
      label:    'about-child-step1',
      sessionId,
    });
    console.log(`✅ [ABOUT-CHILD] Step 1 complete (${narrativeText.length} chars)`);
  } catch (error) {
    console.error('❌ [ABOUT-CHILD] Step 1 failed:', error.message);
    return null;
  }

  // ── Step 2: Extract structured child observations ─────────────────────────
  const childDisplayName = name || 'the child';
  const step3Prompt = `Extract ONLY the "Observations of the Child" section - the insights about the child's behavior, development, and characteristics observed during the session. DO not mention PCIT or clinical terms.

The child's name is "${childDisplayName}". Use this name (not any other name from the text) when referring to the child in your response.

Format the observations as a JSON array, ranked by positivity follow by significance. Each observation should have:
- id: sequential number starting from 1
- Title: A short catchy title (2-4 words) describing the trait or behavior
- Description: A brief 1-sentence summary for parents
- Details: A longer explanation with developmental context, why this matters, and actionable tips about how to improve.

Here is the psychologist feedback to analyze:
${narrativeText}

Return ONLY a valid JSON array. No markdown code blocks or explanations.

Example format:
[
  {
    "id": 1,
    "Title": "Little Scientist",
    "Description": "Bobby was exploring physics (gravity/pouring). He wasn't trying to be messy.",
    "Details": "His persistent desire to 'pour' and 'take out' reflects a 3-year-old's natural curiosity about cause and effect. At this age, repetitive pouring is a way of testing physical boundaries and understanding how objects occupy space."
  },
  {
    "id": 2,
    "Title": "Sensory Seeker",
    "Description": "Bobby loves the 'squishy' texture today!",
    "Details": "He is very focused on the tactile nature of the vitamins—calling them 'squishy, squishy'. This is a hallmark of the sensorimotor stage of development, where kids learn through touch and texture."
  }
]`;

  const step3PromptFinal = languageInstruction ? `${step3Prompt}\n\n${languageInstruction}` : step3Prompt;

  console.log(`📊 [ABOUT-CHILD] Step 2: Extracting child observations...`);

  try {
    const aboutChild = await llmCall(step3PromptFinal, {
      profile:  'about-child-extract',
      label:    'about-child-step3',
      sessionId,
    });
    if (!Array.isArray(aboutChild)) throw new Error('Expected array response');
    console.log(`✅ [ABOUT-CHILD] Extracted ${aboutChild.length} child observations`);
    return aboutChild;
  } catch (error) {
    console.error('❌ [ABOUT-CHILD] Step 2 failed:', error.message);
    return null;
  }
}

/**
 * Generate CDI coaching cards
 * Produces actionable coaching summary and cards for parents
 * @param {Array} utterances - Utterances with roles
 * @param {Object} childInfo - Child's info (name, ageMonths, gender, clinicalPriority)
 * @param {Object} tagCounts - Session metrics from PCIT coding
 * @returns {Promise<Object|null>} { coachingSummary, coachingCards } or null on failure
 */
async function generateCdiCoaching(utterances, childInfo, tagCounts = {}, childSpeaker = null, sessionId = null, language = null) {
  const variables = buildProfilingVariables(childInfo, tagCounts, utterances);
  variables.LANGUAGE_INSTRUCTION = getLanguageInstruction(language);

  // Step 1: Deterministic goal directive — no LLM needed
  const { name, ageMonths, yesterdayGoal, historicalCdiSessions, childId, userId: childUserId } = childInfo;
  let tomorrowGoal = null;
  let notifications = null;

  console.log(`📊 [CDI-COACHING] Step 1: Computing goal directive...`);
  let skillProgressRecord = null;
  try {
    skillProgressRecord = await prisma.userSkillProgress.findUnique({
      where: { userId_childId: { userId: childUserId, childId } }
    });
  } catch (e) {
    console.warn('⚠️ [CDI-COACHING] Could not fetch skill progress record:', e.message);
  }

  const directive = getGoalDirective(
    tagCountsToSession(tagCounts),
    recordToProfile(skillProgressRecord)
  );
  console.log(`✅ [CDI-COACHING] Goal directive: ${directive.focus_skill} → target ${directive.target_number}`);

  // Step 1b: LLM writes notification copy based on the pre-determined directive
  console.log(`📊 [CDI-COACHING] Step 1b: Generating notification copy...`);
  try {
    const notifPrompt = loadPromptWithVariables('cdiCoachingNotifications', {
      CHILD_NAME:                    name || 'your child',
      CHILD_AGE_MONTHS:              String(ageMonths || 'unknown'),
      SESSION_DURATION:              variables.SESSION_DURATION,
      SESSION_METRICS:               variables.SESSION_METRICS,
      YESTERDAY_GOAL_SECTION:        yesterdayGoal ? `Yesterday's Focus Goal: ${yesterdayGoal}` : 'None',
      HISTORICAL_METRICS_SECTION:    variables.HISTORICAL_METRICS_SECTION || 'No prior sessions.',
      PERFORMANCE_VS_GOAL_SECTION:   buildPerformanceVsGoalSection(historicalCdiSessions, tagCounts, yesterdayGoal),
      GOAL_DIRECTIVE:                `Focus: ${directive.focus_skill}\nTarget: ${directive.target_number}\nStrategy: ${directive.strategy}`,
      LANGUAGE_INSTRUCTION:          variables.LANGUAGE_INSTRUCTION || ''
    });
    const notifResult = await llmCall(notifPrompt, {
      profile:  'coaching-notifications',
      label:    'coaching-notifications',
      sessionId,
    });
    tomorrowGoal = notifResult?.['tomorrow goal'] || `${directive.focus_skill}: ${directive.target_number}`;
    notifications = notifResult?.notification || null;
    console.log(`✅ [CDI-COACHING] Notifications generated`);
  } catch (notifError) {
    console.warn('⚠️ [CDI-COACHING] Notifications generation failed:', notifError.message);
    tomorrowGoal = `${directive.focus_skill}: ${directive.target_number}`;
  }

  // Step 1c: Update mastery profile (non-blocking)
  try {
    const masteryUpdates = computeMasteryUpdates(skillProgressRecord, tagCountsToSession(tagCounts));
    if (Object.keys(masteryUpdates).length > 0) {
      await prisma.userSkillProgress.upsert({
        where: { userId_childId: { userId: childUserId, childId } },
        create: { userId: childUserId, childId, ...masteryUpdates },
        update: masteryUpdates
      });
      console.log(`✅ [CDI-COACHING] Mastery profile updated:`, masteryUpdates);
    }
  } catch (masteryError) {
    console.warn('⚠️ [CDI-COACHING] Mastery profile update failed (non-blocking):', masteryError.message);
  }

  // Step 2: Coaching report — tomorrow goal injected so narrative reinforces the decided goal
  variables.TOMORROW_GOAL = tomorrowGoal || 'Continue building connection through play.';
  const prompt = loadPromptWithVariables('cdiCoaching', variables);

  console.log(`📊 [CDI-COACHING] Step 2: Generating coaching report...`);

  try {
    const coachingReport = await llmCall(prompt, {
      profile:  'coaching-narrative',
      label:    'coaching-narrative',
      sessionId,
    });

    console.log(`✅ [CDI-COACHING] Coaching report received (${coachingReport.length} chars)`);

    // Step 3: Format coaching report for mobile
    console.log(`📊 [CDI-COACHING] Step 3: Formatting coaching sections...`);

    const formatPrompt = loadPromptWithVariables('cdiCoachingFormat', {
      COACHING_REPORT: coachingReport,
      LANGUAGE_INSTRUCTION: variables.LANGUAGE_INSTRUCTION || '',
      CHILD_GENDER: variables.CHILD_GENDER || 'child'
    });

    const checkComplete = (result) => {
      const sections = result?.sections;
      const totalContentLen = sections?.reduce((sum, s) => sum + (s.content?.length || 0), 0) || 0;
      return Array.isArray(sections)
        && sections.length >= 3
        && sections.every(s => s.title?.trim() && s.content?.trim())
        && totalContentLen >= coachingReport.length * 0.6;
    };

    let formatted = null;
    try {
      formatted = await withQualityRetry(
        () => llmCall(formatPrompt, { profile: 'coaching-format', schema: SCHEMAS.COACHING_FORMAT, label: 'coaching-format', sessionId }),
        checkComplete,
        () => llmCall(formatPrompt, { profile: 'coaching-format', model: 'claude', schema: SCHEMAS.COACHING_FORMAT, label: 'coaching-format-escalated', sessionId })
      );
    } catch (formatError) {
      console.error('❌ [CDI-COACHING] Format call failed:', formatError.message);
    }

    if (!formatted) {
      console.warn(`⚠️ [CDI-COACHING] Format incomplete after all attempts, returning raw report`);
      return { coachingSummary: coachingReport, coachingCards: null, tomorrowGoal, notifications };
    }

    const result = {
      coachingSummary: coachingReport,
      coachingCards: formatted.sections || null,
      tomorrowGoal: formatted.tomorrowGoal || tomorrowGoal || null,
      notifications: notifications || null
    };

    console.log(`✅ [CDI-COACHING] Formatted — ${result.coachingCards?.length || 0} sections`);
    return result;
  } catch (error) {
    console.error('❌ [CDI-COACHING] Error:', error.message);
    return null;
  }
}

// ============================================================================
// CDI Feedback Generation (Multi-prompt approach)
// ============================================================================

/**
 * Generate combined analysis and feedback prompt for CDI session
 * Combines analysis and improvement into a single prompt
 */
function generateCombinedFeedbackPrompt(counts, utterances, childName = 'the child', language = null) {
  return `You are an expert in parent-child interaction. Analyze this 5-minute play session with ${childName}.

**Session Metrics:**
- Labeled Praises: ${counts.praise} (goal: 10+)
- Reflections: ${counts.echo} (goal: 10+)
- Behavioral Descriptions: ${counts.narration} (goal: 10+)
- Questions: ${counts.question} (reduce)
- Commands: ${counts.command} (reduce)
- Criticisms: ${counts.criticism} (reduce)
- Negative Phrases: ${counts.negative_phrases} (eliminate)

**Transcript:**
${formatUtterancesForPrompt(utterances)}

**Task:**
1. **Top Moment**: Find the ONE moment that shows the strongest parent-child connection, joy, or positive interaction. Child's utterance is prefered over parent's.

2. **Feedback**: Be warm and encouraging. within 20 words. Give a opening messages to the session report. Do not mention PCIT, therapy, or clinical terms.
Example opening messages for feedback:
- "Today's play made a net emotional deposit — your child felt seen, safe, and connected."
- "Today's play added only a small deposit — with a few gentle shifts, your emotional massage can feel much more soothing and connecting."
- "Today's play showed clear progress from last time — your deposits were more consistent, and your child stayed more relaxed and engaged."
- "Today's play included big emotions and some dysregulation. When stress runs high, deposits don't always land — and that's okay. Consistent emotional massage brings the account back."

3. **Reminder**: Write exactly 2 sentences of encouragement about how improving creates positive experiences for the child. Keep it warm and forward-looking.

4.  **ChildReaction**: Highlight insights about ${childName}'s behavior, to boost the parent's motivation to continue practising the desired skills and avoid undesired skills. Use ${childName}'s name in your response.

5. **Activity**: Infer in a few words what game or activity the parent and child played in this session (e.g. "building blocks", "coloring", "pretend cooking", "puzzle").

Return ONLY valid JSON:
{
  "topMoment": {
    "quote": "exact quote from the transcript",
    "utteranceNumber": index of utterance
  },
  "Feedback": "2 sentences of opening message",
  "exampleUtteranceNumber": index of the utterance used as example,
  "reminder": "2 sentences of encouragement",
  "ChildReaction":"2-3 sentences",
  "activity": "a few words describing the game/activity"
}

Do not mention PCIT, therapy, or clinical terms in the output.

No markdown code fences.${language ? `\n\n${getLanguageInstruction(language)}` : ''}`;
}


/**
 * Format utterances for the review-feedback pass
 * @param {Array} utterances - Utterances with roles and PCIT tags
 * @returns {string} Formatted transcript string
 */
function formatUtterancesForReview(utterances) {
  return utterances.map((u, i) => {
    if (u.speaker === SILENT_SPEAKER_ID) {
      const duration = (u.endTime - u.startTime).toFixed(1);
      return `[${String(i).padStart(2, '0')}] ⏸️ SILENCE (${duration}s)`;
    }
    const roleLabel = u.role === 'adult' ? 'Parent' : u.role === 'child' ? 'Child' : u.speaker;
    const tagSuffix = u.pcitTag ? ` [${u.pcitTag}]` : '';
    return `[${String(i).padStart(2, '0')}] ${roleLabel}: "${u.text}"${tagSuffix}`;
  }).join('\n');
}

/**
 * Generate feedback prompt for CDI/PDI session
 * Writes feedback from scratch for all coded parent utterances and selected silence slots
 */
function generateReviewFeedbackPrompt(counts, utterances, isCDI = true, pdiResult = null, language = null) {
  const commandCoachingSection = isCDI
    ? `   **For undesirable skills (NTA, DC, IC, Q, UP)**: 1 coaching sentence with a specific PRIDE alternative (BD, LP, or RF) per the DPICS manual. Reference what the parent actually said. Before finalising, verify your suggested alternative: does it contain a "?" → it's a Q; does it direct the child ("put X", "can you...") → it's an IC; does it evaluate negatively → it's NTA. Rephrase until it's a clean PRIDE skill.`
    : `   **Commands — PDI focus:**
   - **DC (Direct Command)** is a TARGET SKILL in PDI. Reinforce it warmly. Coach on quality: was it direct, specific, positively phrased, one at a time, age-appropriate, and calm? Do not suggest replacing it with a PRIDE skill.
   - **IC (Indirect Command)** is still undesirable. Coach the parent toward a DC instead (e.g. "Try stating it directly: 'Please put the block down.'").
   - **After every DC or IC**, identify the full command sequence across the surrounding utterances:
     • Did the parent wait ~5 seconds after giving the command? (check the next silence slot or child utterance timing)
     • Did the child comply or refuse?
     • If the child refused: did the parent offer a Two-Choice? Was it logical and age-appropriate?
     • Was follow-through consistent — brief and matter-of-fact, without nagging or over-explaining?
     • Was LP used immediately after the child complied?
     Attach coaching to the specific utterance ID where the breakdown occurred (or reinforce the utterance where it went well).
   **For all other undesirable skills (NTA, Q, UP)**: 1 coaching sentence with a specific PRIDE alternative per the DPICS manual. Verify the alternative contains no "?", no directives, and no negative evaluations.`;

  const metricsSection = isCDI
    ? `- Labeled Praises: ${counts.praise} (goal: 10+)
- Reflections/Echo: ${counts.echo} (goal: 10+)
- Behavioral Descriptions/Narration: ${counts.narration} (goal: 10+)
- Questions: ${counts.question} (reduce)
- Commands: ${counts.command} (reduce)
- Criticisms: ${counts.criticism} (reduce)`
    : `- Direct Commands: ${counts.direct_command} (use consistently — this is the goal)
- Indirect Commands: ${counts.indirect_command} (reduce — convert to Direct Commands)
- Labeled Praises: ${counts.praise} (use after child compliance as success marker)
- Questions: ${counts.question} (reduce during discipline sequences)
- Criticisms: ${counts.criticism} (eliminate)`;

  const pdiTwoChoicesSection = (!isCDI && pdiResult)
    ? `\n**PDI Two Choices Flow Analysis:**\n${JSON.stringify({ pdiSkills: pdiResult.pdiSkills, commandSequences: pdiResult.commandSequences }, null, 2)}\n\nUse this analysis to inform feedback on command sequences. Reference specific command sequences when coaching on DC/IC utterances.\n`
    : '';

  return `You are an expert PCIT parent-child interaction therapist. You have access to the DPICS manual and Appendix A (sufficiently positive words). Refer to them when writing suggested alternatives for undesirable skills.

**Session Metrics:**
${metricsSection}
${pdiTwoChoicesSection}
**Full Session Transcript:**
${formatUtterancesForReview(utterances)}

**Your Task:**
1. Write feedback for every coded Parent utterance (those with a DPICS tag in brackets).
   **For desirable skills (LP, BD, RF, RQ)**: 1 short warm sentence reinforcing what the parent did well. Reference what they actually said — be specific, not generic. You may add an "additional_tip" only if it is extremely insightful and would help the parent improve their overall performance.
   **For neutral codes (AK, ID, TC, NC)**: set feedback to null — skip these.
   Child utterances have no tag — skip them entirely.
${commandCoachingSection}

2. Identify any silence slots that:
   - Are good opportunities for the parent to practice skills
   - Come at natural moments (not awkward pauses)
   - Would benefit from coaching tips${isCDI ? ' (PEN skills)' : ' (e.g. strategic wait time after a command)'}

**Output Format:**
Return ONLY a valid JSON array. Each item has:
- "id": the utterance index number (from [XX] in the transcript)
- "feedback": revised feedback string (1-2 sentences, warm and specific)
- "additional_tip": optional extra tip for desirable skills (null if not applicable)

**Rules:**
- Include ALL parent utterances that have a DPICS tag
- Maximum 3 silence slots
- Be specific — reference what the parent actually said, never write generic boilerplate
- Suggested alternatives must be valid PRIDE skills — verify no "?", no directives, no negative evaluations
- Return ONLY the JSON array, no other text

No markdown code fences.${language ? `\n\n${getLanguageInstruction(language)}` : ''}`;
}

/**
 * Orchestrator function for multi-prompt feedback (CDI and PDI)
 * @param {Object} counts - Tag counts from PCIT coding
 * @param {Array} utterances - Utterances with tags
 * @param {string} childName - Child's name for personalized feedback
 * @param {boolean} isCDI - true for CDI sessions, false for PDI
 * @returns {Promise<Object>} Assembled feedback result
 */
async function generateCDIFeedback(counts, utterances, childName, isCDI = true, pdiResult = null, sessionId = null, language = null) {
  console.log(`🚀 [CDI-FEEDBACK] Starting feedback generation (mode: ${isCDI ? 'CDI' : 'PDI'})...`);

  // Call 1: Combined feedback prompt (analysis + improvement + example in one)
  console.log('📝 [CDI-FEEDBACK] Running combined feedback prompt...');
  const feedbackData = await llmCall(
    generateCombinedFeedbackPrompt(counts, utterances, childName, language),
    { profile: 'combined-feedback', schema: SCHEMAS.COMBINED_FEEDBACK, label: 'combined-feedback', sessionId }
  );

  console.log('✅ [CDI-FEEDBACK] Combined feedback result:', JSON.stringify(feedbackData).substring(0, 300));

  // Call 2: Write feedback for all coded parent utterances using DPICS manual cache
  console.log('📝 [CDI-FEEDBACK] Running feedback generation with DPICS manual cache...');
  let revisedFeedback = [];
  try {
    const dpicsSystemPrompt = loadPrompt('dpicsCoding-agentic-v10') + (!isCDI ? `

**PDI SESSION — Feedback Override for Commands:**
This is a PDI (Parent-Directed Interaction) session. The rules above apply for coding, but the feedback generation strategy for commands is different:
- **DC (Direct Command)**: DC is a TARGET SKILL in PDI. Do NOT suggest replacing it with a PRIDE skill. Instead, briefly reinforce it or coach on quality (e.g. was it direct, specific, calm, positively phrased?).
- **IC (Indirect Command)**: Still undesirable. Coach toward a DC instead (e.g. "Try stating it directly: 'Please put the block down.'"). Do NOT suggest using BD or LP.
All other feedback rules remain the same.` : '');

    const reviewPrompt = generateReviewFeedbackPrompt(counts, utterances, isCDI, pdiResult, language);
    const reviewData = await llmCall(reviewPrompt, {
      profile: 'review-feedback',
      cache: {
        key:         isCDI ? 'dpics-cdi' : 'dpics-pdi',
        primaryFile: DPICS_PDF_PATH,
        systemPrompt: dpicsSystemPrompt,
      },
      label:    'review-feedback',
      sessionId,
    });
    revisedFeedback = Array.isArray(reviewData) ? reviewData : [];
    console.log('✅ [CDI-FEEDBACK] Review feedback result:', JSON.stringify(revisedFeedback).substring(0, 300));
  } catch (reviewError) {
    console.error('⚠️ [CDI-FEEDBACK] Review feedback failed, continuing without revised feedback:', reviewError.message);
  }

  // Assemble final result
  const result = {
    topMoment: feedbackData.topMoment?.quote,
    topMomentUtteranceNumber: feedbackData.topMoment?.utteranceNumber,
    feedback: feedbackData.Feedback,
    example: feedbackData.exampleUtteranceNumber,
    childReaction: feedbackData.ChildReaction,
    reminder: feedbackData.reminder,
    activity: feedbackData.activity || null,
    revisedFeedback: revisedFeedback  // Array of {id, feedback, additional_tip}
  };

  console.log('✅ [CDI-FEEDBACK] Feedback generation complete');
  return result;
}

// ============================================================================
// PDI Two Choices Flow Analysis
// ============================================================================

/**
 * Generate PDI Two Choices Flow analysis
 * Evaluates the parent on 4 discipline skills from the Two Choices Flow framework
 * @param {Array} utterances - Utterances with roles and PCIT tags
 * @param {string} childName - Child's name for personalized feedback
 * @returns {Promise<Object|null>} PDI analysis result or null on failure
 */
async function generatePDITwoChoicesAnalysis(utterances, childName, sessionId = null, language = null) {
  console.log('🎯 [PDI-TWO-CHOICES] Starting Two Choices Flow analysis...');

  const transcript = utterances
    .filter(u => u.speaker !== SILENT_SPEAKER_ID)
    .map((u) => `${u.speaker}: ${u.text}`)
    .join('\n');

  const prompt = loadPromptWithVariables('pdiTwoChoicesFlow', {
    CHILD_NAME: childName || 'the child',
    TRANSCRIPT: transcript,
    LANGUAGE_INSTRUCTION: getLanguageInstruction(language)
  });

  try {
    const result = await llmCall(prompt, {
      profile:  'pdi-two-choices',
      schema:   SCHEMAS.PDI_TWO_CHOICES,
      label:    'pdi-two-choices',
      sessionId,
    });
    const pdiSkills = result?.pdiSkills;

    if (!Array.isArray(pdiSkills) || pdiSkills.length === 0) {
      console.error('⚠️ [PDI-TWO-CHOICES] Invalid response structure, expected pdiSkills array');
      return null;
    }

    console.log(`✅ [PDI-TWO-CHOICES] Analysis complete — ${pdiSkills.length} skills evaluated`);
    return {
      pdiSkills,
      commandSequences: result.commandSequences || [],
      tomorrowGoal: result.tomorrowGoal || null,
      encouragement: result.encouragement || null,
      summary: result.summary || null,
    };
  } catch (error) {
    console.error('❌ [PDI-TWO-CHOICES] Error:', error.message);
    return null;
  }
}

// ============================================================================
// Role Identification — 3-way Majority Vote
// ============================================================================

/**
 * Identify speaker roles using three independent methods in parallel:
 *   1. Gemini (fast)   — transcript-based LLM
 *   2. Claude Sonnet   — transcript-based LLM (second opinion, on disagreement only)
 *   3. ML Lambda       — acoustic model (USC SAIL whisper LoRA)
 *
 * For each speaker, the role that receives ≥2 votes wins.
 * Any individual failure is tolerated; the function only throws if all three fail.
 *
 * @param {Array}  utterancesForPrompt  Utterances formatted for the role-ID prompt
 * @param {Array}  utterances           Full utterance records (for ML segment map)
 * @param {string} storagePath          S3 key of the audio file
 * @param {string} sessionId
 * @returns {{ roleIdentificationJson: Object, roleMap: Object }}
 *   roleMap: { speaker_0: 'adult', speaker_1: 'child', ... }  (lowercase)
 */
async function identifyRolesWithVoting(utterancesForPrompt, utterances, storagePath, sessionId) {
  const prompt = loadPromptWithVariables('roleIdentification', {
    UTTERANCES_JSON: JSON.stringify(utterancesForPrompt, null, 2)
  });

  // ── Phase 1: Gemini + ML in parallel ─────────────────────────────────────
  console.log(`📊 [ROLE-ID-VOTE] Phase 1: Gemini + ML in parallel...`);

  const [geminiSettled, mlSettled] = await Promise.allSettled([
    llmCall(prompt, {
      profile:  'role-identification',
      label:    'role-id-gemini',
      sessionId,
    }),
    classifySpeakersML(storagePath, utterances, sessionId)
  ]);

  const votes = [];

  if (geminiSettled.status === 'fulfilled' && geminiSettled.value?.speaker_identification) {
    const map = {};
    for (const [id, info] of Object.entries(geminiSettled.value.speaker_identification)) {
      map[id] = (info.role || '').toLowerCase();
    }
    votes.push({ source: 'gemini', map, full: geminiSettled.value });
    console.log(`✅ [ROLE-ID-VOTE] Gemini: ${JSON.stringify(map)}`);
  } else {
    console.warn(`⚠️ [ROLE-ID-VOTE] Gemini failed: ${geminiSettled.reason?.message}`);
  }

  if (mlSettled.status === 'fulfilled' && mlSettled.value) {
    const map = {};
    const conf = {};
    for (const [id, info] of Object.entries(mlSettled.value)) {
      if (info.role && info.role !== 'unknown') {
        map[id] = info.role.toLowerCase();
        conf[id] = info.confidence;
      }
    }
    if (Object.keys(map).length > 0) {
      votes.push({ source: 'ml', map, conf, full: mlSettled.value });
      console.log(`✅ [ROLE-ID-VOTE] ML: ${JSON.stringify(map)}`);
    }
  } else {
    console.warn(`⚠️ [ROLE-ID-VOTE] ML failed: ${mlSettled.reason?.message || 'no result'}`);
  }

  if (votes.length === 0) {
    throw new Error('Both Gemini and ML role identification failed');
  }

  // ── Check for disagreements ───────────────────────────────────────────────
  const allSpeakers = new Set(votes.flatMap(v => Object.keys(v.map)));
  const disagreements = [];

  if (votes.length >= 2) {
    for (const speakerId of allSpeakers) {
      const speakerVotes = votes.map(v => v.map[speakerId]).filter(Boolean);
      if (new Set(speakerVotes).size > 1) {
        disagreements.push(speakerId);
        console.warn(`⚠️ [ROLE-ID-VOTE] ${speakerId} disagreement: ${votes.map(v => `${v.source}→${v.map[speakerId] ?? '?'}`).join(' | ')}`);
      }
    }
  }

  // ── Phase 2: Claude tiebreaker (only on disagreement) ────────────────────
  if (disagreements.length > 0) {
    console.log(`📊 [ROLE-ID-VOTE] Phase 2: Claude resolving ${disagreements.length} disagreement(s)...`);
    try {
      const claudeResult = await llmCall(prompt, {
        profile:  'role-id-tiebreaker',
        label:    'role-id-claude',
        sessionId,
      });
      if (claudeResult?.speaker_identification) {
        const map = {};
        for (const [id, info] of Object.entries(claudeResult.speaker_identification)) {
          map[id] = (info.role || '').toLowerCase();
        }
        votes.push({ source: 'claude', map, full: claudeResult });
        console.log(`✅ [ROLE-ID-VOTE] Claude: ${JSON.stringify(map)}`);
      }
    } catch (claudeError) {
      console.warn(`⚠️ [ROLE-ID-VOTE] Claude failed: ${claudeError.message}`);
    }
  }

  // ── Majority vote per speaker ─────────────────────────────────────────────
  const uttCounts = {};
  for (const u of utterances) {
    if (u.speaker && u.speaker !== SILENT_SPEAKER_ID) {
      uttCounts[u.speaker] = (uttCounts[u.speaker] || 0) + 1;
    }
  }

  const roleMap = {};
  const voteDetail = {};

  for (const speakerId of allSpeakers) {
    const speakerVotes = votes
      .map(v => ({ source: v.source, role: v.map[speakerId], ...(v.conf?.[speakerId] !== undefined && { confidence: v.conf[speakerId] }) }))
      .filter(v => v.role);
    const adultN = speakerVotes.filter(v => v.role === 'adult').length;
    const childN = speakerVotes.filter(v => v.role === 'child').length;

    let winner;
    if (adultN > childN) winner = 'adult';
    else if (childN > adultN) winner = 'child';
    else winner = speakerVotes[0]?.role || 'adult';  // tie: first available

    roleMap[speakerId] = winner;
    voteDetail[speakerId] = { adult: adultN, child: childN, winner, votes: speakerVotes };
  }

  const sources = votes.map(v => v.source);
  console.log(`✅ [ROLE-ID-VOTE] Final (${sources.join('+')}): ${JSON.stringify(roleMap)}`);

  // ── Build roleIdentificationJson ──────────────────────────────────────────
  const baseFull = (votes.find(v => v.source === 'gemini') || votes.find(v => v.source === 'claude'))?.full;
  const baseSpeakers = baseFull?.speaker_identification || {};

  const mlVote = votes.find(v => v.source === 'ml');
  const speaker_identification = {};
  for (const [speakerId, role] of Object.entries(roleMap)) {
    const existing = baseSpeakers[speakerId] || {};
    speaker_identification[speakerId] = {
      ...existing,
      role: role.toUpperCase(),
      utterance_count: uttCounts[speakerId] || existing.utterance_count || 0,
      ...(mlVote?.conf?.[speakerId] !== undefined && { _ml_confidence: mlVote.conf[speakerId] })
    };
  }

  return {
    roleIdentificationJson: {
      speaker_identification,
      _vote_sources: sources,
      _vote_detail: voteDetail
    },
    roleMap
  };
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Analyze PCIT coding for transcript
 * Called after transcription completes
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
 */
async function analyzePCITCoding(sessionId, userId, preferredLanguage = null) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🏷️  [ANALYSIS-START] Session ${sessionId.substring(0, 8)} - Starting PCIT analysis`);
  console.log(`🏷️  [ANALYSIS-START] User: ${userId.substring(0, 8)}`);
  console.log(`${'='.repeat(80)}\n`);

  // Get session
  console.log(`📊 [ANALYSIS-STEP-1] Fetching session from database...`);
  const session = await prisma.session.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    console.error(`❌ [ANALYSIS-ERROR] Session ${sessionId} not found in database`);
    throw new Error('Session not found');
  }
  console.log(`✅ [ANALYSIS-STEP-1] Session found, mode: ${session.mode}`);

  // Get user's child info for personalized feedback
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      childName: true,
      childGender: true,
      childBirthYear: true,
      childBirthday: true,
      issue: true,
      childConditions: true
    }
  });
  if (!user) {
    throw new PermanentFailureError('User record not found', 'An error occurred while analyzing your recording. Please try again.');
  }
  let childName = 'the child';
  try {
    childName = user.childName ? decryptSensitiveData(user.childName) : 'the child';
  } catch (decryptErr) {
    throw new PermanentFailureError('Failed to decrypt child data', 'An error occurred while analyzing your recording. Please try again.');
  }
  const childAge = user.childBirthYear ? calculateChildAge(user.childBirthYear, user.childBirthday) : null;
  const childAgeMonths = user.childBirthYear ? calculateChildAgeInMonths(user.childBirthday, user.childBirthYear) : null;
  const childGender = user.childGender ? formatGender(user.childGender) : 'child';
  console.log(`✅ [ANALYSIS-STEP-1b] Child info: ${childName}, ${childAgeMonths} months old, ${childGender}`);

  // Fetch Child record early to get clinical priority fields
  let child = await prisma.child.findFirst({ where: { userId } });
  if (!child) {
    child = await prisma.child.create({
      data: {
        userId,
        name: childName || 'Child',
        birthday: user?.childBirthday || null,
        gender: user?.childGender || null,
        conditions: user?.childConditions || null
      }
    });
    console.log(`✅ [ANALYSIS-STEP-1c] Created Child record ${child.id} for user ${userId.substring(0, 8)}`);
  }
  // Fetch latest ChildIssuePriority snapshot for detail context
  const latestComputedAt = await prisma.childIssuePriority.findFirst({
    where: { childId: child.id },
    orderBy: { computedAt: 'desc' },
    select: { computedAt: true }
  });
  const issuePriorities = latestComputedAt
    ? await prisma.childIssuePriority.findMany({
        where: { childId: child.id, computedAt: latestComputedAt.computedAt },
        orderBy: { priorityRank: 'asc' }
      })
    : [];
  const clinicalPriority = {
    primaryIssue: child.primaryIssue,
    primaryStrategy: child.primaryStrategy,
    secondaryIssue: child.secondaryIssue,
    secondaryStrategy: child.secondaryStrategy,
    issuePriorities
  };
  console.log(`✅ [ANALYSIS-STEP-1c] Clinical priority: primary=${clinicalPriority.primaryIssue || 'none'}, secondary=${clinicalPriority.secondaryIssue || 'none'}, detail rows=${issuePriorities.length}`);

  // Get utterances from database
  console.log(`📊 [ANALYSIS-STEP-2] Fetching utterances from database...`);
  const utterances = await getUtterances(sessionId);
  console.log(`✅ [ANALYSIS-STEP-2] Found ${utterances.length} utterances`);

  if (utterances.length === 0) {
    throw new Error('No utterances found in session data');
  }

  // Convert to format expected by role identification prompt
  const utterancesForPrompt = utterances.map(utt => ({
    speaker: utt.speaker,
    text: utt.text,
    start: utt.startTime,
    end: utt.endTime
  }));

  const isCDI = session.mode === 'CDI';

  // Detect primary language from ElevenLabs transcription result.
  // If ElevenLabs detects Chinese (zho/cmn) and the user's preferred language is
  // Traditional Chinese (zh-TW), honour that preference over the generic Mandarin code.
  const detectedLanguage = session.elevenLabsJson?.language_code || null;
  const CHINESE_CODES = new Set(['zho', 'cmn']);
  const primaryLanguage = (
    CHINESE_CODES.has(detectedLanguage) && preferredLanguage === 'zh-TW'
  ) ? 'zh-TW' : detectedLanguage;
  if (primaryLanguage && primaryLanguage !== 'eng') {
    console.log(`🌐 [ANALYSIS] Primary language: ${primaryLanguage} (detected: ${detectedLanguage}, preferred: ${preferredLanguage || 'none'})`);
  }

  // STEP 1: Identify speaker roles (skip if already done on a previous attempt)
  let roleIdentificationJson;
  let adultSpeakers = [];

  if (session.roleIdDone && session.roleIdentificationJson) {
    console.log(`[ANALYSIS] Skipping role identification — already completed (checkpoint)`);
    roleIdentificationJson = session.roleIdentificationJson;
    const speakerIdentification = roleIdentificationJson.speaker_identification || {};
    for (const [speakerId, speakerInfo] of Object.entries(speakerIdentification)) {
      if (speakerInfo.role === 'ADULT') {
        adultSpeakers.push({
          id: speakerId,
          confidence: speakerInfo.confidence,
          utteranceCount: speakerInfo.utterance_count || 0
        });
      }
    }
    adultSpeakers.sort((a, b) => b.utteranceCount - a.utteranceCount);
  } else {
    try {
      const { roleIdentificationJson: rij, roleMap } = await identifyRolesWithVoting(
        utterancesForPrompt, utterances, session.storagePath, sessionId
      );
      roleIdentificationJson = rij;

      // Extract adult speakers from voted result
      for (const [speakerId, info] of Object.entries(roleIdentificationJson.speaker_identification || {})) {
        if (info.role === 'ADULT') {
          adultSpeakers.push({
            id: speakerId,
            confidence: info.confidence,
            utteranceCount: info.utterance_count || 0
          });
        }
      }
      adultSpeakers.sort((a, b) => b.utteranceCount - a.utteranceCount);

      if (adultSpeakers.length === 0) {
        throw new PermanentFailureError(
          'No adult speakers found in role identification',
          'We could not identify a parent speaker in your recording. Please ensure the audio clearly captures your voice.'
        );
      }

      console.log(`Adult speakers identified: ${adultSpeakers.map(a => a.id).join(', ')}`);

      // Persist roles
      console.log(`📊 [ANALYSIS-STEP-5] Updating utterance roles and storing checkpoint...`);
      console.log(`   Role map: ${JSON.stringify(roleMap)}`);
      await updateUtteranceRoles(sessionId, roleMap);
      console.log(`✅ [ANALYSIS-STEP-5] Updated roles for ${Object.keys(roleMap).length} speakers`);

      await prisma.session.update({
        where: { id: sessionId },
        data: { roleIdentificationJson, roleIdDone: true }
      });
      console.log(`✅ [ANALYSIS-STEP-5] Role identification JSON stored in session`);

    } catch (roleIdError) {
      if (roleIdError instanceof PermanentFailureError) throw roleIdError;
      console.error('❌ [ROLE-ID-ERROR] Failed role identification:', roleIdError.message);
      throw new Error(`Failed role identification: ${roleIdError.message}`);
    }
  }

  // Quality gate — one fast LLM call; throws SessionQualityError if invalid
  console.log(`📊 [ANALYSIS-QUALITY-GATE] Validating session quality...`);
  await validateSessionQuality(utterances, session.durationSeconds, roleIdentificationJson, sessionId);
  console.log(`✅ [ANALYSIS-QUALITY-GATE] Session passed quality check`);

  // STEP 2: Apply PCIT coding to adult utterances (skip if already done on a previous attempt)
  let tagCounts = {
    echo: 0, labeled_praise: 0, unlabeled_praise: 0, praise: 0,
    product_praise: 0, action_praise: 0, growth_praise: 0, regulatory_praise: 0,
    narration: 0, direct_command: 0, indirect_command: 0, command: 0,
    question: 0, criticism: 0, neutral: 0
  };
  let codingResults = [];
  let adultSpeakersForPcit = adultSpeakers; // used in pcitCoding JSON below

  if (session.pcitCodingDone && session.pcitCoding && session.tagCounts) {
    console.log(`[ANALYSIS] Skipping PCIT coding — already completed (checkpoint)`);
    codingResults = session.pcitCoding.codingResults || [];
    tagCounts = session.tagCounts;
    adultSpeakersForPcit = session.pcitCoding.adultSpeakers || adultSpeakers;
  } else {
    // Get updated utterances for PCIT coding
    console.log(`📊 [ANALYSIS-STEP-6] Fetching updated utterances with roles for PCIT coding...`);
    const utterancesWithRoles = await getUtterances(sessionId);
    console.log(`✅ [ANALYSIS-STEP-6] Got ${utterancesWithRoles.length} utterances with roles`);

    // STEP 2: Apply PCIT coding to adult utterances
    console.log(`📊 [ANALYSIS-STEP-7] Preparing PCIT coding prompt...`);
    const adultSpeakerIds = adultSpeakers.map(a => a.id).join(', ');
    console.log(`   Adult speakers: ${adultSpeakerIds}`);

    // Load DPICS system prompt, with PDI-specific feedback override appended
    const dpicsSystemPrompt = loadPrompt('dpicsCoding-agentic-v10') + (!isCDI ? `

**PDI SESSION — Feedback Override for Commands:**
This is a PDI (Parent-Directed Interaction) session. The rules above apply for coding, but the feedback generation strategy for commands is different:
- **DC (Direct Command)**: DC is a TARGET SKILL in PDI. Do NOT suggest replacing it with a PRIDE skill. Instead, briefly reinforce it or coach on quality (e.g. was it direct, specific, calm, positively phrased?).
- **IC (Indirect Command)**: Still undesirable. Coach toward a DC instead (e.g. "Try stating it directly: 'Please put the block down.'"). Do NOT suggest using BD or LP.
All other feedback rules remain the same.` : '');

    // Prepare utterances data for the prompt
    const utterancesData = utterancesWithRoles.map((utt, idx) => ({
      id: idx,
      role: utt.role,
      text: utt.text
    }));

    // Create index mapping for later (idx -> utt.id)
    const idxToUttId = utterancesWithRoles.map(utt => utt.id);

    // User prompt — transcript only; system instruction and DPICS manual are in the cache
    const userPrompt = `Code every utterance where role is "adult". Skip all "child" entries.

${JSON.stringify(utterancesData, null, 2)}

Return a minified JSON array for adult utterances only:
[{"id": <int>, "code": <string>}, ...]
- Return ONLY the JSON array — no text, no markdown, no code fences
- First character MUST be [, last character MUST be ]
- Every adult entry MUST have "id" and "code"`;

    // DPICS context cache config — gateway resolves or creates the cache, falls back to inline prompt
    const dpicsCacheConfig = {
      key:         isCDI ? 'dpics-cdi' : 'dpics-pdi',
      primaryFile: DPICS_PDF_PATH,
      systemPrompt: dpicsSystemPrompt,
    };

    console.log(`📊 [ANALYSIS-STEP-8] Calling reasoning model for PCIT coding...`);
    console.log(`   Mode: ${isCDI ? 'CDI' : 'PDI'}, Utterances: ${utterancesWithRoles.length}`);

    codingResults = await llmCall(userPrompt, {
      profile: 'pcit-coding',
      cache:   dpicsCacheConfig,
      label:   'pcit-coding',
      sessionId,
    });

    if (!Array.isArray(codingResults)) {
      throw new Error('Expected array of coding results');
    }

    if (codingResults.length === 0) {
      throw new PermanentFailureError(
        'PCIT coding returned empty results',
        'We were unable to analyze the conversation in your recording. Please try recording again.'
      );
    }

    console.log(`✅ [ANALYSIS-STEP-8] Successfully parsed ${codingResults.length} coding results`);

    // Detect missed adult utterances (LLM sometimes stops early with a valid closed JSON array)
    const codedIdSet = new Set(codingResults.map(r => r.id));
    const missedAdultUtts = utterancesData.filter(u => u.role === 'adult' && !codedIdSet.has(u.id));
    if (missedAdultUtts.length > 0) {
      console.warn(`⚠️ [ANALYSIS-STEP-8] ${missedAdultUtts.length} adult utterances not coded — requesting supplemental coding...`);
      try {
        const supplementalPrompt = `These adult utterances were missed in the prior pass. Code each one and return ONLY a valid JSON array:

${JSON.stringify(missedAdultUtts, null, 2)}`;
        const supplementalResults = await llmCall(supplementalPrompt, {
          profile: 'pcit-coding-supplemental',
          cache:   dpicsCacheConfig,
          label:   'pcit-coding-supplemental',
          sessionId,
        });
        if (Array.isArray(supplementalResults) && supplementalResults.length > 0) {
          codingResults = [...codingResults, ...supplementalResults];
          console.log(`✅ [ANALYSIS-STEP-8] Supplemental coding added ${supplementalResults.length} results (total: ${codingResults.length})`);
        }
      } catch (suppErr) {
        console.warn(`⚠️ [ANALYSIS-STEP-8] Supplemental coding failed (non-blocking): ${suppErr.message}`);
      }
    }

    // Build ID-to-tag maps for efficient updates
    const pcitTagMap = {};
    const noraTagMap = {};

    for (const result of codingResults) {
      if (result.id !== undefined && result.code) {
        const actualUttId = idxToUttId[result.id];
        if (actualUttId) {
          pcitTagMap[actualUttId] = result.code;
          noraTagMap[actualUttId] = DPICS_TO_TAG_MAP[result.code] || result.code;
        }
      }
    }

    // Update utterances with PCIT tags and Nora tags in database
    await updateUtteranceTags(sessionId, pcitTagMap, noraTagMap);
    console.log(`Updated tags for ${Object.keys(pcitTagMap).length} utterances`);

    // Count codes from JSON results
    for (const result of codingResults) {
      const code = result.code;
      if (code === 'RF' || code === 'RQ') {
        tagCounts.echo++;
      } else if (code === 'LP' || code === 'LP1' || code === 'LP2' || code === 'LP3' || code === 'LP4') {
        tagCounts.labeled_praise++;
        tagCounts.praise++;
        if (code === 'LP1') tagCounts.product_praise++;
        else if (code === 'LP2') tagCounts.action_praise++;
        else if (code === 'LP3') tagCounts.growth_praise++;
        else if (code === 'LP4') tagCounts.regulatory_praise++;
        else tagCounts.product_praise++; // legacy LP treated as product praise
      } else if (code === 'UP') {
        tagCounts.unlabeled_praise++;
      } else if (code === 'BD') {
        tagCounts.narration++;
      } else if (code === 'DC') {
        tagCounts.direct_command++;
        tagCounts.command++;
      } else if (code === 'IC') {
        tagCounts.indirect_command++;
        tagCounts.command++;
      } else if (code === 'Q' || code === 'DQ' || code === 'IQ') {
        tagCounts.question++;
      } else if (code === 'NTA') {
        tagCounts.criticism++;
      } else if (code === 'ID' || code === 'AK' || code === 'TA' || code === 'AN') {
        tagCounts.neutral++;
      } else if (code === 'NC' || code === 'Uncoded') {
        // not counted toward any metric
      }
    }

    // Set PCIT coding checkpoint
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        pcitCoding: { adultSpeakers: adultSpeakersForPcit, codingResults, fullResponse: JSON.stringify(codingResults), analyzedAt: new Date().toISOString() },
        tagCounts,
        pcitCodingDone: true
      }
    });
    console.log(`✅ [ANALYSIS-STEP-8] PCIT coding checkpoint saved`);
  }

  // STEP 9: Child Profiling — parallel developmental + coaching calls
  console.log(`📊 [ANALYSIS-STEP-9] Generating child profiling (developmental + coaching in parallel)...`);
  let childProfilingResult = null;
  try {
    const utterancesForProfiling = await getUtterances(sessionId);
    const childSpeaker = getChildSpeaker(roleIdentificationJson);
    const [priorCompletedCount, existingChildMilestones] = await Promise.all([
      prisma.session.count({ where: { userId, analysisStatus: 'COMPLETED' } }),
      child ? prisma.childMilestone.findMany({
        where: { childId: child.id },
        include: { MilestoneLibrary: { select: { key: true } } }
      }) : Promise.resolve([])
    ]);
    const achievedMilestoneKeys = existingChildMilestones
      .filter(m => m.status === 'ACHIEVED')
      .map(m => m.MilestoneLibrary.key);
    const isFirstSession = priorCompletedCount === 0;
    const childInfoForProfiling = {
      name: childName,
      ageMonths: childAgeMonths,
      gender: childGender,
      clinicalPriority,
      isFirstSession,
      durationSeconds: session.durationSeconds || null,
      achievedMilestoneKeys,
      childId: child?.id || null,
      userId
    };

    const [profilingSettled, coachingSettled, aboutChildSettled] = await Promise.allSettled([
      generateDevelopmentalProfiling(utterancesForProfiling, childInfoForProfiling, tagCounts, childSpeaker, sessionId, primaryLanguage),
      isCDI ? generateCdiCoaching(utterancesForProfiling, childInfoForProfiling, tagCounts, childSpeaker, sessionId, primaryLanguage) : Promise.resolve(null),
      generateAboutChild(utterancesForProfiling, childInfoForProfiling, tagCounts, sessionId, primaryLanguage)
    ]);

    const profilingResult = profilingSettled.status === 'fulfilled' ? profilingSettled.value : null;
    const coachingResult = coachingSettled.status === 'fulfilled' ? coachingSettled.value : null;
    const aboutChildResult = aboutChildSettled.status === 'fulfilled' ? aboutChildSettled.value : null;

    if (profilingSettled.status === 'rejected') {
      console.error('⚠️ [ANALYSIS-STEP-9] Developmental profiling rejected:', profilingSettled.reason?.message);
    }
    if (coachingSettled.status === 'rejected') {
      console.error('⚠️ [ANALYSIS-STEP-9] CDI coaching rejected:', coachingSettled.reason?.message);
    }
    if (aboutChildSettled.status === 'rejected') {
      console.error('⚠️ [ANALYSIS-STEP-9] About child rejected:', aboutChildSettled.reason?.message);
    }

    // Merge into the same shape downstream code expects
    if (profilingResult || coachingResult) {
      childProfilingResult = {
        developmentalObservation: profilingResult?.developmentalObservation || null,
        metadata: profilingResult?.metadata || null,
        baselineAchieved: profilingResult?.baselineAchieved || [],
        coachingSummary: coachingResult?.coachingSummary || null,
        coachingCards: coachingResult?.coachingCards || null,
        tomorrowGoal: coachingResult?.tomorrowGoal || null,
        notifications: coachingResult?.notifications || null,
        aboutChild: aboutChildResult || null
      };
      console.log(`✅ [ANALYSIS-STEP-9] Child profiling complete — ${childProfilingResult.developmentalObservation?.domains?.length || 0} domains, ${childProfilingResult.coachingCards?.length || 0} coaching cards`);
    } else {
      console.log(`⚠️ [ANALYSIS-STEP-9] Child profiling skipped or both calls failed`);
    }
  } catch (profilingError) {
    console.error('⚠️ [ANALYSIS-STEP-9] Child profiling error:', profilingError.message);
  }

  // For non-English sessions, clear hardcoded English feedback from silence slots
  // so review-feedback can write localized feedback for the ones it selects.
  if (primaryLanguage && primaryLanguage !== 'eng') {
    await prisma.utterance.updateMany({
      where: { sessionId, speaker: SILENT_SPEAKER_ID },
      data: { feedback: null }
    });
    console.log(`🌐 [ANALYSIS] Cleared silence slot feedback for localization (language: ${primaryLanguage})`);
  }

  // Get competency analysis based on tag counts and utterances
  let competencyAnalysis = null;
  try {
    // Get updated utterances with tags from database
    const utterancesWithTags = await getUtterances(sessionId);

    // For PDI sessions, run Two Choices Flow analysis first so its output can inform review-feedback
    let pdiResult = null;
    if (!isCDI) {
      console.log('🎯 [COMPETENCY-ANALYSIS] Running PDI Two Choices Flow analysis...');
      pdiResult = await generatePDITwoChoicesAnalysis(utterancesWithTags, childName, sessionId, primaryLanguage);
      if (pdiResult) {
        console.log(`✅ [COMPETENCY-ANALYSIS] PDI Two Choices Flow analysis complete — ${pdiResult.pdiSkills.length} skills`);
      }
    }

    // Run multi-prompt feedback flow for both CDI and PDI (mode-aware)
    console.log(`🎯 [COMPETENCY-ANALYSIS] Using multi-prompt feedback generation for ${session.mode} session...`);
    const feedbackResult = await generateCDIFeedback(tagCounts, utterancesWithTags, childName, isCDI, pdiResult, sessionId, primaryLanguage);

    // Save revised feedback to database
    if (feedbackResult.revisedFeedback && feedbackResult.revisedFeedback.length > 0) {
      await updateRevisedFeedback(sessionId, feedbackResult.revisedFeedback);
    }

    competencyAnalysis = {
      topMoment: feedbackResult.topMoment,
      topMomentUtteranceNumber: typeof feedbackResult.topMomentUtteranceNumber === 'number' ? feedbackResult.topMomentUtteranceNumber : null,
      feedback: feedbackResult.feedback || null,
      example: typeof feedbackResult.example === 'number' ? feedbackResult.example : null,
      childReaction: feedbackResult.childReaction || null,
      tips: null,
      reminder: feedbackResult.reminder,
      activity: feedbackResult.activity || null,
      analyzedAt: new Date().toISOString(),
      mode: session.mode
    };

    console.log(`✅ [COMPETENCY-ANALYSIS] Multi-prompt feedback complete`);

    if (pdiResult) {
      competencyAnalysis.pdiSkills = pdiResult.pdiSkills;
      competencyAnalysis.pdiCommandSequences = pdiResult.commandSequences;
      competencyAnalysis.pdiTomorrowGoal = pdiResult.tomorrowGoal;
      competencyAnalysis.pdiEncouragement = pdiResult.encouragement;
      competencyAnalysis.pdiSummary = pdiResult.summary;
    }
  } catch (compError) {
    console.error('Error generating competency analysis:', compError.message);
  }

  // Calculate Nora Score
  const { score: overallScore } = calculateNoraScore(tagCounts, session.mode);

  // Store PCIT coding, competency analysis, and overall score in database
  console.log(`💾 [DATABASE-UPDATE] Saving competencyAnalysis for session ${sessionId}:`, competencyAnalysis ? 'present' : 'NULL');

  // Evaluate enrichment outcome
  const hasFeedback  = competencyAnalysis !== null;
  const hasProfiling = childProfilingResult !== null;
  const enrichmentStatus =
    hasFeedback && hasProfiling ? 'COMPLETED' :
    hasFeedback || hasProfiling ? 'PARTIAL'   : 'FAILED';
  const enrichmentError =
    enrichmentStatus !== 'COMPLETED'
      ? [!hasFeedback && 'competencyAnalysis', !hasProfiling && 'childProfiling'].filter(Boolean).join(', ') + ' failed'
      : null;
  if (enrichmentStatus !== 'COMPLETED') {
    console.warn(`⚠️ [ENRICHMENT] Session ${sessionId.substring(0, 8)} enrichmentStatus=${enrichmentStatus} — ${enrichmentError}`);
  }

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      competencyAnalysis,
      overallScore,
      coachingSummary: childProfilingResult?.coachingSummary || null,
      coachingCards: childProfilingResult?.coachingCards
        ? { sections: childProfilingResult.coachingCards, tomorrowGoal: childProfilingResult.tomorrowGoal || null, notifications: childProfilingResult.notifications || null }
        : null,
      aboutChild: childProfilingResult?.aboutChild || null,
      enrichmentStatus,
      enrichmentError
    }
  });

  // Upsert ChildProfiling record if profiling succeeded (child already fetched earlier)
  if (childProfilingResult?.developmentalObservation && child) {
    try {
      await prisma.childProfiling.upsert({
        where: { sessionId },
        create: {
          userId,
          sessionId,
          childId: child.id,
          summary: childProfilingResult.developmentalObservation.summary || null,
          domains: childProfilingResult.developmentalObservation.domains || [],
          metadata: childProfilingResult.metadata || null
        },
        update: {
          childId: child.id,
          summary: childProfilingResult.developmentalObservation.summary || null,
          domains: childProfilingResult.developmentalObservation.domains || [],
          metadata: childProfilingResult.metadata || null
        }
      });
      console.log(`✅ [DATABASE-UPDATE] ChildProfiling record upserted for session ${sessionId}`);

      // STEP 10: Milestone Detection (non-blocking) — uses keys detected by Prompt 1
      try {
        const { detectAndUpdateMilestones } = require('./milestoneDetectionService.cjs');
        const detectedMilestones = (childProfilingResult.developmentalObservation.domains || [])
          .flatMap(d => d.detected_milestone_keys || []);
        const milestoneResult = await detectAndUpdateMilestones(child.id, detectedMilestones, childProfilingResult.baselineAchieved);
        if (milestoneResult) {
          console.log(`✅ [ANALYSIS-STEP-10] Milestones: ${milestoneResult.newEmerging} emerging, ${milestoneResult.newAchieved} achieved`);

          // Store celebrations in session if any
          if (milestoneResult.celebrations && milestoneResult.celebrations.length > 0) {
            await prisma.session.update({
              where: { id: sessionId },
              data: { milestoneCelebrations: milestoneResult.celebrations }
            });
            console.log(`✅ [ANALYSIS-STEP-10] Stored ${milestoneResult.celebrations.length} milestone celebrations`);

            // Send milestone push notification (non-blocking)
            try {
              const { sendMilestoneNotification } = require('./pushNotifications.cjs');
              await sendMilestoneNotification(userId, milestoneResult.celebrations);
            } catch (notifError) {
              console.error('⚠️ [ANALYSIS-STEP-10] Milestone notification error (non-blocking):', notifError.message);
            }
          }
        }
      } catch (milestoneError) {
        console.error('⚠️ [ANALYSIS-STEP-10] Milestone detection error (non-blocking):', milestoneError.message);
      }
    } catch (profilingDbError) {
      console.error('⚠️ [DATABASE-UPDATE] Failed to upsert ChildProfiling:', profilingDbError.message);
    }
  }

  console.log(`✅ [DATABASE-UPDATE] PCIT coding and overall score (${overallScore}) stored for session ${sessionId}`);

  return { tagCounts, competencyAnalysis, overallScore, childProfilingResult };
}

module.exports = {
  SessionQualityError,
  PermanentFailureError,
  analyzePCITCoding,
  identifyRolesWithVoting,
  generateCDIFeedback,
  generatePDITwoChoicesAnalysis,
  generateDevelopmentalProfiling,
  generateCdiCoaching,
  generateAboutChild
};
