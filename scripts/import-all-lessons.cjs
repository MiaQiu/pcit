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
// ID GENERATION HELPERS
// ============================================================================

/**
 * Generate a stable ID for lessons based on phase and day number
 * @param {string} phase - CONNECT or DISCIPLINE
 * @param {number} dayNumber - Day number within the phase
 * @returns {string} Stable lesson ID (e.g., "CONNECT-1", "DISCIPLINE-5")
 */
function generateStableLessonId(phase, dayNumber) {
  return `${phase}-${dayNumber}`;
}

/**
 * Generate a unique ID for non-lesson database records
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
      console.log('📦 Creating backup of existing data...');

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

      // Also backup UserLessonProgress to prevent data loss
      const userProgress = await prisma.userLessonProgress.findMany();

      const backupDir = path.join(__dirname, 'backups');
      await fs.mkdir(backupDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];

      // Save lessons backup
      const lessonsBackupPath = path.join(backupDir, `lessons-backup-${timestamp}.json`);
      await fs.writeFile(lessonsBackupPath, JSON.stringify(lessons, null, 2));

      // Save user progress backup
      const progressBackupPath = path.join(backupDir, `user-progress-backup-${timestamp}.json`);
      await fs.writeFile(progressBackupPath, JSON.stringify(userProgress, null, 2));

      console.log(`✅ Backup created:`);
      console.log(`   Lessons: ${lessonsBackupPath} (${lessons.length} lessons)`);
      console.log(`   Progress: ${progressBackupPath} (${userProgress.length} records)\n`);

      return { lessonsBackupPath, progressBackupPath };
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

/**
 * Parse text input markers from body text
 * Detects $$Text Input Field$$ or $$$Text Input Field$$$ markers
 * Extracts the prompt text and ideal answer
 * @param {string} bodyText - The raw body text to parse
 * @returns {Object} { isTextInput, bodyText, idealAnswer, aiCheckMode }
 */
function parseTextInputMarkers(bodyText) {
  const hasTextInput = bodyText.includes('$$Text Input Field$$') ||
                       bodyText.includes('$$$Text Input Field$$$');

  if (!hasTextInput) {
    return { isTextInput: false, bodyText, idealAnswer: null, aiCheckMode: null };
  }

  // Extract prompt (text before marker)
  let prompt = bodyText.split(/\${2,3}Text Input Field\${2,3}/)[0].trim();

  // Extract ideal answer
  let idealAnswer = null;
  let aiCheckMode = null;

  // Check for AI-Check Answer format: AI-Check Answer: "answer text"
  const aiCheckMatch = bodyText.match(/AI-Check Answer:\s*"([^"]+)"/);
  if (aiCheckMatch) {
    idealAnswer = aiCheckMatch[1].trim();
    aiCheckMode = 'AI-Check';
  }

  // Check for Ideal Answer format (multi-line text until next Card or end)
  if (!idealAnswer) {
    const idealMatch = bodyText.match(/Ideal Answer:\s*([\s\S]*?)(?=Card \d+:|$)/);
    if (idealMatch) {
      idealAnswer = idealMatch[1].trim();
      aiCheckMode = 'Ideal';
    }
  }

  return { isTextInput: true, bodyText: prompt, idealAnswer, aiCheckMode };
}

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
      const now = new Date();
      const stableLessonId = generateStableLessonId(lessonData.phase, lessonData.dayNumber);

      // 1. Check if lesson exists (by stable ID)
      const existing = await tx.lesson.findUnique({
        where: { id: stableLessonId },
        include: {
          Quiz: true
        }
      });

      // 2. Delete related data ONLY (not the lesson itself to preserve UserLessonProgress)
      if (existing) {
        // Delete quiz options first (if quiz exists)
        if (existing.Quiz) {
          await tx.quizOption.deleteMany({ where: { quizId: existing.Quiz.id } });
          await tx.quiz.delete({ where: { id: existing.Quiz.id } });
        }
        // Delete segments
        await tx.lessonSegment.deleteMany({ where: { lessonId: existing.id } });
      }

      // 3. Generate prerequisites and colors
      const prerequisites = this.generatePrerequisites(lessonData);
      const colors = assignColors(lessonIndex);

      // 4. Upsert lesson (update if exists, create if not) - preserves UserLessonProgress
      const lessonDataToSave = {
        phase: lessonData.phase,
        phaseNumber: lessonData.phaseNumber,
        dayNumber: lessonData.dayNumber,
        title: lessonData.title,
        subtitle: null,
        shortDescription: lessonData.shortDescription,
        objectives: [],
        estimatedMinutes: 5,
        isBooster: lessonData.isBooster,
        prerequisites: prerequisites,
        teachesCategories: [],
        dragonImageUrl: null,
        ...colors,
        updatedAt: now
      };

      const lesson = await tx.lesson.upsert({
        where: { id: stableLessonId },
        update: lessonDataToSave,
        create: {
          id: stableLessonId,
          ...lessonDataToSave,
          createdAt: now
        }
      });

      // 5. Create segments with formatted bodyText
      const segments = lessonData.cards.map((card, idx) => {
        // Check for text input markers
        const textInputParsed = parseTextInputMarkers(card.bodyText);

        let contentType;
        let formattedBodyText;
        let idealAnswer = null;
        let aiCheckMode = null;

        if (textInputParsed.isTextInput) {
          contentType = 'TEXT_INPUT';
          formattedBodyText = this.formatter.format(textInputParsed.bodyText, contentType, card.sectionTitle);
          idealAnswer = textInputParsed.idealAnswer;
          aiCheckMode = textInputParsed.aiCheckMode;
        } else {
          contentType = inferContentType(card.sectionTitle, card.bodyText);
          formattedBodyText = this.formatter.format(card.bodyText, contentType, card.sectionTitle);
        }

        return {
          id: `${stableLessonId}-seg-${idx + 1}`,
          lessonId: lesson.id,
          order: idx + 1,
          sectionTitle: card.sectionTitle,
          contentType: contentType,
          bodyText: formattedBodyText,
          idealAnswer: idealAnswer,
          aiCheckMode: aiCheckMode,
          createdAt: now,
          updatedAt: now
        };
      });

      await tx.lessonSegment.createMany({ data: segments });

      // 6. Create quiz
      if (lessonData.quiz) {
        const quiz = await tx.quiz.create({
          data: {
            id: `${stableLessonId}-quiz`,
            lessonId: lesson.id,
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
          const optionId = `${stableLessonId}-quiz-opt-${opt.label}`;
          const option = await tx.quizOption.create({
            data: {
              id: optionId,
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

      const action = existing ? '🔄' : '✅';
      console.log(`${action} ${lessonData.phase} Day ${lessonData.dayNumber}: ${lessonData.title}`);
    }, { timeout: 10000 });
  }

  generatePrerequisites(lessonData) {
    // Phase 1, Day 1 has no prerequisites
    if (lessonData.phase === 'CONNECT' && lessonData.dayNumber === 1) {
      return [];
    }

    // Phase 2, Day 1 requires Phase 1 completion (last lesson of Phase 1)
    // The booster is Day 16 in CONNECT phase
    if (lessonData.phase === 'DISCIPLINE' && lessonData.dayNumber === 1) {
      return [generateStableLessonId('CONNECT', 16)];
    }

    // All other lessons require the previous day in the same phase
    const prevDayNumber = lessonData.dayNumber - 1;
    return [generateStableLessonId(lessonData.phase, prevDayNumber)];
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
    const filePath = '/Users/yihui/Project/pcit/docs/lessons-formatted.txt';
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
