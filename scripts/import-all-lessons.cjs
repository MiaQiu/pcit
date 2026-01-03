require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const prisma = new PrismaClient();

/**
 * Import and reformat all lessons from text file
 * Usage: node scripts/import-all-lessons.cjs
 */

// ============================================================================
// ID GENERATION HELPER
// ============================================================================

/**
 * Generate a unique ID for database records
 * @returns {string} 25-character unique ID
 */
function generateId() {
  return crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, '').substring(0, 25);
}

// ============================================================================
// BACKUP FUNCTIONALITY
// ============================================================================

class BackupManager {
  async createBackup() {
    try {
      console.log('📦 Creating backup of existing lessons...');

      const lessons = await prisma.lesson.findMany({
        include: {
          LessonSegment: {
            orderBy: { order: 'asc' }
          },
          Quiz: {
            include: {
              QuizOption: {
                orderBy: { order: 'asc' }
              }
            }
          }
        },
        orderBy: [
          { phaseNumber: 'asc' },
          { dayNumber: 'asc' }
        ]
      });

      const backupDir = path.join(__dirname, 'backups');
      await fs.mkdir(backupDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const backupPath = path.join(backupDir, `lessons-backup-${timestamp}.json`);

      await fs.writeFile(backupPath, JSON.stringify(lessons, null, 2));

      console.log(`✅ Backup created: ${backupPath}`);
      console.log(`   ${lessons.length} lessons backed up\n`);

      return backupPath;
    } catch (error) {
      console.error('❌ Backup failed:', error.message);
      throw error;
    }
  }
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

    console.log(`✅ Parsed ${this.lessons.length} lessons`);
    return this.lessons;
  }

  parsePhaseHeader(line) {
    const match = line.match(/^Phase (\d+):/);
    this.currentPhaseNumber = parseInt(match[1]);
    this.currentPhase = this.currentPhaseNumber === 1 ? 'CONNECT' : 'DISCIPLINE';
    console.log(`\n📖 Phase ${this.currentPhaseNumber}: ${this.currentPhase}`);
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
    console.log(`  ✓ Day ${this.currentLesson.dayNumber}: ${this.currentLesson.title} (${this.currentLesson.cards.length} cards)`);
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
    formatted = formatted.replace(/\b(Example:|Tip:|Why|Why:|Goal:|Rule:|Script:|Benefit:|Action:|Scenario:|Instead of:|Try:|Don't Say:|Say:|Don't:|Do:)\s*/g, '\n\n**$1** ');

    // Add breaks between sentences for better readability
    formatted = formatted.replace(/\.\s+([A-Z])/g, '.\n\n$1');

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

    if (contentType === 'TIP') {
      // Add 💡 before tips if not already present
      if (!formatted.includes('💡')) {
        formatted = formatted.replace(/\*\*Tip:\*\*/g, '💡 **Tip:**');
        formatted = formatted.replace(/^Tip:/gm, '💡 **Tip:**');
      }
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

function assignColors(lessonIndex) {
  const schemes = [
    {
      backgroundColor: '#E4E4FF',
      ellipse77Color: '#9BD4DF',
      ellipse78Color: '#A6E0CB'
    },
    {
      backgroundColor: '#E4F0FF',
      ellipse77Color: '#A6D4E0',
      ellipse78Color: '#B4E0CB'
    }
  ];

  return schemes[lessonIndex % 2];
}

// ============================================================================
// IMPORTER - Replace lessons in database
// ============================================================================

class LessonImporter {
  constructor(lessons) {
    this.lessons = lessons;
    this.formatter = new ContentFormatter();
    this.createdLessonIds = {}; // Track created lesson IDs for prerequisites
  }

  async import() {
    console.log(`\n🔄 Importing ${this.lessons.length} lessons to database...\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < this.lessons.length; i++) {
      const lessonData = this.lessons[i];

      try {
        await this.importLesson(lessonData, i);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to import ${lessonData.phase} Day ${lessonData.dayNumber}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Import Summary:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📦 Total: ${this.lessons.length}`);
    console.log('='.repeat(60) + '\n');
  }

  async importLesson(lessonData, lessonIndex) {
    await prisma.$transaction(async (tx) => {
      // 1. Find and delete existing lesson
      const existing = await tx.lesson.findFirst({
        where: {
          phase: lessonData.phase,
          dayNumber: lessonData.dayNumber
        }
      });

      if (existing) {
        await tx.lesson.delete({ where: { id: existing.id } });
      }

      // 2. Generate prerequisites
      const prerequisites = this.generatePrerequisites(lessonData);

      // 3. Assign colors
      const colors = assignColors(lessonIndex);

      // 4. Create new lesson
      const now = new Date();
      const newLesson = await tx.lesson.create({
        data: {
          id: generateId(),
          phase: lessonData.phase,
          phaseNumber: lessonData.phaseNumber,
          dayNumber: lessonData.dayNumber,
          title: lessonData.title,
          subtitle: null,
          shortDescription: lessonData.shortDescription,
          objectives: [], // Empty array per user preference
          estimatedMinutes: 5,
          isBooster: lessonData.isBooster,
          prerequisites: prerequisites,
          teachesCategories: [], // Empty array per user preference
          dragonImageUrl: null,
          ...colors,
          createdAt: now,
          updatedAt: now
        }
      });

      // Track lesson ID for prerequisites
      const key = `${lessonData.phase}-${lessonData.dayNumber}`;
      this.createdLessonIds[key] = newLesson.id;

      // 5. Create segments with formatted bodyText
      const segments = lessonData.cards.map((card, idx) => {
        const contentType = inferContentType(card.sectionTitle, card.bodyText);
        const formattedBodyText = this.formatter.format(card.bodyText, contentType, card.sectionTitle);

        return {
          id: generateId(),
          lessonId: newLesson.id,
          order: idx + 1,
          sectionTitle: card.sectionTitle,
          contentType: contentType,
          bodyText: formattedBodyText,
          createdAt: now,
          updatedAt: now
        };
      });

      await tx.lessonSegment.createMany({ data: segments });

      // 6. Create quiz
      if (lessonData.quiz) {
        const quiz = await tx.quiz.create({
          data: {
            id: generateId(),
            lessonId: newLesson.id,
            question: lessonData.quiz.question,
            correctAnswer: 'temp',
            explanation: lessonData.quiz.explanation,
            createdAt: now,
            updatedAt: now
          }
        });

        // 7. Create quiz options
        let correctOptionId = null;
        for (const opt of lessonData.quiz.options) {
          const option = await tx.quizOption.create({
            data: {
              id: generateId(),
              quizId: quiz.id,
              optionLabel: opt.label,
              optionText: opt.text,
              order: opt.order
            }
          });

          if (opt.label === lessonData.quiz.correctAnswer) {
            correctOptionId = option.id;
          }
        }

        // 8. Update quiz with correct answer
        if (correctOptionId) {
          await tx.quiz.update({
            where: { id: quiz.id },
            data: { correctAnswer: correctOptionId }
          });
        }
      }

      console.log(`✅ ${lessonData.phase} Day ${lessonData.dayNumber}: ${lessonData.title}`);
    }, { timeout: 10000 });
  }

  generatePrerequisites(lessonData) {
    // Phase 1, Day 1 has no prerequisites
    if (lessonData.phase === 'CONNECT' && lessonData.dayNumber === 1) {
      return [];
    }

    // Phase 2, Day 1 requires Phase 1 completion (last lesson of Phase 1)
    if (lessonData.phase === 'DISCIPLINE' && lessonData.dayNumber === 1) {
      // Find the last lesson of Phase 1 (highest day number in CONNECT phase)
      const phase1Lessons = Object.keys(this.createdLessonIds)
        .filter(key => key.startsWith('CONNECT-'))
        .map(key => ({
          key: key,
          dayNumber: parseInt(key.split('-')[1]),
          id: this.createdLessonIds[key]
        }))
        .sort((a, b) => b.dayNumber - a.dayNumber);

      if (phase1Lessons.length > 0) {
        // Return the last lesson of Phase 1 as prerequisite
        return [phase1Lessons[0].id];
      }

      return [];
    }

    // All other lessons require the previous day in the same phase
    const prevDayNumber = lessonData.dayNumber - 1;
    const key = `${lessonData.phase}-${prevDayNumber}`;
    const prevLessonId = this.createdLessonIds[key];

    if (prevLessonId) {
      return [prevLessonId];
    }

    return [];
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  try {
    console.log('🚀 Starting lesson import process...\n');

    // 1. Create backup
    const backupManager = new BackupManager();
    await backupManager.createBackup();

    // 2. Read and parse text file
    const filePath = '/Users/mia/Downloads/lessons-formatted.txt';
    console.log(`📖 Reading lesson content from: ${filePath}`);

    const fileContent = await fs.readFile(filePath, 'utf-8');
    const parser = new LessonParser(fileContent);
    const lessons = parser.parse();

    if (lessons.length === 0) {
      throw new Error('No lessons parsed from file');
    }

    // 3. Import to database
    const importer = new LessonImporter(lessons);
    await importer.import();

    console.log('🎉 Lesson import completed successfully!\n');
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
