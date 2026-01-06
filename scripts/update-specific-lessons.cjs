require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const prisma = new PrismaClient();

/**
 * Update specific lesson segments from text file
 * Usage: node scripts/update-specific-lessons.cjs CONNECT:3,CONNECT:4,CONNECT:5
 * Or: node scripts/update-specific-lessons.cjs 1:3,1:4,1:5
 * Or: node scripts/update-specific-lessons.cjs 3,4,5  (defaults to CONNECT phase)
 */

// ============================================================================
// ID GENERATION HELPER
// ============================================================================

function generateId() {
  return crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, '').substring(0, 25);
}

// ============================================================================
// PARSER - Extract lessons from text file
// ============================================================================

class LessonParser {
  constructor(fileContent) {
    // Remove BOM if present
    const cleanContent = fileContent.replace(/^\uFEFF/, '');
    this.lines = cleanContent.split('\n').map(line => line.trimEnd());
    this.lessons = [];
    this.currentPhase = null;
    this.currentPhaseNumber = null;
    this.currentLesson = null;
    this.currentCard = null;
    this.currentQuiz = null;
    this.lineIndex = 0;
  }

  parse() {
    while (this.lineIndex < this.lines.length) {
      const line = this.lines[this.lineIndex];

      // Phase header
      if (line.match(/^Phase (\d+):/)) {
        this.parsePhaseHeader(line);
      }
      // Day header or Booster
      else if (line.match(/^Day (\d+):/)) {
        this.parseDayHeader(line);
      }
      else if (line.match(/^Booster:/)) {
        this.parseBoosterHeader(line);
      }
      // Card header
      else if (this.currentLesson && line.match(/^Card (\d+):/)) {
        this.parseCardHeader(line);
      }
      // Quiz header
      else if (line.match(/^Day \d+ Quiz$/) || line.match(/^Booster Quiz$/)) {
        this.parseQuizHeader();
      }
      // Quiz question
      else if (this.currentQuiz && line.match(/^Q:/)) {
        this.parseQuizQuestion(line);
      }
      // Quiz options (handle both A) and A. formats)
      else if (this.currentQuiz && line.match(/^([A-D])[\)\.]/)) {
        this.parseQuizOption(line);
      }
      // Correct answer
      else if (this.currentQuiz && line.match(/^Correct Answer:/)) {
        this.parseCorrectAnswer(line);
      }
      // Explanation
      else if (this.currentQuiz && line.match(/^Reason:/)) {
        this.parseExplanation(line);
      }
      // Card body text or short description
      else if (line.trim() !== '') {
        if (this.currentCard) {
          // Accumulate card body text
          if (this.currentCard.bodyText) {
            this.currentCard.bodyText += '\n' + line;
          } else {
            this.currentCard.bodyText = line;
          }
        } else if (this.currentLesson && !this.currentLesson.shortDescription) {
          // Short description (first non-empty line after day header)
          this.currentLesson.shortDescription = line;
        }
      }

      this.lineIndex++;
    }

    // Finalize last lesson
    if (this.currentLesson) {
      this.finalizeLesson();
    }

    return this.lessons;
  }

  parsePhaseHeader(line) {
    const match = line.match(/^Phase (\d+):/);
    this.currentPhaseNumber = parseInt(match[1]);
    this.currentPhase = this.currentPhaseNumber === 1 ? 'CONNECT' : 'DISCIPLINE';
  }

  parseDayHeader(line) {
    // Finalize previous lesson
    if (this.currentLesson) {
      this.finalizeLesson();
    }

    const match = line.match(/^Day (\d+): (.+)$/);
    const dayNumber = parseInt(match[1]);
    const title = match[2];

    this.currentLesson = {
      phase: this.currentPhase,
      phaseNumber: this.currentPhaseNumber,
      dayNumber: dayNumber,
      title: title,
      shortDescription: '',
      isBooster: false,
      cards: [],
      quiz: null
    };

    this.currentCard = null;
    this.currentQuiz = null;
  }

  parseBoosterHeader(line) {
    // Finalize previous lesson
    if (this.currentLesson) {
      this.finalizeLesson();
    }

    const match = line.match(/^Booster: (.+)$/);
    const title = match[1];

    // Booster comes after Day 15 in Connect phase
    this.currentLesson = {
      phase: this.currentPhase,
      phaseNumber: this.currentPhaseNumber,
      dayNumber: 16, // Day 16 for booster
      title: title,
      shortDescription: '',
      isBooster: true,
      cards: [],
      quiz: null
    };

    this.currentCard = null;
    this.currentQuiz = null;
  }

  parseCardHeader(line) {
    // Finalize previous card
    if (this.currentCard) {
      this.currentLesson.cards.push(this.currentCard);
    }

    const match = line.match(/^Card (\d+): (.+)$/);
    const cardNumber = parseInt(match[1]);
    const sectionTitle = match[2];

    this.currentCard = {
      order: cardNumber,
      sectionTitle: sectionTitle,
      bodyText: ''
    };
  }

  parseQuizHeader() {
    // Finalize last card
    if (this.currentCard) {
      this.currentLesson.cards.push(this.currentCard);
      this.currentCard = null;
    }

    this.currentQuiz = {
      question: '',
      options: [],
      correctAnswer: '',
      explanation: ''
    };
  }

  parseQuizQuestion(line) {
    this.currentQuiz.question = line.replace(/^Q:\s*/, '');
  }

  parseQuizOption(line) {
    // Handle both A) and A. formats
    const match = line.match(/^([A-D])[\)\.]\s*(.+)$/);
    if (match) {
      const label = match[1];
      const text = match[2];
      const order = label.charCodeAt(0) - 'A'.charCodeAt(0) + 1; // A=1, B=2, C=3, D=4

      this.currentQuiz.options.push({
        label: label,
        text: text,
        order: order
      });
    }
  }

  parseCorrectAnswer(line) {
    const match = line.match(/^Correct Answer:\s*([A-D])$/);
    if (match) {
      this.currentQuiz.correctAnswer = match[1];
    }
  }

  parseExplanation(line) {
    this.currentQuiz.explanation = line.replace(/^Reason:\s*/, '');
  }

  finalizeLesson() {
    // Finalize quiz
    if (this.currentQuiz) {
      this.currentLesson.quiz = this.currentQuiz;
    }

    this.lessons.push(this.currentLesson);
  }
}

// ============================================================================
// FORMATTER - Apply text formatting
// ============================================================================

class ContentFormatter {
  format(bodyText, contentType, sectionTitle) {
    let formatted = bodyText.trim();

    // Apply formatting based on content type
    formatted = this.addParagraphBreaks(formatted);
    formatted = this.addBoldEmphasis(formatted);
    formatted = this.formatLists(formatted);
    formatted = this.formatDialogue(formatted);
    formatted = this.addTipEmojis(formatted, contentType);

    return formatted;
  }

  addParagraphBreaks(text) {
    // Add line breaks after sentences that end major ideas
    let formatted = text;

    // Add breaks after patterns like "Example:", "Tip:", etc.
    formatted = formatted.replace(/\b(Example:|Tip:|Why:|Goal:|Rule:|Script:|Benefit:|Action:|Scenario:|Instead of:|Try:|Don't Say:|Say:|Don't:|Do:)\s*/g, '\n\n**$1** ');

    // REMOVED: Add breaks between sentences for better readability
    // formatted = formatted.replace(/\.\s+([A-Z])/g, '.\n\n$1');

    // Clean up multiple line breaks
    formatted = formatted.replace(/\n{3,}/g, '\n\n');

    return formatted;
  }

  addBoldEmphasis(text) {
    let formatted = text;

    // Bold formatting is now done manually in the source file
    // This function is kept for potential future formatting needs

    // Bold numbers at start of sentences (for rules/steps)
    formatted = formatted.replace(/^(\d+)\.\s+/gm, '**$1.** ');

    return formatted;
  }

  formatLists(text) {
    let formatted = text;

    // Convert numbered lists to bullet points (except for rules)
    // Don't convert if it's clearly a rule (like "1. Time: 5 minutes")
    if (!text.match(/^\d+\.\s+\w+:/m)) {
      formatted = formatted.replace(/^\s*(\d+)\.\s+/gm, '• ');
    }

    // Convert dashed lists to bullet points
    formatted = formatted.replace(/^-\s+/gm, '• ');
    formatted = formatted.replace(/^\s*\*\s+/gm, '• ');

    return formatted;
  }

  formatDialogue(text) {
    let formatted = text;

    // Add emojis for dialogue
    formatted = formatted.replace(/\bChild:\s*/g, '👶 **Child:** ');
    formatted = formatted.replace(/\bYou:\s*/g, '👤 **You:** ');
    formatted = formatted.replace(/\bParent:\s*/g, '👤 **Parent:** ');

    return formatted;
  }

  addTipEmojis(text, contentType) {
    let formatted = text;

    // Add 💡 before tips if not already present (regardless of contentType)
    if (!formatted.includes('💡')) {
      formatted = formatted.replace(/\*\*Tip:\*\*/g, '💡 **Tip:**');
      formatted = formatted.replace(/^Tip:/gm, '💡 **Tip:**');
    }

    return formatted;
  }
}

// ============================================================================
// METADATA HELPERS
// ============================================================================

function inferContentType(sectionTitle, bodyText) {
  const titleLower = sectionTitle.toLowerCase();
  const bodyLower = bodyText.toLowerCase();

  // SCRIPT: Contains dialogue or sample scripts
  if (titleLower.includes('script') ||
      titleLower.includes('sample') ||
      bodyText.includes('👶') ||
      bodyText.includes('👤') ||
      bodyLower.includes('child:') ||
      (bodyText.match(/"/g) || []).length >= 2) {
    return 'SCRIPT';
  }

  // EXAMPLE: Contains examples
  if (titleLower.includes('example') ||
      bodyLower.includes('example:') ||
      bodyLower.includes('child:') ||
      bodyLower.includes('you:')) {
    return 'EXAMPLE';
  }

  // TIP: Contains tips, rules, or practice guidance
  if (titleLower.includes('tip') ||
      titleLower.includes('rules') ||
      titleLower.includes('practice') ||
      bodyLower.includes('tip:') ||
      bodyText.includes('💡')) {
    return 'TIP';
  }

  // CALLOUT: Important warnings
  if (titleLower.includes('important') ||
      titleLower.includes('warning') ||
      titleLower.includes('remember')) {
    return 'CALLOUT';
  }

  // Default to TEXT
  return 'TEXT';
}

// ============================================================================
// UPDATER - Update specific lessons
// ============================================================================

class LessonUpdater {
  constructor(lessons, lessonsToUpdate) {
    this.lessons = lessons;
    this.lessonsToUpdate = lessonsToUpdate; // Array of {phase, dayNumber}
    this.formatter = new ContentFormatter();
  }

  async update() {
    console.log(`\n🔄 Updating ${this.lessonsToUpdate.length} lessons...\n`);

    let successCount = 0;
    let errorCount = 0;
    let notFoundCount = 0;

    for (const target of this.lessonsToUpdate) {
      // Find lesson in parsed data
      const lessonData = this.lessons.find(
        l => l.phase === target.phase && l.dayNumber === target.dayNumber
      );

      if (!lessonData) {
        console.error(`❌ Not found in text file: ${target.phase} Day ${target.dayNumber}`);
        notFoundCount++;
        continue;
      }

      try {
        await this.updateLesson(lessonData);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to update ${lessonData.phase} Day ${lessonData.dayNumber}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Update Summary:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   🔍 Not Found: ${notFoundCount}`);
    console.log(`   📦 Total: ${this.lessonsToUpdate.length}`);
    console.log('='.repeat(60) + '\n');
  }

  async updateLesson(lessonData) {
    await prisma.$transaction(async (tx) => {
      // 1. Find existing lesson
      const existing = await tx.lesson.findFirst({
        where: {
          phase: lessonData.phase,
          dayNumber: lessonData.dayNumber
        }
      });

      if (!existing) {
        throw new Error(`Lesson not found in database: ${lessonData.phase} Day ${lessonData.dayNumber}`);
      }

      // 2. Delete existing segments
      await tx.lessonSegment.deleteMany({
        where: { lessonId: existing.id }
      });

      // 3. Create new segments with formatted bodyText
      const now = new Date();
      const segments = lessonData.cards.map((card, idx) => {
        const contentType = inferContentType(card.sectionTitle, card.bodyText);
        const formattedBodyText = this.formatter.format(card.bodyText, contentType, card.sectionTitle);

        return {
          id: generateId(),
          lessonId: existing.id,
          order: idx + 1,
          sectionTitle: card.sectionTitle,
          contentType: contentType,
          bodyText: formattedBodyText,
          createdAt: now,
          updatedAt: now
        };
      });

      await tx.lessonSegment.createMany({ data: segments });

      // 4. Update lesson's updatedAt timestamp
      await tx.lesson.update({
        where: { id: existing.id },
        data: { updatedAt: now }
      });

      console.log(`✅ ${lessonData.phase} Day ${lessonData.dayNumber}: ${lessonData.title} (${segments.length} segments)`);
    }, { timeout: 10000 });
  }
}

// ============================================================================
// ARGUMENT PARSER
// ============================================================================

function parseLessonArguments(args) {
  if (args.length === 0) {
    console.error('❌ Error: No lessons specified');
    console.log('\nUsage:');
    console.log('  node scripts/update-specific-lessons.cjs CONNECT:3,CONNECT:4,CONNECT:5');
    console.log('  node scripts/update-specific-lessons.cjs 1:3,1:4,1:5');
    console.log('  node scripts/update-specific-lessons.cjs 3,4,5  (defaults to CONNECT phase)');
    console.log('\nExamples:');
    console.log('  CONNECT:3      - Connect phase, day 3');
    console.log('  DISCIPLINE:10  - Discipline phase, day 10');
    console.log('  1:3            - Phase 1 (CONNECT), day 3');
    console.log('  2:10           - Phase 2 (DISCIPLINE), day 10');
    console.log('  3              - Connect phase, day 3 (default)');
    process.exit(1);
  }

  const lessonsToUpdate = [];
  const lessonSpecs = args.join(',').split(',').map(s => s.trim());

  for (const spec of lessonSpecs) {
    let phase, dayNumber;

    // Format: CONNECT:3 or DISCIPLINE:10
    if (spec.includes('CONNECT:') || spec.includes('DISCIPLINE:')) {
      const [p, d] = spec.split(':');
      phase = p;
      dayNumber = parseInt(d);
    }
    // Format: 1:3 or 2:10
    else if (spec.match(/^\d+:\d+$/)) {
      const [p, d] = spec.split(':');
      const phaseNum = parseInt(p);
      phase = phaseNum === 1 ? 'CONNECT' : 'DISCIPLINE';
      dayNumber = parseInt(d);
    }
    // Format: 3 or 10 (defaults to CONNECT)
    else if (spec.match(/^\d+$/)) {
      phase = 'CONNECT';
      dayNumber = parseInt(spec);
    }
    else {
      console.error(`❌ Invalid lesson format: ${spec}`);
      process.exit(1);
    }

    lessonsToUpdate.push({ phase, dayNumber });
  }

  return lessonsToUpdate;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  try {
    console.log('🚀 Starting lesson segment update...\n');

    // 1. Parse command line arguments
    const args = process.argv.slice(2);
    const lessonsToUpdate = parseLessonArguments(args);

    console.log('📋 Lessons to update:');
    lessonsToUpdate.forEach(l => {
      console.log(`   • ${l.phase} Day ${l.dayNumber}`);
    });
    console.log();

    // 2. Read and parse text file
    const filePath = '/Users/mia/Downloads/lessons-formatted.txt';
    console.log(`📖 Reading lesson content from: ${filePath}\n`);

    const fileContent = await fs.readFile(filePath, 'utf-8');
    const parser = new LessonParser(fileContent);
    const lessons = parser.parse();

    if (lessons.length === 0) {
      throw new Error('No lessons parsed from file');
    }

    console.log(`✅ Parsed ${lessons.length} lessons from file\n`);

    // 3. Update specified lessons
    const updater = new LessonUpdater(lessons, lessonsToUpdate);
    await updater.update();

    console.log('🎉 Lesson update completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
