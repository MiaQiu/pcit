const fetch = require('node-fetch');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY not found in environment');
  process.exit(1);
}

// Full production-like prompt that triggers the thinking phase
const fullPrompt = `this is transcripts from a 5 mins parent-child play session. as a pcit therapist and child developmental psychologist, can you provide feedbacks to parents on the play session. can you also highlight what are the things you notice with the child?

**Child Info:**
- speaker_1: Timmy, 36 months old boy

**Session Metrics:**
- Labeled Praises: 5 (goal: 10+)
- Reflections: 8 (goal: 10+)
- Behavioral Descriptions: 12 (goal: 10+)
- Questions: 15 (reduce)
- Commands: 3 (reduce)
- Criticisms: 0 (eliminate)

**Transcript:**
Parent: Look at these blocks!
Child: Blocks! I want the red one.
Parent: You want the red one. That's a beautiful red block.
Child: Yeah! Red is my favorite.
Parent: Red is your favorite color. You're stacking them so carefully.
Child: I making a tower!
Parent: You're making a tall tower! What color should go next?
Child: Umm... blue!
Parent: The blue one. You picked the blue block.
Child: It's gonna be so big!
Parent: Your tower is getting so tall. You're working so hard on it.
Child: Look mommy!
Parent: I see it! You built such a wonderful tower all by yourself!
Child: Can we knock it down?
Parent: Do you want to knock it down?
Child: Yeah! Ready...
Parent: You're getting ready. One... two...
Child: THREE!
Parent: Wow! You knocked it all down! That was so exciting!
Child: Again! Again!
Parent: You want to build it again. Let's do it together.`;

async function testStreaming() {
  console.log('='.repeat(60));
  console.log('Testing gemini-3-pro-preview with STREAMING endpoint');
  console.log('='.repeat(60));
  console.log(`Prompt length: ${fullPrompt.length} chars\n`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000);  // 5 min timeout

  try {
    const startTime = Date.now();
    let chunkCount = 0;
    let fullText = '';

    console.log('📡 Connecting to streaming endpoint...');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
        }),
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`❌ API Error: ${response.status} - ${errorText.substring(0, 200)}`);
      return false;
    }

    console.log('✅ Connected! Receiving stream...\n');

    const reader = response.body;
    const decoder = new TextDecoder();
    let buffer = '';
    let lastLogTime = Date.now();

    for await (const chunk of reader) {
      buffer += decoder.decode(chunk, { stream: true });
      chunkCount++;

      // Log progress every 5 seconds
      const now = Date.now();
      if (now - lastLogTime > 5000) {
        const elapsed = ((now - startTime) / 1000).toFixed(1);
        console.log(`   [${elapsed}s] Received ${chunkCount} chunks, ${buffer.length} bytes buffered...`);
        lastLogTime = now;
      }

      // Process complete SSE events
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr && jsonStr !== '[DONE]') {
            try {
              const data = JSON.parse(jsonStr);
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                fullText += text;
              }
            } catch (e) {
              // Skip malformed chunks
            }
          }
        }
      }
    }

    // Process remaining buffer
    if (buffer.startsWith('data: ')) {
      const jsonStr = buffer.slice(6).trim();
      if (jsonStr && jsonStr !== '[DONE]') {
        try {
          const data = JSON.parse(jsonStr);
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            fullText += text;
          }
        } catch (e) {}
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log(`✅ SUCCESS in ${elapsed}s`);
    console.log(`   Total chunks received: ${chunkCount}`);
    console.log(`   Response length: ${fullText.length} chars`);
    console.log('='.repeat(60));
    console.log('\nResponse preview (first 500 chars):');
    console.log(fullText.substring(0, 500));
    console.log('...');

    return true;

  } catch (err) {
    clearTimeout(timeoutId);
    console.error(`\n❌ Error: ${err.message}`);
    return false;
  }
}

testStreaming();
