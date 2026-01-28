const prisma = require("../server/services/db.cjs");
const { generatePsychologistFeedback, extractChildPortfolioInsights } = require("../server/services/pcitAnalysisService.cjs");
const { getUtterances } = require("../server/utils/utteranceUtils.cjs");
const { decryptSensitiveData } = require("../server/utils/encryption.cjs");

const sessionId = "ba0af448-7d6c-4d1c-b89a-c00cc45ce8d1";

// Helper to format elapsed time
function formatElapsed(startTime) {
  return ((Date.now() - startTime) / 1000).toFixed(2) + 's';
}

async function run() {
  console.log('='.repeat(60));
  console.log('Testing Gemini Psychologist Feedback (Streaming)');
  console.log('='.repeat(60));
  const totalStart = Date.now();
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { User: true }
  });

  if (!session) {
    console.log("❌ Session not found");
    return;
  }

  console.log("✅ Session found");

  const childName = session.User?.childName ? decryptSensitiveData(session.User.childName) : "the child";
  const childGender = session.User?.childGender === "BOY" ? "boy" : session.User?.childGender === "GIRL" ? "girl" : "child";
  const tagCounts = session.tagCounts || {};
  const roleIdentificationJson = session.roleIdentificationJson || {};

  // Calculate age in months
  let childAgeMonths = null;
  if (session.User?.childBirthday) {
    const today = new Date();
    const birthDate = new Date(session.User.childBirthday);
    childAgeMonths = (today.getFullYear() - birthDate.getFullYear()) * 12 + (today.getMonth() - birthDate.getMonth());
  } else if (session.User?.childBirthYear) {
    childAgeMonths = (new Date().getFullYear() - session.User.childBirthYear) * 12;
  }

  // Get child speaker from role identification
  let childSpeaker = null;
  const speakerIdentification = roleIdentificationJson?.speaker_identification || {};
  for (const [speakerId, info] of Object.entries(speakerIdentification)) {
    if (info.role === "CHILD") {
      childSpeaker = speakerId;
      break;
    }
  }

  console.log("👶 Child:", childName, childAgeMonths, "months,", childGender);
  console.log("📊 Tag counts:", JSON.stringify(tagCounts));
  console.log("🎭 Child speaker:", childSpeaker);

  const utterances = await getUtterances(sessionId);
  console.log("📝 Utterances:", utterances.length);

  console.log("\n🧠 [Step 1/2] Calling generatePsychologistFeedback (streaming)...");
  const step1Start = Date.now();
  const chatHistory = await generatePsychologistFeedback(utterances, {
    name: childName,
    ageMonths: childAgeMonths,
    gender: childGender
  }, tagCounts, childSpeaker);

  if (!chatHistory) {
    console.log("❌ Failed to generate chat history");
    return;
  }
  console.log(`✅ Chat history generated in ${formatElapsed(step1Start)}`);
  console.log(`   Response length: ${chatHistory[1]?.parts?.[0]?.text?.length || 0} chars`);

  console.log("\n📊 [Step 2/2] Calling extractChildPortfolioInsights (streaming)...");
  const step2Start = Date.now();
  const insights = await extractChildPortfolioInsights(chatHistory);

  if (!insights) {
    console.log("❌ Failed to extract insights");
    return;
  }

  console.log(`✅ Insights extracted in ${formatElapsed(step2Start)}`);
  console.log(`   Number of insights: ${Array.isArray(insights) ? insights.length : 'N/A'}`);

  console.log("\n" + '='.repeat(60));
  console.log(`Total time: ${formatElapsed(totalStart)}`);
  console.log('='.repeat(60));

  console.log("\n📋 Portfolio Insights:");
  console.log(JSON.stringify(insights, null, 2));

  await prisma.session.update({
    where: { id: sessionId },
    data: { childPortfolioInsights: insights }
  });

  console.log("\n💾 Saved to database!");
}

run().catch(e => console.error("Error:", e.message)).finally(() => prisma.$disconnect());
