/**
 * Script to run extractAboutChild for a specific session
 */
const prisma = require('../server/services/db.cjs');
const { generatePsychologistFeedback, extractAboutChild } = require('../server/services/pcitAnalysisService.cjs');
const { getUtterances } = require('../server/utils/utteranceUtils.cjs');
const { decryptSensitiveData } = require('../server/utils/encryption.cjs');

async function main() {
  const sessionId = process.argv[2] || '6974af24-e760-4066-82ee-38e5dbfda190';

  // Get session
  const session = await prisma.session.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    console.error('Session not found');
    process.exit(1);
  }

  console.log('Session found:', session.id);

  // Get user info
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      childName: true,
      childGender: true,
      childBirthYear: true,
      childBirthday: true
    }
  });

  const childName = user?.childName ? decryptSensitiveData(user.childName) : 'the child';
  const childGender = user?.childGender?.toLowerCase() || 'child';

  // Calculate age in months
  let childAgeMonths = null;
  if (user?.childBirthday) {
    const today = new Date();
    const birthDate = new Date(user.childBirthday);
    childAgeMonths = (today.getFullYear() - birthDate.getFullYear()) * 12 + (today.getMonth() - birthDate.getMonth());
  } else if (user?.childBirthYear) {
    childAgeMonths = (new Date().getFullYear() - user.childBirthYear) * 12;
  }

  console.log('Child info:', { childName, childAgeMonths, childGender });

  // Get utterances
  const utterances = await getUtterances(sessionId);
  console.log('Utterances count:', utterances.length);

  // Get child speaker from role identification
  const roleIdentificationJson = session.roleIdentificationJson;
  let childSpeaker = null;
  if (roleIdentificationJson?.speaker_identification) {
    for (const [speakerId, info] of Object.entries(roleIdentificationJson.speaker_identification)) {
      if (info.role === 'CHILD') {
        childSpeaker = speakerId;
        break;
      }
    }
  }
  console.log('Child speaker:', childSpeaker);

  // Generate psychologist feedback
  console.log('\nGenerating psychologist feedback...');
  const chatHistory = await generatePsychologistFeedback(
    utterances,
    { name: childName, ageMonths: childAgeMonths, gender: childGender },
    session.tagCounts || {},
    childSpeaker
  );

  if (!chatHistory) {
    console.error('Failed to generate psychologist feedback');
    process.exit(1);
  }

  console.log('Chat history generated, messages:', chatHistory.length);

  // Extract about child
  console.log('\nExtracting about child observations...');
  const aboutChild = await extractAboutChild(chatHistory);

  if (!aboutChild) {
    console.error('Failed to extract about child');
    process.exit(1);
  }

  console.log('\nAbout Child extracted:', JSON.stringify(aboutChild, null, 2));

  // Store in database
  await prisma.session.update({
    where: { id: sessionId },
    data: { aboutChild }
  });

  console.log('\n✅ Successfully stored aboutChild in database');

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
