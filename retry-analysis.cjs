/**
 * Manually retry PCIT analysis for a failed session
 */

const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');

const prisma = new PrismaClient();

const SESSION_ID = '7914e3cb-7778-4cac-97fb-e6b4ec20faf8'; // The failed session

// Copy the helper functions from recordings.cjs
async function getUtterances(sessionId) {
  return await prisma.utterance.findMany({
    where: { sessionId },
    orderBy: { order: 'asc' }
  });
}

async function updateUtteranceRoles(sessionId, roleMap) {
  const updatePromises = Object.entries(roleMap).map(([speakerId, role]) => {
    return prisma.utterance.updateMany({
      where: { sessionId, speaker: speakerId },
      data: { role }
    });
  });

  await Promise.all(updatePromises);
}

async function updateUtteranceTags(sessionId, tagMap) {
  const updatePromises = [];

  for (const [utteranceId, tag] of Object.entries(tagMap)) {
    updatePromises.push(
      prisma.utterance.update({
        where: { id: utteranceId },
        data: { pcitTag: tag }
      })
    );
  }

  await Promise.all(updatePromises);
}

async function retryAnalysis() {
  console.log('\n🔄 Retrying PCIT Analysis');
  console.log(`Session: ${SESSION_ID}\n`);

  try {
    const session = await prisma.session.findUnique({
      where: { id: SESSION_ID }
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const userId = session.userId;
    const sessionId = session.id;
    const isCDI = session.mode === 'CDI';

    console.log(`Mode: ${session.mode}`);
    console.log(`User: ${userId}`);

    // Step 1: Get utterances
    console.log('\n📝 Step 1: Getting utterances...');
    const utterances = await getUtterances(sessionId);

    if (utterances.length === 0) {
      throw new Error('No utterances found');
    }

    console.log(`   Found ${utterances.length} utterances`);

    // Step 2: Role Identification
    console.log('\n👥 Step 2: Role identification...');

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not found');
    }

    const utterancesForPrompt = utterances.map(u => ({
      speaker: u.speaker,
      text: u.text,
      start: u.startTime,
      end: u.endTime
    }));

    const identifyPrompt = `Identify speaker roles (CHILD/ADULT) for this conversation.

INPUT: ${JSON.stringify(utterancesForPrompt.slice(0, 10), null, 2)}

OUTPUT (JSON only):
{"speaker_identification": {"speaker_0": {"role": "CHILD", "confidence": 0.95}}}`;

    console.log('   Calling Claude API for role identification...');

    const roleResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        temperature: 0.3,
        messages: [{ role: 'user', content: identifyPrompt }]
      })
    });

    if (!roleResponse.ok) {
      const errorText = await roleResponse.text();
      throw new Error(`Role API failed (${roleResponse.status}): ${errorText}`);
    }

    const roleData = await roleResponse.json();
    const roleText = roleData.content[0].text.trim();
    console.log('   Raw response:', roleText.substring(0, 200));

    const cleanJson = roleText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const roleResult = JSON.parse(cleanJson);

    console.log('   ✓ Role identification successful');
    console.log('   Result:', JSON.stringify(roleResult, null, 2));

    // Update roles
    const roleMap = {};
    for (const [speakerId, speakerInfo] of Object.entries(roleResult.speaker_identification || {})) {
      roleMap[speakerId] = speakerInfo.role.toLowerCase();
    }

    await updateUtteranceRoles(sessionId, roleMap);
    await prisma.session.update({
      where: { id: sessionId },
      data: { roleIdentificationJson: roleResult }
    });

    console.log('   ✓ Roles updated in database');

    console.log('\n✅ Analysis retry completed successfully!');
    console.log('Run get-latest-session.cjs to verify');

  } catch (error) {
    console.error('\n❌ Retry failed:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

retryAnalysis();
