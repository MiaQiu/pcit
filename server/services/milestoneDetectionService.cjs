/**
 * Milestone Detection Service
 * After each session's ChildProfiling is saved, calls Gemini Flash to map
 * developmental observations (domains JSON) to MilestoneLibrary entries,
 * then creates/updates ChildMilestone records.
 *
 * First detection = EMERGING
 * After appearing in > thresholdValue sessions = ACHIEVED
 */
const fetch = require('node-fetch');
const prisma = require('./db.cjs');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ============================================================================
// Gemini Flash Helper (non-streaming, fast model)
// ============================================================================

/**
 * Call Gemini Flash for milestone detection
 * @param {string} prompt - The prompt text
 * @returns {Promise<string>} The response text
 */
async function callGeminiFlash(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Gemini Flash API error: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Empty response from Gemini Flash API');
  }

  return text;
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Calculate child's age in months from birthday or birth year
 * @param {Date} birthday
 * @param {number} birthYear (fallback)
 * @returns {number|null}
 */
function calculateAgeInMonths(birthday, birthYear) {
  const today = new Date();
  if (birthday) {
    const birthDate = new Date(birthday);
    return (today.getFullYear() - birthDate.getFullYear()) * 12 + (today.getMonth() - birthDate.getMonth());
  }
  if (birthYear) {
    return (today.getFullYear() - birthYear) * 12;
  }
  return null;
}

/**
 * Detect milestones from a session's child profiling and update ChildMilestone records
 * @param {string} childId - The Child record ID
 * @param {string} sessionId - The Session ID (used to find the ChildProfiling)
 * @returns {Promise<{detected: number, newEmerging: number, newAchieved: number}|null>}
 */
async function detectAndUpdateMilestones(childId, sessionId) {
  // 1. Load ChildProfiling for this session
  const profiling = await prisma.childProfiling.findUnique({
    where: { sessionId }
  });

  if (!profiling || !profiling.domains) {
    console.log(`⚠️ [MILESTONE] No profiling found for session ${sessionId.substring(0, 8)}, skipping`);
    return null;
  }

  // 2. Load Child record (for age calculation)
  const child = await prisma.child.findUnique({
    where: { id: childId },
    include: { User: { select: { childBirthYear: true, childBirthday: true } } }
  });

  if (!child) {
    console.log(`⚠️ [MILESTONE] Child ${childId.substring(0, 8)} not found, skipping`);
    return null;
  }

  const ageMonths = calculateAgeInMonths(
    child.birthday || child.User?.childBirthday,
    child.User?.childBirthYear
  );

  // 3. Load all MilestoneLibrary entries
  const milestones = await prisma.milestoneLibrary.findMany();

  if (milestones.length === 0) {
    console.log(`⚠️ [MILESTONE] No milestones in library, skipping`);
    return null;
  }

  // 4. Load existing ChildMilestone records for this child
  const existingMilestones = await prisma.childMilestone.findMany({
    where: { childId },
    include: { MilestoneLibrary: { select: { key: true } } }
  });

  const existingByKey = {};
  for (const em of existingMilestones) {
    existingByKey[em.MilestoneLibrary.key] = em;
  }

  // 5. Build prompt
  const milestoneList = milestones.map(m => ({
    key: m.key,
    category: m.category,
    stage: m.groupingStage,
    title: m.displayTitle,
    mode: m.detectionMode,
    ageRange: `${m.medianAgeMonths}-${m.mastery90AgeMonths}mo`
  }));

  const existingList = existingMilestones.map(em => ({
    key: em.MilestoneLibrary.key,
    status: em.status
  }));

  const achievedKeys = existingList.filter(e => e.status === 'ACHIEVED').map(e => e.key);

  // Determine if this is the first profiling (no existing milestone records)
  const isFirstProfiling = existingMilestones.length === 0;

  const baselineInstructions = isFirstProfiling ? `

FIRST SESSION — BASELINE ASSESSMENT:
This is the child's FIRST profiling session. In addition to detecting emerging milestones,
you must also identify basic milestones that this child has CLEARLY ALREADY MASTERED based on:
- The child's age (${ageMonths} months) — milestones with mastery_90_age well below the child's age
- Clear evidence in the observations (e.g. if a 29-month-old uses 2-word sentences, earlier language milestones are achieved)
- Only mark as baseline_achieved if the milestone's mastery_90_age is at or below the child's current age AND the session shows evidence

Return these in a separate "baseline_achieved" array.` : '';

  const prompt = `You are a child development specialist. Analyze the following developmental observations from a play therapy session and match them to developmental milestones.

CHILD AGE: ${ageMonths !== null ? `${ageMonths} months` : 'unknown'}

DEVELOPMENTAL OBSERVATIONS (from session profiling):
${JSON.stringify(profiling.domains, null, 2)}

MILESTONE LIBRARY (available milestones to match against):
${JSON.stringify(milestoneList, null, 2)}

ALREADY ACHIEVED MILESTONES (skip these, never downgrade):
${achievedKeys.length > 0 ? JSON.stringify(achievedKeys) : '[]'}

INSTRUCTIONS:
- Match the developmental observations to milestone keys from the library
- Only include milestones where there is clear evidence in the observations
- Skip any milestones already in the ACHIEVED list
- Consider the child's age when matching - milestones should be age-appropriate
- For each match, provide a brief evidence summary (1-2 sentences)
- "detected_milestones" = milestones the child is currently developing (EMERGING)${baselineInstructions}

Return ONLY valid JSON in this exact format (no markdown fences):
{
  "detected_milestones": [
    {
      "milestone_key": "the_milestone_key",
      "evidence_summary": "Brief description of evidence from observations"
    }
  ]${isFirstProfiling ? `,
  "baseline_achieved": [
    {
      "milestone_key": "the_milestone_key",
      "evidence_summary": "Why this milestone is clearly already mastered"
    }
  ]` : ''}
}

If no milestones are detected, return: { "detected_milestones": []${isFirstProfiling ? ', "baseline_achieved": []' : ''} }`;

  // 6. Call Gemini Flash
  console.log(`🔍 [MILESTONE] Calling Gemini Flash for milestone detection (child ${childId.substring(0, 8)}, session ${sessionId.substring(0, 8)})...`);
  const responseText = await callGeminiFlash(prompt);

  // 7. Parse JSON response
  const cleaned = responseText
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseError) {
    console.error('❌ [MILESTONE] JSON parse error. Raw (first 300 chars):', cleaned.substring(0, 300));
    throw parseError;
  }

  const detectedMilestones = parsed.detected_milestones || [];
  console.log(`🔍 [MILESTONE] Detected ${detectedMilestones.length} milestones`);

  // Build key -> milestoneLibrary id map
  const keyToMilestone = {};
  for (const m of milestones) {
    keyToMilestone[m.key] = m;
  }

  // 8. Process each detected milestone
  let newEmerging = 0;
  let newAchieved = 0;
  const celebrations = []; // Track celebrations for this session

  for (const detected of detectedMilestones) {
    const milestoneKey = detected.milestone_key;
    const libraryEntry = keyToMilestone[milestoneKey];

    if (!libraryEntry) {
      console.warn(`⚠️ [MILESTONE] Unknown milestone key: ${milestoneKey}, skipping`);
      continue;
    }

    const existing = existingByKey[milestoneKey];

    if (!existing) {
      // No existing row → create with EMERGING
      await prisma.childMilestone.create({
        data: {
          childId,
          milestoneId: libraryEntry.id,
          status: 'EMERGING',
          firstObservedAt: new Date()
        }
      });
      newEmerging++;
      celebrations.push({
        status: 'EMERGING',
        category: libraryEntry.category,
        title: libraryEntry.displayTitle,
        actionTip: libraryEntry.actionTip
      });
      console.log(`  ✨ [MILESTONE] NEW EMERGING: ${milestoneKey} — ${detected.evidence_summary}`);
    } else if (existing.status === 'EMERGING') {
      // Existing EMERGING → check if threshold reached
      const sessionCountSinceFirst = await prisma.childProfiling.count({
        where: {
          childId,
          createdAt: { gte: existing.firstObservedAt }
        }
      });

      if (sessionCountSinceFirst > libraryEntry.thresholdValue) {
        // Threshold exceeded → promote to ACHIEVED
        await prisma.childMilestone.update({
          where: { id: existing.id },
          data: {
            status: 'ACHIEVED',
            achievedAt: new Date()
          }
        });
        newAchieved++;
        celebrations.push({
          status: 'ACHIEVED',
          category: libraryEntry.category,
          title: libraryEntry.displayTitle,
          actionTip: libraryEntry.actionTip
        });
        console.log(`  🏆 [MILESTONE] ACHIEVED: ${milestoneKey} (${sessionCountSinceFirst} sessions > threshold ${libraryEntry.thresholdValue})`);
      } else {
        console.log(`  📊 [MILESTONE] Still EMERGING: ${milestoneKey} (${sessionCountSinceFirst}/${libraryEntry.thresholdValue} sessions)`);
      }
    } else if (existing.status === 'ACHIEVED') {
      // Already achieved → skip (never downgrade)
      continue;
    }
  }

  // 9. Process baseline achieved milestones (first profiling only)
  const baselineAchieved = parsed.baseline_achieved || [];
  let newBaselineAchieved = 0;

  if (isFirstProfiling && baselineAchieved.length > 0) {
    console.log(`🎯 [MILESTONE] First profiling — processing ${baselineAchieved.length} baseline achieved milestones`);

    for (const baseline of baselineAchieved) {
      const milestoneKey = baseline.milestone_key;
      const libraryEntry = keyToMilestone[milestoneKey];

      if (!libraryEntry) {
        console.warn(`⚠️ [MILESTONE] Unknown baseline milestone key: ${milestoneKey}, skipping`);
        continue;
      }

      // Skip if already created as EMERGING above
      const alreadyCreated = existingByKey[milestoneKey] ||
        detectedMilestones.some(d => d.milestone_key === milestoneKey);

      if (alreadyCreated) {
        // If we just created it as EMERGING, upgrade to ACHIEVED
        const justCreated = await prisma.childMilestone.findUnique({
          where: { childId_milestoneId: { childId, milestoneId: libraryEntry.id } }
        });
        if (justCreated && justCreated.status === 'EMERGING') {
          await prisma.childMilestone.update({
            where: { id: justCreated.id },
            data: { status: 'ACHIEVED', achievedAt: new Date() }
          });
          newBaselineAchieved++;
          newEmerging--; // correct the emerging count
          console.log(`  🏆 [MILESTONE] BASELINE ACHIEVED (upgraded): ${milestoneKey}`);
        }
        continue;
      }

      await prisma.childMilestone.create({
        data: {
          childId,
          milestoneId: libraryEntry.id,
          status: 'ACHIEVED',
          firstObservedAt: new Date(),
          achievedAt: new Date()
        }
      });
      newBaselineAchieved++;
      celebrations.push({
        status: 'ACHIEVED',
        category: libraryEntry.category,
        title: libraryEntry.displayTitle,
        actionTip: libraryEntry.actionTip
      });
      console.log(`  🏆 [MILESTONE] BASELINE ACHIEVED: ${milestoneKey} — ${baseline.evidence_summary}`);
    }
  }

  newAchieved += newBaselineAchieved;

  const result = {
    detected: detectedMilestones.length + baselineAchieved.length,
    newEmerging,
    newAchieved,
    celebrations
  };

  console.log(`✅ [MILESTONE] Detection complete: ${result.detected} detected, ${result.newEmerging} new emerging, ${result.newAchieved} new achieved, ${celebrations.length} celebrations`);
  return result;
}

module.exports = {
  detectAndUpdateMilestones,
  callGeminiFlash
};
