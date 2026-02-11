require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const prisma = new PrismaClient();

/**
 * Import lessons from lesson-content.txt into module-based database
 * Usage: node scripts/import-all-lessons.cjs
 *
 * Expected file format:
 *   Module: MODULE_KEY
 *   Day N: Title
 *   Short description text
 *   Card N: Section Title
 *   Body text...
 *   Day N Quiz
 *   Q: Question?
 *   A) Option A
 *   B) Option B
 *   C) Option C
 *   D) Option D
 *   Correct Answer: B
 *   Reason: Explanation
 */

// ============================================================================
// ID GENERATION HELPERS
// ============================================================================

function generateStableLessonId(moduleKey, dayNumber) {
  return `${moduleKey}-${dayNumber}`;
}

function generateId() {
  return crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, '').substring(0, 25);
}

// ============================================================================
// BACKUP FUNCTIONALITY
// ============================================================================

class BackupManager {
  async createBackup() {
    try {
      console.log('Creating backup of existing data...');

      const lessons = await prisma.lesson.findMany({
        include: {
          LessonSegment: { orderBy: { order: 'asc' } },
          Quiz: { include: { QuizOption: { orderBy: { order: 'asc' } } } }
        }
      });

      const userProgress = await prisma.userLessonProgress.findMany();

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupsDir = path.join(__dirname, 'backups');
      await fs.mkdir(backupsDir, { recursive: true });

      const lessonsBackupPath = path.join(backupsDir, `lessons-backup-${timestamp}.json`);
      const progressBackupPath = path.join(backupsDir, `user-progress-backup-${timestamp}.json`);

      await fs.writeFile(lessonsBackupPath, JSON.stringify(lessons, null, 2));
      await fs.writeFile(progressBackupPath, JSON.stringify(userProgress, null, 2));

      console.log(`  Backup created: ${lessons.length} lessons, ${userProgress.length} progress records\n`);
      return { lessonsBackupPath, progressBackupPath };
    } catch (error) {
      console.error('Backup failed:', error.message);
      throw error;
    }
  }
}

// ============================================================================
// PARSER - Extract lessons from text file (module-based)
// ============================================================================

class LessonParser {
  constructor(fileContent) {
    const cleanContent = fileContent.replace(/^\uFEFF/, '');
    this.lines = cleanContent.split('\n').map(line => line.trimEnd());
    this.lessons = [];
    this.currentModule = null;
    this.currentLesson = null;
    this.currentCard = null;
    this.currentQuiz = null;
    this.lineIndex = 0;
  }

  parse() {
    while (this.lineIndex < this.lines.length) {
      const line = this.lines[this.lineIndex];

      // Module header: "Module: MODULE_KEY" or "Module: MODULE_KEY - Title"
      if (line.match(/^Module:\s*(\w+)/)) {
        this.parseModuleHeader(line);
      }
      // Day header
      else if (line.match(/^Day (\d+):/)) {
        this.parseDayHeader(line);
      }
      // Card header
      else if (this.currentLesson && line.match(/^Card (\d+):/)) {
        this.parseCardHeader(line);
      }
      // Quiz header
      else if (line.match(/^Day \d+ Quiz$/) || line.match(/^Quiz$/)) {
        this.parseQuizHeader();
      }
      // Quiz question
      else if (this.currentQuiz && line.match(/^Q:/)) {
        this.parseQuizQuestion(line);
      }
      // Quiz options
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
      // Body text
      else if (line.trim() !== '') {
        if (this.currentCard) {
          if (this.currentCard.bodyText) {
            this.currentCard.bodyText += '\n' + line;
          } else {
            this.currentCard.bodyText = line;
          }
        } else if (this.currentLesson && !this.currentLesson.shortDescription) {
          this.currentLesson.shortDescription = line;
        }
      }

      this.lineIndex++;
    }

    // Finalize last lesson
    if (this.currentLesson) {
      this.finalizeLesson();
    }

    console.log(`Parsed ${this.lessons.length} lessons`);
    return this.lessons;
  }

  parseModuleHeader(line) {
    // Finalize previous lesson
    if (this.currentLesson) {
      this.finalizeLesson();
    }

    const match = line.match(/^Module:\s*(\w+)/);
    this.currentModule = match[1].toUpperCase();
    console.log(`\nModule: ${this.currentModule}`);
  }

  parseDayHeader(line) {
    if (this.currentLesson) {
      this.finalizeLesson();
    }

    const match = line.match(/^Day (\d+): (.+)$/);
    const dayNumber = parseInt(match[1]);
    const title = match[2];

    this.currentLesson = {
      module: this.currentModule,
      dayNumber: dayNumber,
      title: title,
      shortDescription: '',
      cards: [],
      quiz: null
    };

    this.currentCard = null;
    this.currentQuiz = null;
  }

  parseCardHeader(line) {
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
    const match = line.match(/^([A-D])[\)\.]\s*(.+)$/);
    if (match) {
      this.currentQuiz.options.push({
        label: match[1],
        text: match[2],
        order: match[1].charCodeAt(0) - 'A'.charCodeAt(0) + 1
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
    if (this.currentCard) {
      this.currentLesson.cards.push(this.currentCard);
      this.currentCard = null;
    }
    if (this.currentQuiz) {
      this.currentLesson.quiz = this.currentQuiz;
      this.currentQuiz = null;
    }

    this.lessons.push(this.currentLesson);
    console.log(`  Day ${this.currentLesson.dayNumber}: ${this.currentLesson.title} (${this.currentLesson.cards.length} cards)`);
    this.currentLesson = null;
  }
}

// ============================================================================
// FORMATTER - Apply text formatting
// ============================================================================

class ContentFormatter {
  format(bodyText, contentType, sectionTitle) {
    let formatted = bodyText.trim();
    formatted = this.addParagraphBreaks(formatted);
    formatted = this.addBoldEmphasis(formatted);
    formatted = this.formatLists(formatted);
    formatted = this.formatDialogue(formatted);
    formatted = this.addTipEmojis(formatted, contentType);
    return formatted;
  }

  addParagraphBreaks(text) {
    let formatted = text;
    formatted = formatted.replace(/\b(Example:|Tip:|Why:|Goal:|Rule:|Script:|Benefit:|Action:|Scenario:|Instead of:|Try:|Don't Say:|Say:|Don't:|Do:)\s*/g, '\n\n**$1** ');
    formatted = formatted.replace(/\n{3,}/g, '\n\n');
    return formatted;
  }

  addBoldEmphasis(text) {
    let formatted = text;
    formatted = formatted.replace(/^(\d+)\.\s+/gm, '**$1.** ');
    return formatted;
  }

  formatLists(text) {
    let formatted = text;
    if (!text.match(/^\d+\.\s+\w+:/m)) {
      formatted = formatted.replace(/^\s*(\d+)\.\s+/gm, '* ');
    }
    formatted = formatted.replace(/^-\s+/gm, '* ');
    formatted = formatted.replace(/^\s*\*\s+/gm, '* ');
    return formatted;
  }

  formatDialogue(text) {
    let formatted = text;
    formatted = formatted.replace(/\bChild:\s*/g, '**Child:** ');
    formatted = formatted.replace(/\bYou:\s*/g, '**You:** ');
    formatted = formatted.replace(/\bParent:\s*/g, '**Parent:** ');
    return formatted;
  }

  addTipEmojis(text, contentType) {
    let formatted = text;
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

function parseTextInputMarkers(bodyText) {
  const hasTextInput = bodyText.includes('$$Text Input Field$$') ||
                       bodyText.includes('$$$Text Input Field$$$');

  if (!hasTextInput) {
    return { isTextInput: false, bodyText, idealAnswer: null, aiCheckMode: null };
  }

  let prompt = bodyText.split(/\${2,3}Text Input Field\${2,3}/)[0].trim();
  let idealAnswer = null;
  let aiCheckMode = null;

  const aiCheckMatch = bodyText.match(/AI-Check Answer:\s*"([^"]+)"/);
  if (aiCheckMatch) {
    idealAnswer = aiCheckMatch[1].trim();
    aiCheckMode = 'AI-Check';
  }

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

  if (titleLower.includes('script') || titleLower.includes('sample') ||
      bodyLower.includes('child:') || bodyLower.includes('you:')) {
    return 'SCRIPT';
  }
  if (titleLower.includes('example') || bodyLower.includes('example:')) {
    return 'EXAMPLE';
  }
  if (titleLower.includes('tip') || titleLower.includes('rules') ||
      titleLower.includes('practice') || bodyLower.includes('tip:') || bodyText.includes('💡')) {
    return 'TIP';
  }
  if (titleLower.includes('important') || titleLower.includes('warning') ||
      titleLower.includes('remember')) {
    return 'CALLOUT';
  }
  return 'TEXT';
}

function assignColors(moduleKey, lessonIndex) {
  const schemes = [
    { backgroundColor: '#E4E4FF', ellipse77Color: '#9BD4DF', ellipse78Color: '#A6E0CB' },
    { backgroundColor: '#E4F0FF', ellipse77Color: '#A6D4E0', ellipse78Color: '#B4E0CB' },
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
    console.log(`\nImporting ${this.lessons.length} lessons to database...\n`);

    // Delete all existing lessons (clean slate)
    console.log('Deleting existing lessons...');
    await prisma.quizResponse.deleteMany({});
    await prisma.quizOption.deleteMany({});
    await prisma.quiz.deleteMany({});
    await prisma.textInputResponse.deleteMany({});
    await prisma.lessonSegment.deleteMany({});
    await prisma.userLessonProgress.deleteMany({});
    await prisma.lesson.deleteMany({});
    console.log('Existing lessons deleted.\n');

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < this.lessons.length; i++) {
      const lessonData = this.lessons[i];
      try {
        await this.importLesson(lessonData, i);
        successCount++;
      } catch (error) {
        console.error(`Failed to import ${lessonData.module} Day ${lessonData.dayNumber}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Import Summary:');
    console.log(`   Success: ${successCount}`);
    console.log(`   Failed: ${errorCount}`);
    console.log(`   Total: ${this.lessons.length}`);
    console.log('='.repeat(60) + '\n');
  }

  async importLesson(lessonData, lessonIndex) {
    await prisma.$transaction(async (tx) => {
      const now = new Date();
      const stableLessonId = generateStableLessonId(lessonData.module, lessonData.dayNumber);
      const colors = assignColors(lessonData.module, lessonIndex);

      // Create lesson
      const lesson = await tx.lesson.create({
        data: {
          id: stableLessonId,
          module: lessonData.module,
          dayNumber: lessonData.dayNumber,
          title: lessonData.title,
          subtitle: null,
          shortDescription: lessonData.shortDescription || '',
          objectives: [],
          estimatedMinutes: 5,
          teachesCategories: [],
          dragonImageUrl: null,
          ...colors,
          createdAt: now,
          updatedAt: now,
        }
      });

      // Create segments
      const segments = lessonData.cards.map((card, idx) => {
        const textInputParsed = parseTextInputMarkers(card.bodyText);
        let contentType, formattedBodyText, idealAnswer = null, aiCheckMode = null;

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

      if (segments.length > 0) {
        await tx.lessonSegment.createMany({ data: segments });
      }

      // Create quiz
      if (lessonData.quiz && lessonData.quiz.question) {
        const quiz = await tx.quiz.create({
          data: {
            id: `${stableLessonId}-quiz`,
            lessonId: lesson.id,
            question: lessonData.quiz.question,
            correctAnswer: 'temp',
            explanation: lessonData.quiz.explanation || '',
            createdAt: now,
            updatedAt: now
          }
        });

        let correctOptionId = null;
        for (const opt of lessonData.quiz.options) {
          const optionId = `${stableLessonId}-quiz-opt-${opt.label}`;
          await tx.quizOption.create({
            data: {
              id: optionId,
              quizId: quiz.id,
              optionLabel: opt.label,
              optionText: opt.text,
              order: opt.order
            }
          });

          if (opt.label === lessonData.quiz.correctAnswer) {
            correctOptionId = optionId;
          }
        }

        if (correctOptionId) {
          await tx.quiz.update({
            where: { id: quiz.id },
            data: { correctAnswer: correctOptionId }
          });
        }
      }

      console.log(`  ${lessonData.module} Day ${lessonData.dayNumber}: ${lessonData.title}`);
    }, { timeout: 10000 });
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  try {
    console.log('Starting lesson import process...\n');

    // 1. Create backup
    const backupManager = new BackupManager();
    await backupManager.createBackup();

    // 2. Read and parse text file
    const filePath = path.join(__dirname, '..', 'lesson-content.txt');
    console.log(`Reading lesson content from: ${filePath}`);

    const fileContent = await fs.readFile(filePath, 'utf-8');
    const parser = new LessonParser(fileContent);
    const lessons = parser.parse();

    if (lessons.length === 0) {
      throw new Error('No lessons parsed from file');
    }

    // 3. Import to database
    const importer = new LessonImporter(lessons);
    await importer.import();

    console.log('Lesson import completed successfully!\n');
  } catch (error) {
    console.error('\nFatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
