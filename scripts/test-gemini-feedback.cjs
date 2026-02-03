const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
require('dotenv').config();

async function test() {
  const sessionId = 'a045e4a6-6c66-46b5-805a-36de8db4f021';

  // Get session with user info
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { User: true }
  });

  if (!session) {
    console.log('Session not found');
    return;
  }

  // Get utterances
  const utterances = await prisma.utterance.findMany({
    where: { sessionId },
    orderBy: { order: 'asc' }
  });

  // Decrypt child name
  const { decryptSensitiveData } = require('../server/utils/encryption.cjs');
  const childName = session.User?.childName ? decryptSensitiveData(session.User.childName) : 'the child';
  const childGender = session.User?.childGender || 'BOY';
  const childBirthYear = session.User?.childBirthYear || 2022;
  const age = new Date().getFullYear() - childBirthYear;

  console.log('Child:', childName, age, 'years old,', childGender);
  console.log('Utterances:', utterances.length);

  // Format transcript
  const transcript = utterances
    .filter(u => u.speaker !== '__SILENT__')
    .map(u => {
      const role = u.role === 'adult' ? 'Parent' : u.role === 'child' ? 'Child' : u.speaker;
      return role + ': ' + u.text;
    }).join('\n');

  console.log('\n--- Transcript Preview ---');
  console.log(transcript.substring(0, 800) + '...\n');

  // Call Gemini
  const gender = childGender === 'BOY' ? 'boy' : childGender === 'GIRL' ? 'girl' : 'child';
  const prompt = `This is the transcript from a 5-minute parent-child play session. The child is ${childName}, a ${age} year old ${gender}.

**Transcript:**
${transcript}

As a child psychologist, please provide:

1. **Feedback for Parents**: Constructive feedback on the parent's interaction style during this play session. What did they do well? What could they improve?

2. **Child Observations**: What do you notice about ${childName}'s behavior, communication patterns, emotional responses, and engagement during this session? Highlight any developmental strengths or areas that might benefit from attention.

3. **Recommendations**: Based on this session, what specific suggestions would you give to enhance the parent-child relationship and support ${childName}'s development?

Please be warm, encouraging, and specific in your feedback. Use examples from the transcript where relevant.

Return your response as valid JSON in this format:
{
  "parentFeedback": "Your feedback for parents here...",
  "childObservations": "Your observations about the child here...",
  "recommendations": "Your recommendations here..."
}

Return ONLY valid JSON. Do not include markdown code blocks.`;

  console.log('Calling Gemini API...\n');

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + process.env.GEMINI_API_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      })
    }
  );

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  console.log('=== GEMINI PSYCHOLOGIST FEEDBACK ===\n');

  let psychologistFeedback;
  try {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    psychologistFeedback = JSON.parse(cleaned);

    console.log('📝 PARENT FEEDBACK:');
    console.log(psychologistFeedback.parentFeedback);
    console.log('\n👶 CHILD OBSERVATIONS:');
    console.log(psychologistFeedback.childObservations);
    console.log('\n💡 RECOMMENDATIONS:');
    console.log(psychologistFeedback.recommendations);
  } catch (e) {
    console.log('Raw response:');
    console.log(text);
    await prisma.$disconnect();
    return;
  }

  // Second Gemini call: Extract portfolio insights
  console.log('\n\nCalling Gemini API for portfolio insights...\n');

  const portfolioPrompt = `we are building child portfolio. extract insights from the report. 1-3 key points about the child. 1-3 points for the parent to improve. only pick the ones are most valuable and insightful. (if none, keep blank). keep short and concise for mobile display. output format is json.

{
  "childInsights": ["insight 1", "insight 2"],
  "parentImprovements": ["improvement 1", "improvement 2"]
}

Report:
${JSON.stringify(psychologistFeedback, null, 2)}

Return ONLY valid JSON. Do not include markdown code blocks.`;

  const portfolioResponse = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + process.env.GEMINI_API_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: portfolioPrompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 512 }
      })
    }
  );

  const portfolioData = await portfolioResponse.json();
  const portfolioText = portfolioData.candidates?.[0]?.content?.parts?.[0]?.text;

  console.log('=== CHILD PORTFOLIO INSIGHTS ===\n');

  try {
    const portfolioCleaned = portfolioText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const portfolioInsights = JSON.parse(portfolioCleaned);

    console.log('👶 CHILD INSIGHTS:');
    portfolioInsights.childInsights?.forEach((insight, i) => {
      console.log(`  ${i + 1}. ${insight}`);
    });

    console.log('\n📈 PARENT IMPROVEMENTS:');
    portfolioInsights.parentImprovements?.forEach((improvement, i) => {
      console.log(`  ${i + 1}. ${improvement}`);
    });
  } catch (e) {
    console.log('Raw response:');
    console.log(portfolioText);
  }

  await prisma.$disconnect();
}

test().catch(console.error);
