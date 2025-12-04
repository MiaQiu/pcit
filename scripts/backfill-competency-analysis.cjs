/**
 * Backfill competency analysis for existing sessions
 * This script generates and saves competency analysis for sessions that don't have it yet
 */

const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');

const prisma = new PrismaClient();
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY environment variable not set');
  process.exit(1);
}

/**
 * Generate CDI competency analysis prompt
 */
function generateCDICompetencyPrompt(counts) {
  const totalDonts = counts.question + counts.command + counts.criticism + counts.negative_phrases;
  const totalDos = counts.praise + counts.echo + counts.narration;

  return `You are an expert PCIT (Parent-Child Interaction Therapy) Supervisor and Coder. Your task is to analyze raw PCIT tag counts from a session and provide a comprehensive competency analysis, including recommendations.

**1. Data Input (Raw Counts for a 5-minute session):**

- Labeled Praises: ${counts.praise}
- Echo (Reflections): ${counts.echo}
- Narration (Behavioral Descriptions): ${counts.narration}
- Questions: ${counts.question}
- Commands: ${counts.command}
- Criticisms: ${counts.criticism}
- Negative Phrases: ${counts.negative_phrases}
- Neutral: ${counts.neutral}

**2. Analysis Instructions:**

Provide a structured analysis with:
1. **Overall Performance**: Brief summary (2-3 sentences)
2. **Strengths**: What's going well (bullet points)
3. **Areas for Improvement**: What needs work (bullet points)
4. **Specific Recommendations**: Concrete next steps (bullet points)

**3. PEN Skills Assessment:**
- Total DO skills (PEN): ${totalDos}
- Total DON'T skills: ${totalDonts}

**Mastery Criteria (for CDI completion):**
- 10+ Praises per 5 minutes
- 10+ Echo per 5 minutes
- 10+ Narration per 5 minutes
- 3 or fewer DON'Ts (Questions + Commands + Criticisms + Negative Phrases)
- 0 Negative Phrases

**Output Format:**
Keep the tone warm, encouraging, and constructive. Focus on progress and next steps.
`;
}

/**
 * Generate PDI competency analysis prompt
 */
function generatePDICompetencyPrompt(counts) {
  const totalEffective = counts.direct_command + counts.positive_command + counts.specific_command;
  const totalIneffective = counts.indirect_command + counts.negative_command + counts.vague_command + counts.chained_command;
  const totalCommands = totalEffective + totalIneffective;
  const effectivePercent = totalCommands > 0 ? Math.round((totalEffective / totalCommands) * 100) : 0;

  return `You are an expert PCIT (Parent-Child Interaction Therapy) Supervisor and Coder. Your task is to analyze raw PDI (Parent-Directed Interaction) tag counts from a session and provide a comprehensive competency analysis, including recommendations.

**1. Data Input (Raw Counts for PDI session):**

**Effective Command Skills:**
- Direct Commands: ${counts.direct_command}
- Positive Commands: ${counts.positive_command}
- Specific Commands: ${counts.specific_command}
- Labeled Praise: ${counts.labeled_praise}
- Correct Warnings: ${counts.correct_warning}
- Correct Timeout Statements: ${counts.correct_timeout}

**Ineffective Command Skills:**
- Indirect Commands: ${counts.indirect_command}
- Negative Commands: ${counts.negative_command}
- Vague Commands: ${counts.vague_command}
- Chained Commands: ${counts.chained_command}
- Harsh Tone: ${counts.harsh_tone}

**Neutral:** ${counts.neutral}

**Summary Statistics:**
- Total Effective Commands: ${totalEffective}
- Total Ineffective Commands: ${totalIneffective}
- Total Commands: ${totalCommands}
- Effective Command Percentage: ${effectivePercent}%

**2. Analysis Instructions:**

Provide a structured analysis with:
1. **Overall Performance**: Brief summary (2-3 sentences)
2. **Command Effectiveness**: Assessment of command quality and compliance likelihood
3. **Strengths**: What's going well (bullet points)
4. **Areas for Improvement**: What needs work (bullet points)
5. **Specific Recommendations**: Concrete next steps (bullet points)

**PDI Mastery Criteria:**
- 75%+ of commands should be Effective (Direct + Positive + Specific)
- Minimize Indirect Commands (phrased as questions)
- Eliminate Negative Commands (focus on what TO do)
- No Chained Commands (one command at a time)
- No Harsh Tone

**Output Format:**
Keep the tone warm, encouraging, and constructive. Focus on progress and next steps.
`;
}

/**
 * Generate competency analysis for a session
 */
async function generateCompetencyAnalysis(session) {
  const isCDI = session.mode === 'CDI';
  const tagCounts = session.tagCounts;

  if (!tagCounts) {
    console.log(`  Skipping ${session.id}: no tag counts`);
    return null;
  }

  try {
    const prompt = isCDI ? generateCDICompetencyPrompt(tagCounts) : generatePDICompetencyPrompt(tagCounts);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        temperature: 0.5,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const analysisText = data.content[0].text;

    return {
      rawAnalysis: analysisText,
      analyzedAt: new Date().toISOString(),
      mode: session.mode
    };
  } catch (error) {
    console.error(`  Error generating analysis for ${session.id}:`, error.message);
    return null;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Find all recent sessions
    const sessions = await prisma.session.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10 // Process 10 at a time to avoid rate limits
    });

    // Filter to only sessions without competency analysis that have tag counts
    const sessionsToProcess = sessions.filter(s =>
      s.competencyAnalysis === null && s.tagCounts !== null
    );

    console.log(`Found ${sessionsToProcess.length} sessions to process\n`);

    for (let i = 0; i < sessionsToProcess.length; i++) {
      const session = sessionsToProcess[i];
      console.log(`[${i + 1}/${sessionsToProcess.length}] Processing session ${session.id.substring(0, 8)}... (${session.mode})`);

      const analysis = await generateCompetencyAnalysis(session);

      if (analysis) {
        await prisma.session.update({
          where: { id: session.id },
          data: { competencyAnalysis: analysis }
        });
        console.log(`  ✓ Analysis saved`);
      } else {
        console.log(`  ✗ Failed to generate analysis`);
      }

      // Add delay to respect API rate limits
      if (i < sessionsToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`\n✅ Backfill complete! Processed ${sessionsToProcess.length} sessions.`);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
