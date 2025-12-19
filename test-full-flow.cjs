/**
 * Test script for complete PCIT analysis flow
 * Tests: Upload → Transcription → Role ID → PCIT Coding → Competency Analysis
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const storage = require('./server/services/storage-s3.cjs');

const prisma = new PrismaClient();

const AUDIO_FILE = '/Users/mia/nora/audio2_anya_mama_papa.m4a';
const TEST_USER_ID = 'test-user-' + crypto.randomBytes(4).toString('hex');

async function testFullFlow() {
  console.log('🎬 Starting Full PCIT Analysis Flow Test\n');
  console.log('═'.repeat(60));

  try {
    // Step 1: Read audio file
    console.log('\n📁 Step 1: Reading audio file...');
    if (!fs.existsSync(AUDIO_FILE)) {
      throw new Error(`Audio file not found: ${AUDIO_FILE}`);
    }

    const audioBuffer = fs.readFileSync(AUDIO_FILE);
    const audioStats = fs.statSync(AUDIO_FILE);
    console.log(`   ✓ File loaded: ${(audioStats.size / 1024 / 1024).toFixed(2)} MB`);

    // Step 2: Create session
    console.log('\n📝 Step 2: Creating session record...');
    const sessionId = crypto.randomUUID();
    const session = await prisma.session.create({
      data: {
        id: sessionId,
        userId: TEST_USER_ID,
        mode: 'CDI',
        storagePath: 'uploading',
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

    // Step 3: Upload to S3
    console.log('\n☁️  Step 3: Uploading to S3...');
    const storagePath = await storage.uploadAudioFile(
      audioBuffer,
      TEST_USER_ID,
      sessionId,
      'audio/x-m4a'
    );

    await prisma.session.update({
      where: { id: sessionId },
      data: { storagePath }
    });
    console.log(`   ✓ Uploaded: ${storagePath}`);

    // Step 4: Transcription
    console.log('\n🎤 Step 4: Starting transcription with ElevenLabs...');
    console.log('   This may take 30-60 seconds...');

    // Import the transcribeRecording function
    // We'll need to extract it or call it via API
    // For now, let's call the API endpoint
    const fetch = require('node-fetch');

    // Trigger transcription
    const transcribeResponse = await fetch(`http://localhost:3000/api/recordings/${sessionId}/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!transcribeResponse.ok) {
      const error = await transcribeResponse.text();
      throw new Error(`Transcription failed: ${error}`);
    }

    const transcribeResult = await transcribeResponse.json();
    console.log(`   ✓ Transcription complete: ${transcribeResult.segments?.length || 0} segments`);

    // Wait a bit for background processing to complete
    console.log('\n⏳ Step 5: Waiting for role identification and PCIT coding...');
    console.log('   This may take 60-90 seconds...');

    await new Promise(resolve => setTimeout(resolve, 5000)); // Initial wait

    // Poll for completion
    let attempts = 0;
    let analysisComplete = false;

    while (attempts < 30 && !analysisComplete) {
      await new Promise(resolve => setTimeout(resolve, 3000));

      const updatedSession = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { Utterance: true }
      });

      const hasRoles = updatedSession.Utterance.some(u => u.role !== null);
      const hasTags = updatedSession.Utterance.some(u => u.pcitTag !== null);
      const hasCompetency = updatedSession.competencyAnalysis !== null;

      console.log(`   Attempt ${attempts + 1}: Roles=${hasRoles}, Tags=${hasTags}, Competency=${hasCompetency}`);

      if (hasRoles && hasTags && hasCompetency) {
        analysisComplete = true;
      }

      attempts++;
    }

    if (!analysisComplete) {
      console.log('\n   ⚠️  Analysis taking longer than expected, fetching current state...');
    }

    // Step 6: Fetch and display results
    console.log('\n📊 Step 6: Fetching analysis results...');

    const finalSession = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { Utterance: { orderBy: { order: 'asc' } } }
    });

    console.log('\n' + '═'.repeat(60));
    console.log('📈 ANALYSIS RESULTS');
    console.log('═'.repeat(60));

    // Display transcription info
    console.log('\n🎤 Transcription:');
    console.log(`   Service: ${finalSession.transcriptionService || 'N/A'}`);
    console.log(`   Utterances: ${finalSession.Utterance.length}`);
    console.log(`   Transcribed at: ${finalSession.transcribedAt || 'N/A'}`);

    // Display role identification
    console.log('\n👥 Role Identification:');
    const roleStats = finalSession.Utterance.reduce((acc, u) => {
      acc[u.role || 'unknown'] = (acc[u.role || 'unknown'] || 0) + 1;
      return acc;
    }, {});
    Object.entries(roleStats).forEach(([role, count]) => {
      console.log(`   ${role}: ${count} utterances`);
    });

    // Display PCIT coding
    console.log('\n🏷️  PCIT Coding (Tag Counts):');
    const tagCounts = finalSession.tagCounts || {};
    console.log(JSON.stringify(tagCounts, null, 2));

    // Display competency analysis
    console.log('\n🎯 Competency Analysis:');
    if (finalSession.competencyAnalysis) {
      const comp = finalSession.competencyAnalysis;
      console.log(`   Top Moment: "${comp.topMoment}"`);
      console.log(`   Tips: ${comp.tips}`);
      console.log(`   Reminder: ${comp.reminder}`);
    } else {
      console.log('   ⚠️  Not yet complete');
    }

    // Display overall score
    console.log('\n⭐ Overall Score:');
    console.log(`   ${finalSession.overallScore || 'N/A'}/100`);

    // Display sample utterances with tags
    console.log('\n📝 Sample Utterances (first 5 adult utterances):');
    const adultUtterances = finalSession.Utterance.filter(u => u.role === 'adult').slice(0, 5);
    adultUtterances.forEach((utt, idx) => {
      console.log(`\n   ${idx + 1}. [${utt.pcitTag || 'No tag'}]`);
      console.log(`      "${utt.text}"`);
    });

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Test Complete!');
    console.log('═'.repeat(60));
    console.log(`\nSession ID: ${sessionId}`);
    console.log(`View in database: SELECT * FROM "Session" WHERE id = '${sessionId}';`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testFullFlow().catch(console.error);
