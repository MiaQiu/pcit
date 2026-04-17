'use strict';
require('dotenv').config();

const fetch = require('node-fetch');

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const MAX_TURNS    = 6;

// Same system prompt as coach.cjs
const SYSTEM_PROMPT = `**ROLE & OBJECTIVE**

You are an expert Child Psychologist and PCIT (Parent-Child Interaction Therapy) Therapist acting as an AI coaching assistant for parents using the Nora app. Your goal is to answer parents' questions with empathy, clinical insight, and personalised context retrieved from the database.

**Instructions**
1. Use your tools to retrieve relevant data before answering — you do not need to call all tools for every message; decide which data is actually relevant.
2. Strictly do not answer questions that are out of scope. State your limitation as AI. If something requires a human professional, advise the parent to tap "Talk to a Psychologist".
3. We have branded the special time as "emotional massage" and the score is a deposit to their "emotional bank account". Do not mention PCIT in conversation with parents.
4. Reply in a way that is easy to read on a mobile screen (no tables, no emoji). Sound like a warm, human therapist.
5. When discussing skill metrics: Labeled Praises, Echo, Narrate are the skills to build (goal 10+ each). Questions, Commands, and Criticisms are the skills to reduce.`;

// Claude-format tool declarations
const CLAUDE_TOOLS = [
  {
    name: 'get_child_parent_profile',
    description: "Retrieve the two most recent developmental profiling snapshots for the child.",
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_child_milestone',
    description: "Retrieve the child's developmental milestone progress across 5 domains.",
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_transcript',
    description: "Retrieve the full transcript of the parent's most recent emotional massage session.",
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_recent_sessions',
    description: "Retrieve recent emotional massage session data including scores and skill counts.",
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of recent sessions to retrieve (1-10, default 2)' },
      },
      required: [],
    },
  },
];

// Mock tool responses — simulates DB data without a real DB connection
function mockExecuteTool(name, args) {
  console.log(`  [tool call] ${name}(${JSON.stringify(args)})`);
  switch (name) {
    case 'get_recent_sessions':
      return [{
        date: '2026-04-14',
        durationMinutes: 8,
        overallScore: 72,
        skills: { labeledPraises: 4, reflections: 9, behavioralDescriptions: 11, questions: 7, commands: 2, criticisms: 0 },
        coachingSummary: 'Good narration, work on increasing labeled praises.',
      }];
    case 'get_child_parent_profile':
      return { profilingSnapshots: [{ date: '2026-04-01', summary: 'Child shows strong language development for age.', metadata: null }] };
    case 'get_child_milestone':
      return {
        childAgeMonths: 36,
        domains: {
          Language:   { achieved: 12, emerging: 3, total: 18, benchmark: 14 },
          Cognitive:  { achieved: 10, emerging: 2, total: 15, benchmark: 12 },
          Social:     { achieved: 8,  emerging: 4, total: 14, benchmark: 10 },
          Emotional:  { achieved: 7,  emerging: 3, total: 13, benchmark: 9  },
          Connection: { achieved: 9,  emerging: 2, total: 12, benchmark: 10 },
        },
      };
    case 'get_transcript':
      return {
        sessionDate: '2026-04-14',
        transcript: [
          { role: 'parent', text: 'Look at these blocks!', pcitTag: 'BD' },
          { role: 'child',  text: 'Big tower!',            pcitTag: null },
          { role: 'parent', text: 'You built such a tall tower!', pcitTag: 'LP' },
        ],
      };
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function runClaudeAgentLoop(userText, history = []) {
  const messages = [...history, { role: 'user', content: userText }];

  const headers = {
    'Content-Type':      'application/json',
    'x-api-key':         process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
  };

  let totalInput = 0, totalOutput = 0;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    console.log(`\n--- Turn ${turn + 1} ---`);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers,
      body: JSON.stringify({
        model:       CLAUDE_MODEL,
        system:      SYSTEM_PROMPT,
        tools:       CLAUDE_TOOLS,
        messages,
        max_tokens:  2048,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API ${response.status}: ${err.slice(0, 300)}`);
    }

    const data = await response.json();
    totalInput  += data.usage?.input_tokens  ?? 0;
    totalOutput += data.usage?.output_tokens ?? 0;

    const content    = data.content ?? [];
    const textBlock  = content.find(b => b.type === 'text');
    const toolBlocks = content.filter(b => b.type === 'tool_use');

    console.log(`  stop_reason: ${data.stop_reason}`);
    if (textBlock)        console.log(`  text preview: ${textBlock.text.slice(0, 120)}...`);
    if (toolBlocks.length) console.log(`  tool calls: ${toolBlocks.map(b => b.name).join(', ')}`);

    if (data.stop_reason === 'end_turn' || toolBlocks.length === 0) {
      return { text: textBlock?.text ?? '', inputTokens: totalInput, outputTokens: totalOutput };
    }

    messages.push({ role: 'assistant', content });

    const toolResults = toolBlocks.map(b => ({
      type:        'tool_result',
      tool_use_id: b.id,
      content:     JSON.stringify(mockExecuteTool(b.name, b.input ?? {})),
    }));
    messages.push({ role: 'user', content: toolResults });
  }

  throw new Error('Exceeded max turns');
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set');
    process.exit(1);
  }

  const testMessage = process.argv[2] || 'How did I do in my last session?';
  console.log(`\nTest message: "${testMessage}"`);
  console.log('Model:', CLAUDE_MODEL);
  console.log('='.repeat(60));

  const start = Date.now();
  try {
    const result = await runClaudeAgentLoop(testMessage);
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log(`OK in ${elapsed}s | in=${result.inputTokens} out=${result.outputTokens}`);
    console.log('='.repeat(60));
    console.log('\nFull reply:\n');
    console.log(result.text);
  } catch (err) {
    console.error('\nFAILED:', err.message);
    process.exit(1);
  }
}

main();
