/**
 * Standalone test for PCIT audio analysis flow
 * Tests the complete pipeline without requiring a running server
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fetch = require('node-fetch');
const FormData = require('form-data');
const { PrismaClient } = require('@prisma/client');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const prisma = new PrismaClient();

const AUDIO_FILE = '/Users/mia/nora/audio2_anya_mama_papa.m4a';
const TEST_USER_ID = 'test-user-flow-' + Date.now();
const S3_BUCKET = process.env.AWS_S3_BUCKET;
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

// Import utility functions
const { parseElevenLabsTranscript, formatUtterancesAsText } = require('./server/utils/parseElevenLabsTranscript.cjs');

async function runFullAnalysis() {
  console.log('\n🎬 PCIT Audio Analysis - Full Flow Test');
  console.log('═'.repeat(70));
  console.log(`Audio file: ${AUDIO_FILE}`);
  console.log(`Mode: CDI (Child-Directed Interaction)`);
  console.log('═'.repeat(70));

  const sessionId = crypto.randomUUID();
  let startTime = Date.now();

  try {
    // ============================================================================
    // STEP 0: Create Test User
    // ============================================================================
    console.log('\n👤 STEP 0: Creating test user...');

    const testUser = await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: `test-${Date.now()}@example.com`,
        passwordHash: 'test-hash',
        name: 'Test User',
        childName: 'Anya',
        childBirthYear: 2020,
        childConditions: 'none'
      }
    });
    console.log(`   ✓ Test user created: ${TEST_USER_ID}`);

    // ============================================================================
    // STEP 1: Create Session & Upload Audio
    // ============================================================================
    console.log('\n📝 STEP 1: Creating session and uploading audio...');

    const audioBuffer = fs.readFileSync(AUDIO_FILE);
    const audioSize = (audioBuffer.length / 1024 / 1024).toFixed(2);
    console.log(`   File size: ${audioSize} MB`);

    const session = await prisma.session.create({
      data: {
        id: sessionId,
        userId: TEST_USER_ID,
        mode: 'CDI',
        storagePath: `test-audio/${sessionId}.m4a`,
        durationSeconds: 0,
        transcript: '',
        aiFeedbackJSON: {},
        pcitCoding: {},
        tagCounts: {},
        masteryAchieved: false,
        riskScore: 0,
        flaggedForReview: false
      }
    });
    console.log(`   ✓ Session created: ${sessionId}`);

    // ============================================================================
    // STEP 2: Transcribe with ElevenLabs
    // ============================================================================
    console.log('\n🎤 STEP 2: Transcribing with ElevenLabs...');
    console.log('   (This takes ~30-60 seconds)');

    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY not found in environment');
    }

    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: `${sessionId}.m4a`,
      contentType: 'audio/x-m4a'
    });
    formData.append('model_id', 'scribe_v1');
    formData.append('diarize', 'true');
    formData.append('timestamps_granularity', 'word');

    const transcribeStart = Date.now();
    const elevenLabsResponse = await fetch(
      'https://api.elevenlabs.io/v1/speech-to-text?include_timestamps=true',
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          ...formData.getHeaders()
        },
        body: formData
      }
    );

    if (!elevenLabsResponse.ok) {
      const errorData = await elevenLabsResponse.json().catch(() => ({}));
      throw new Error(`ElevenLabs error: ${errorData.detail?.message || elevenLabsResponse.status}`);
    }

    const elevenLabsResult = await elevenLabsResponse.json();
    const transcribeTime = ((Date.now() - transcribeStart) / 1000).toFixed(1);
    console.log(`   ✓ Transcription complete in ${transcribeTime}s`);

    // Parse and store results
    const utterances = parseElevenLabsTranscript(elevenLabsResult);
    const transcriptText = formatUtterancesAsText(utterances);

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        transcript: transcriptText,
        transcribedAt: new Date(),
        transcriptionService: 'elevenlabs',
        elevenLabsJson: elevenLabsResult
      }
    });

    // Create utterance records
    const utteranceRecords = utterances.map((utt, index) => ({
      sessionId,
      speaker: utt.speaker,
      text: utt.text,
      startTime: utt.start,
      endTime: utt.end,
      role: null,
      pcitTag: null,
      order: index
    }));

    await prisma.utterance.createMany({ data: utteranceRecords });
    console.log(`   ✓ Created ${utterances.length} utterance records`);

    // ============================================================================
    // STEP 3: Role Identification
    // ============================================================================
    console.log('\n👥 STEP 3: Identifying speaker roles (child/adult)...');
    console.log('   (This takes ~10-20 seconds)');

    const roleStart = Date.now();
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not found in environment');
    }

    const storedUtterances = await prisma.utterance.findMany({
      where: { sessionId },
      orderBy: { order: 'asc' }
    });

    const utterancesForPrompt = storedUtterances.map(u => ({
      speaker: u.speaker,
      text: u.text,
      start: u.startTime,
      end: u.endTime
    }));

    const rolePrompt = `You are an expert in child language development. Analyze this conversation and identify each speaker's role (CHILD or ADULT).

**INPUT DATA:**
${JSON.stringify(utterancesForPrompt, null, 2)}

**OUTPUT FORMAT (JSON only):**
{{
  "speaker_identification": {{
    "speaker_0": {{ "role": "CHILD" or "ADULT", "confidence": 0.0-1.0, "reasoning": "brief explanation" }},
    "speaker_1": {{ "role": "CHILD" or "ADULT", "confidence": 0.0-1.0, "reasoning": "brief explanation" }}
  }}
}}

Return ONLY valid JSON, no markdown.`;

    const roleResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        temperature: 0.3,
        messages: [{ role: 'user', content: rolePrompt }]
      })
    });

    if (!roleResponse.ok) {
      throw new Error(`Role identification failed: ${roleResponse.status}`);
    }

    const roleData = await roleResponse.json();
    const roleText = roleData.content[0].text.trim();
    const cleanJson = roleText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const roleResult = JSON.parse(cleanJson);

    const roleTime = ((Date.now() - roleStart) / 1000).toFixed(1);
    console.log(`   ✓ Role identification complete in ${roleTime}s`);

    // Update utterances with roles
    const roleMap = {};
    for (const [speakerId, speakerInfo] of Object.entries(roleResult.speaker_identification || {})) {
      roleMap[speakerId] = speakerInfo.role.toLowerCase();
      console.log(`   ${speakerId}: ${speakerInfo.role} (confidence: ${speakerInfo.confidence})`);
    }

    const updateRolePromises = Object.entries(roleMap).map(([speakerId, role]) =>
      prisma.utterance.updateMany({
        where: { sessionId, speaker: speakerId },
        data: { role }
      })
    );
    await Promise.all(updateRolePromises);

    await prisma.session.update({
      where: { id: sessionId },
      data: { roleIdentificationJson: roleResult }
    });

    // ============================================================================
    // STEP 4: PCIT Coding
    // ============================================================================
    console.log('\n🏷️  STEP 4: Applying PCIT coding tags...');
    console.log('   (This takes ~15-30 seconds)');

    const codingStart = Date.now();
    const utterancesWithRoles = await prisma.utterance.findMany({
      where: { sessionId },
      orderBy: { order: 'asc' }
    });

    // Load PCIT coding prompt from external file (same as recordings.cjs)
    const promptFilePath = path.join(__dirname, 'docs/prompt/prompt1_reformatted.txt');
    const promptTemplate = fs.readFileSync(promptFilePath, 'utf-8');

    // Parse system and user sections
    const parts = promptTemplate.split('---SYSTEM---');
    const systemPrompt = parts.length > 1 ? parts[0].trim() : '';
    const userPromptTemplate = parts.length > 1 ? parts[1].trim() : promptTemplate;

    // Prepare utterances data (input1.json format, using idx to save tokens)
    const utterancesData = utterancesWithRoles.map((u, idx) => ({
      id: idx,
      role: u.role,
      text: u.text
    }));

    // Create index mapping (idx -> u.id)
    const idxToUttId = utterancesWithRoles.map(u => u.id);

    // Replace template variables
    const codingPrompt = userPromptTemplate
      .replace(/\{\{data\}\}/g, JSON.stringify(utterancesData, null, 2))
      .replace(/\{\{batch_size\}\}/g, utterancesWithRoles.length.toString());

    const codingResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8192,
        temperature: 0,
        system: systemPrompt,
        messages: [{ role: 'user', content: codingPrompt }]
      })
    });

    if (!codingResponse.ok) {
      throw new Error(`PCIT coding failed: ${codingResponse.status}`);
    }

    const codingData = await codingResponse.json();
    const codingText = codingData.content[0].text.trim();
    const cleanCodingJson = codingText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const codingResults = JSON.parse(cleanCodingJson);

    const codingTime = ((Date.now() - codingStart) / 1000).toFixed(1);
    console.log(`   ✓ PCIT coding complete in ${codingTime}s`);

    // Map idx back to actual utterance IDs and update
    const updateTagPromises = codingResults.map(result => {
      const actualUttId = idxToUttId[result.id];
      return prisma.utterance.update({
        where: { id: actualUttId },
        data: { pcitTag: result.code }
      });
    });
    await Promise.all(updateTagPromises);
    console.log(`   ✓ Updated ${codingResults.length} utterances with tags`);

    // Count DPICS codes
    const tagCounts = {
      praise: 0, echo: 0, narration: 0,
      question: 0, command: 0, criticism: 0,
      negative_phrases: 0, neutral: 0
    };

    for (const result of codingResults) {
      const code = result.code;
      if (code === 'LP') {
        tagCounts.praise++;
      }
      else if (code === 'UP') {
        tagCounts.praise++;
      }
      else if (code === 'RF' || code === 'RQ') {
        tagCounts.echo++;
      }
      else if (code === 'BD') {
        tagCounts.narration++;
      }
      else if (code === 'Q') {
        tagCounts.question++;
      }
      else if (code === 'DC' || code === 'IC') {
        tagCounts.command++;
      }
      else if (code === 'NTA') {
        tagCounts.criticism++;
      }
      else if (code === 'ID' || code === 'AK') {
        tagCounts.neutral++;
      }
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        tagCounts,
        pcitCoding: {
          coding: codingText,
          analyzedAt: new Date().toISOString()
        }
      }
    });

    // ============================================================================
    // STEP 5: Competency Analysis
    // ============================================================================
    console.log('\n🎯 STEP 5: Generating competency analysis...');
    console.log('   (This takes ~10-20 seconds)');

    const compStart = Date.now();
    const finalUtterances = await prisma.utterance.findMany({
      where: { sessionId },
      orderBy: { order: 'asc' }
    });

    const totalDonts = tagCounts.question + tagCounts.command + tagCounts.criticism + tagCounts.negative_phrases;
    const totalDos = tagCounts.praise + tagCounts.echo + tagCounts.narration;

    const compPrompt = `You are a PCIT Supervisor. Analyze this session and provide feedback.

**Tag Counts:**
- Praise: ${tagCounts.praise}
- Echo: ${tagCounts.echo}
- Narration: ${tagCounts.narration}
- Questions: ${tagCounts.question}
- Commands: ${tagCounts.command}
- Criticisms: ${tagCounts.criticism}

Total DO skills: ${totalDos}
Total DON'T skills: ${totalDonts}

**Utterances with Tags:**
${JSON.stringify(finalUtterances.map(u => ({
  speaker: u.speaker,
  role: u.role,
  text: u.text,
  pcitTag: u.pcitTag
})), null, 2)}

**Output Format:**
{
  "topMoment": "exact quote showing bonding",
  "tips": "Exactly 2 sentences of specific tips.",
  "reminder": "Exactly 2 sentences of encouragement."
}

Return ONLY valid JSON, no markdown.`;

    const compResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        temperature: 0.7,
        messages: [{ role: 'user', content: compPrompt }]
      })
    });

    if (!compResponse.ok) {
      throw new Error(`Competency analysis failed: ${compResponse.status}`);
    }

    const compData = await compResponse.json();
    const compText = compData.content[0].text.trim();
    const cleanCompJson = compText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const competencyAnalysis = JSON.parse(cleanCompJson);

    const compTime = ((Date.now() - compStart) / 1000).toFixed(1);
    console.log(`   ✓ Competency analysis complete in ${compTime}s`);

    // Calculate overall score
    const praiseScore = Math.min(20, (tagCounts.praise / 10) * 20);
    const echoScore = Math.min(20, (tagCounts.echo / 10) * 20);
    const narrationScore = Math.min(20, (tagCounts.narration / 10) * 20);
    const penScore = praiseScore + echoScore + narrationScore;

    let avoidScore = 40;
    if (totalDonts >= 3) {
      avoidScore = Math.max(0, 40 - (totalDonts - 2) * 10);
    }

    const overallScore = Math.round(penScore + avoidScore);

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        competencyAnalysis: {
          ...competencyAnalysis,
          analyzedAt: new Date().toISOString(),
          mode: 'CDI'
        },
        overallScore
      }
    });

    // ============================================================================
    // RESULTS
    // ============================================================================
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '═'.repeat(70));
    console.log('✅ ANALYSIS COMPLETE');
    console.log('═'.repeat(70));
    console.log(`\n⏱️  Total processing time: ${totalTime}s`);
    console.log(`📊 Session ID: ${sessionId}`);

    console.log('\n📈 PCIT Tag Counts:');
    console.log(`   DO Skills (PEN):`);
    console.log(`     Praise: ${tagCounts.praise}`);
    console.log(`     Echo: ${tagCounts.echo}`);
    console.log(`     Narration: ${tagCounts.narration}`);
    console.log(`   DON'T Skills:`);
    console.log(`     Questions: ${tagCounts.question}`);
    console.log(`     Commands: ${tagCounts.command}`);
    console.log(`     Criticism: ${tagCounts.criticism}`);
    console.log(`     Negative Phrases: ${tagCounts.negative_phrases}`);
    console.log(`   Neutral: ${tagCounts.neutral}`);

    console.log(`\n⭐ Overall Score: ${overallScore}/100`);

    console.log('\n💬 Competency Analysis:');
    console.log(`   Top Moment: "${competencyAnalysis.topMoment}"`);
    console.log(`   Tips: ${competencyAnalysis.tips}`);
    console.log(`   Reminder: ${competencyAnalysis.reminder}`);

    console.log('\n📝 Sample Tagged Utterances:');
    const adultUtts = finalUtterances.filter(u => u.role === 'adult').slice(0, 5);
    adultUtts.forEach((utt, idx) => {
      console.log(`\n   ${idx + 1}. [${utt.pcitTag}]`);
      console.log(`      "${utt.text}"`);
    });

    console.log('\n' + '═'.repeat(70));
    console.log('🎉 Test completed successfully!');
    console.log('═'.repeat(70));

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
runFullAnalysis().catch(console.error);
