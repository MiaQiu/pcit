require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

/**
 * Import lessons from RTF file
 * Converts RTF -> HTML -> parsed lessons -> database
 *
 * Usage: node scripts/import-lessons-from-rtf.cjs [path-to-rtf-file]
 */

// ============================================================================
// ID GENERATION HELPERS
// ============================================================================

function generateStableLessonId(phase, dayNumber) {
  return `${phase}-${dayNumber}`;
}

// ============================================================================
// RTF TO HTML CONVERTER
// ============================================================================

async function convertRtfToHtml(rtfPath) {
  console.log(`📄 Converting RTF to HTML: ${rtfPath}`);

  try {
    const html = execSync(`textutil -convert html -stdout "${rtfPath}"`, {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024 // 50MB buffer
    });
    return html;
  } catch (error) {
    throw new Error(`Failed to convert RTF: ${error.message}`);
  }
}

// ============================================================================
// HTML PARSER
// ============================================================================

class HtmlLessonParser {
  constructor(html) {
    this.html = html;
    this.lessons = [];
    this.currentPhase = null;
    this.currentPhaseNumber = null;
    this.currentLesson = null;
    this.currentCard = null;
    this.currentQuiz = null;
    this.inQuiz = false;
    this.inBoosterPackage = false;
    this.boosterCount = 0;
  }

  parse() {
    // Extract body content
    const bodyMatch = this.html.match(/<body>([\s\S]*)<\/body>/i);
    if (!bodyMatch) {
      throw new Error('Could not find body content in HTML');
    }

    const body = bodyMatch[1];

    // Split into paragraphs and list items
    const elements = this.extractElements(body);

    for (const element of elements) {
      this.processElement(element);
    }

    // Finalize last lesson
    if (this.currentLesson) {
      this.finalizeLesson();
    }

    console.log(`✅ Parsed ${this.lessons.length} lessons from RTF`);
    return this.lessons;
  }

  extractElements(html) {
    const elements = [];

    // Match paragraphs and list items
    const regex = /<(p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const tag = match[1].toLowerCase();
      const content = this.cleanHtml(match[2]);

      if (content.trim()) {
        elements.push({ tag, content, raw: match[0] });
      }
    }

    return elements;
  }

  cleanHtml(html) {
    let text = html;

    // Convert bold tags to markdown
    text = text.replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**');

    // Convert italic tags to markdown (optional, remove if not needed)
    text = text.replace(/<i>([\s\S]*?)<\/i>/gi, '$1');

    // Remove all other HTML tags
    text = text.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&rsquo;/g, "'");
    text = text.replace(/&lsquo;/g, "'");
    text = text.replace(/&rdquo;/g, '"');
    text = text.replace(/&ldquo;/g, '"');
    text = text.replace(/&ndash;/g, '–');
    text = text.replace(/&mdash;/g, '—');

    // Clean up empty bold markers
    text = text.replace(/\*\*\s*\*\*/g, '');

    // Clean up multiple spaces
    text = text.replace(/\s+/g, ' ');

    return text.trim();
  }

  processElement(element) {
    const { tag, content } = element;

    // Phase header - must be at start and contain "(Days" to distinguish from content
    const phaseMatch = content.match(/^\*\*Phase (\d+):\s*(\w+)\s*\(Days/);
    if (phaseMatch) {
      this.currentPhaseNumber = parseInt(phaseMatch[1]);
      this.currentPhase = phaseMatch[2].toUpperCase();
      this.boosterCount = 0; // Reset booster count for new phase
      console.log(`\n📖 Phase ${this.currentPhaseNumber}: ${this.currentPhase}`);
      return;
    }

    // Booster Package header (e.g., "Phase 1: Booster Package")
    const boosterPackageMatch = content.match(/^\*\*Phase (\d+):\s*Booster/i);
    if (boosterPackageMatch) {
      this.currentPhaseNumber = parseInt(boosterPackageMatch[1]);
      this.currentPhase = this.currentPhaseNumber === 1 ? 'CONNECT' : 'DISCIPLINE';
      this.inBoosterPackage = true;
      this.boosterCount = 0;
      console.log(`\n📖 Phase ${this.currentPhaseNumber}: ${this.currentPhase} (Booster Package)`);
      return;
    }

    // Day header - must match the full pattern
    const dayMatch = content.match(/^\*\*Day (\d+):\s*(.+?)\*\*\*?\*?$/);
    if (dayMatch) {
      this.finalizeLessonIfNeeded();
      this.inBoosterPackage = false;

      this.currentLesson = {
        phase: this.currentPhase,
        phaseNumber: this.currentPhaseNumber,
        dayNumber: parseInt(dayMatch[1]),
        title: dayMatch[2].trim(),
        shortDescription: '',
        isBooster: false,
        cards: [],
        quiz: null
      };
      this.currentCard = null;
      this.currentQuiz = null;
      this.inQuiz = false;
      return;
    }

    // Booster lesson header (individual booster within package)
    const boosterMatch = content.match(/^\*\*Booster\s*\d*:\s*(.+?)\*\*/);
    if (boosterMatch) {
      this.finalizeLessonIfNeeded();

      // Increment booster count and calculate day number
      this.boosterCount = (this.boosterCount || 0) + 1;
      // Boosters in CONNECT start at day 16, in DISCIPLINE at day 27
      const baseDay = this.currentPhase === 'CONNECT' ? 15 : 26;
      const boosterDayNumber = baseDay + this.boosterCount;

      this.currentLesson = {
        phase: this.currentPhase,
        phaseNumber: this.currentPhaseNumber,
        dayNumber: boosterDayNumber,
        title: boosterMatch[1].trim(),
        shortDescription: '',
        isBooster: true,
        cards: [],
        quiz: null
      };
      this.currentCard = null;
      this.currentQuiz = null;
      this.inQuiz = false;
      return;
    }

    // Skip if no current lesson
    if (!this.currentLesson) return;

    // Quiz header
    if (content.match(/^(\*\*)?(Day \d+ )?Quiz\*?\*?$/i) ||
        content.match(/^(\*\*)?Daily Quiz\*?\*?$/i) ||
        content.match(/^(\*\*)?Booster Quiz\*?\*?$/i)) {
      this.finalizeCardIfNeeded();
      this.inQuiz = true;
      this.currentQuiz = {
        question: '',
        options: [],
        correctAnswer: '',
        explanation: ''
      };
      return;
    }

    // Quiz content
    if (this.inQuiz && this.currentQuiz) {
      // Check if quiz content is all on one line
      if (content.match(/^Q:.*A[\.\)]/)) {
        this.parseCompactQuiz(content);
        return;
      }

      // Question
      if (content.startsWith('Q:')) {
        this.currentQuiz.question = content.replace(/^Q:\s*/, '').trim();
        return;
      }

      // Options
      const optionMatch = content.match(/^([A-D])[\.\)]\s*(.+)$/);
      if (optionMatch) {
        this.currentQuiz.options.push({
          label: optionMatch[1],
          text: optionMatch[2].trim(),
          order: optionMatch[1].charCodeAt(0) - 'A'.charCodeAt(0) + 1
        });
        return;
      }

      // Correct answer
      const answerMatch = content.match(/^Correct Answer:\s*([A-D])/i);
      if (answerMatch) {
        this.currentQuiz.correctAnswer = answerMatch[1];
        return;
      }

      // Reason
      if (content.startsWith('Reason:')) {
        this.currentQuiz.explanation = content.replace(/^Reason:\s*/, '').trim();
        return;
      }
    }

    // Card header - can be on its own line or combined with content
    // Format 1: "Card X: Title" (standalone)
    // Format 2: "**Card X: Title** Body text..." (combined)
    const cardMatch = content.match(/^(\*\*)?Card (\d+):\s*(.+?)(\*\*)?(.*)$/);
    if (cardMatch && !this.inQuiz) {
      this.finalizeCardIfNeeded();

      // Extract title (everything before the closing ** or end)
      let title = cardMatch[3].replace(/\*\*/g, '').trim();
      // Body text might be after the title on the same line
      let bodyText = cardMatch[5] ? cardMatch[5].trim() : '';

      // If title contains body text (no ** separator), split on first period or sentence
      if (title.length > 100 || title.match(/\.\s+[A-Z]/)) {
        // Title is too long or contains sentences - split it
        const titleMatch = title.match(/^([^.!?]+[.!?]?)\s*(.*)$/);
        if (titleMatch && titleMatch[1].length < 80) {
          title = titleMatch[1].trim();
          bodyText = titleMatch[2] ? titleMatch[2].trim() + (bodyText ? ' ' + bodyText : '') : bodyText;
        }
      }

      this.currentCard = {
        order: parseInt(cardMatch[2]),
        sectionTitle: title,
        bodyText: bodyText
      };
      return;
    }

    // Card content (including list items)
    if (this.currentCard && !this.inQuiz) {
      const prefix = tag === 'li' ? '* ' : '';
      const text = prefix + content;

      if (this.currentCard.bodyText) {
        this.currentCard.bodyText += '\n' + text;
      } else {
        this.currentCard.bodyText = text;
      }
    }
  }

  parseCompactQuiz(content) {
    // Parse quiz that's all on one line
    // Format: Q: question? A) opt1 B) opt2 C) opt3 D) opt4 Correct Answer: X Reason: explanation

    const questionMatch = content.match(/Q:\s*(.+?)\s*A[\.\)]/);
    if (questionMatch) {
      this.currentQuiz.question = questionMatch[1].trim();
    }

    const options = content.matchAll(/([A-D])[\.\)]\s*([^A-D]+?)(?=\s*[A-D][\.\)]|Correct|$)/gi);
    for (const opt of options) {
      const label = opt[1].toUpperCase();
      const text = opt[2].trim();
      if (text && !text.match(/^Correct|^Answer|^Reason/i)) {
        this.currentQuiz.options.push({
          label,
          text,
          order: label.charCodeAt(0) - 'A'.charCodeAt(0) + 1
        });
      }
    }

    const answerMatch = content.match(/Correct\s*Answer:\s*([A-D])/i);
    if (answerMatch) {
      this.currentQuiz.correctAnswer = answerMatch[1].toUpperCase();
    }

    const reasonMatch = content.match(/Reason:\s*(.+)$/i);
    if (reasonMatch) {
      this.currentQuiz.explanation = reasonMatch[1].trim();
    }
  }

  finalizeCardIfNeeded() {
    if (this.currentCard && this.currentCard.bodyText) {
      this.currentLesson.cards.push(this.currentCard);
    }
    this.currentCard = null;
  }

  finalizeLessonIfNeeded() {
    if (this.currentLesson) {
      this.finalizeLesson();
    }
  }

  finalizeLesson() {
    this.finalizeCardIfNeeded();

    if (this.currentQuiz && this.currentQuiz.question) {
      this.currentLesson.quiz = this.currentQuiz;
    }

    // Generate short description if missing
    if (!this.currentLesson.shortDescription && this.currentLesson.cards.length > 0) {
      const firstCardText = this.currentLesson.cards[0].bodyText || '';
      const firstSentence = firstCardText.split(/[.!?]/)[0];
      this.currentLesson.shortDescription = firstSentence.substring(0, 150).trim();
    }

    this.lessons.push(this.currentLesson);
    console.log(`  ✓ Day ${this.currentLesson.dayNumber}: ${this.currentLesson.title} (${this.currentLesson.cards.length} cards)`);

    this.currentLesson = null;
    this.currentQuiz = null;
    this.inQuiz = false;
  }
}

// ============================================================================
// CONTENT FORMATTER
// ============================================================================

class ContentFormatter {
  format(bodyText) {
    let formatted = bodyText.trim();

    // Clean up extra whitespace
    formatted = formatted.replace(/\n{3,}/g, '\n\n');

    // Add tip emoji
    if (!formatted.includes('💡')) {
      formatted = formatted.replace(/\*\*Tip:\*\*/g, '💡 **Tip:**');
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

  if (titleLower.includes('script') || titleLower.includes('sample') ||
      bodyLower.includes('child:') || bodyLower.includes('you:')) {
    return 'SCRIPT';
  }

  if (titleLower.includes('example') || bodyLower.includes('example:')) {
    return 'EXAMPLE';
  }

  if (titleLower.includes('tip') || titleLower.includes('practice') ||
      bodyLower.includes('tip:') || bodyText.includes('💡')) {
    return 'TIP';
  }

  if (titleLower.includes('important') || titleLower.includes('warning') ||
      titleLower.includes('remember')) {
    return 'CALLOUT';
  }

  return 'TEXT';
}

function assignColors(lessonIndex) {
  const schemes = [
    { backgroundColor: '#E4E4FF', ellipse77Color: '#9BD4DF', ellipse78Color: '#A6E0CB' },
    { backgroundColor: '#E4F0FF', ellipse77Color: '#A6D4E0', ellipse78Color: '#B4E0CB' }
  ];
  return schemes[lessonIndex % 2];
}

// ============================================================================
// LESSON IMPORTER
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
      const stableLessonId = generateStableLessonId(lessonData.phase, lessonData.dayNumber);

      // Delete existing lesson if exists
      const existing = await tx.lesson.findFirst({
        where: { id: stableLessonId }
      });

      if (existing) {
        await tx.lesson.delete({ where: { id: existing.id } });
      }

      // Generate prerequisites
      const prerequisites = this.generatePrerequisites(lessonData);
      const colors = assignColors(lessonIndex);

      // Create lesson
      const now = new Date();
      const newLesson = await tx.lesson.create({
        data: {
          id: stableLessonId,
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
          createdAt: now,
          updatedAt: now
        }
      });

      // Create segments
      const segments = lessonData.cards.map((card, idx) => {
        const contentType = inferContentType(card.sectionTitle, card.bodyText);
        const formattedBodyText = this.formatter.format(card.bodyText);

        return {
          id: `${stableLessonId}-seg-${idx + 1}`,
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

      // Create quiz
      if (lessonData.quiz && lessonData.quiz.question) {
        const quiz = await tx.quiz.create({
          data: {
            id: `${stableLessonId}-quiz`,
            lessonId: newLesson.id,
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

      console.log(`✅ ${lessonData.phase} Day ${lessonData.dayNumber}: ${lessonData.title}`);
    }, { timeout: 10000 });
  }

  generatePrerequisites(lessonData) {
    if (lessonData.phase === 'CONNECT' && lessonData.dayNumber === 1) {
      return [];
    }

    if (lessonData.phase === 'DISCIPLINE' && lessonData.dayNumber === 1) {
      return [generateStableLessonId('CONNECT', 16)];
    }

    return [generateStableLessonId(lessonData.phase, lessonData.dayNumber - 1)];
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  try {
    console.log('🚀 Starting RTF lesson import...\n');

    // Get RTF file path from args or use default
    const rtfPath = process.argv[2] || '/Users/yihui/Project/lesson.rtf';

    // Check if file exists
    try {
      await fs.access(rtfPath);
    } catch {
      throw new Error(`RTF file not found: ${rtfPath}`);
    }

    // Convert RTF to HTML
    const html = await convertRtfToHtml(rtfPath);

    // Parse HTML
    const parser = new HtmlLessonParser(html);
    const lessons = parser.parse();

    if (lessons.length === 0) {
      throw new Error('No lessons parsed from RTF file');
    }

    // Import to database
    const importer = new LessonImporter(lessons);
    await importer.import();

    console.log('🎉 RTF lesson import completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
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
