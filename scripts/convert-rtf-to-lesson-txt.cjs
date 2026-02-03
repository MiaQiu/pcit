const { execSync } = require('child_process');
const fs = require('fs');

/**
 * Convert RTF lesson file to standardized plain text format
 * Following LESSON_INPUT_FORMAT.md specification
 *
 * Usage: node scripts/convert-rtf-to-lesson-txt.cjs [input.rtf] [output.txt]
 */

const inputPath = process.argv[2] || '/Users/yihui/Project/lesson.rtf';
const outputPath = process.argv[3] || '/Users/yihui/Project/pcit/lessons-formatted.txt';

// ============================================================================
// RTF TO HTML CONVERSION
// ============================================================================

function convertRtfToHtml(rtfPath) {
  console.log(`📄 Converting RTF to HTML: ${rtfPath}`);
  return execSync(`textutil -convert html -stdout "${rtfPath}"`, {
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024
  });
}

// ============================================================================
// HTML PARSER
// ============================================================================

function cleanHtml(html) {
  let text = html;

  // Convert bold tags to markdown
  text = text.replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**');

  // Remove italic tags (keep text)
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
  text = text.replace(/&hellip;/g, '...');

  // Clean up empty bold markers
  text = text.replace(/\*\*\s*\*\*/g, '');
  text = text.replace(/\*\*\*\*/g, '');

  // Clean up multiple spaces
  text = text.replace(/\s+/g, ' ');

  return text.trim();
}

function parseHtml(html) {
  const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/i);
  if (!bodyMatch) throw new Error('No body found in HTML');

  const body = bodyMatch[1];
  const elements = [];

  // Match paragraphs and list items
  const regex = /<(p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;

  while ((match = regex.exec(body)) !== null) {
    const tag = match[1].toLowerCase();
    const content = cleanHtml(match[2]);
    if (content.trim()) {
      elements.push({ tag, content });
    }
  }

  return elements;
}

// ============================================================================
// LESSON STRUCTURE BUILDER
// ============================================================================

function buildLessonStructure(elements) {
  const phases = [];
  let currentPhase = null;
  let currentLesson = null;
  let currentCard = null;
  let inQuiz = false;
  let quizLines = [];

  for (const { tag, content } of elements) {
    // Phase header with days range
    const phaseMatch = content.match(/^\*\*Phase (\d+):\s*(\w+)\s*\(Days\s*(\d+)[–-](\d+)\)\*\*$/);
    if (phaseMatch) {
      // Finalize current lesson before switching phases
      if (currentLesson && currentPhase) {
        finalizeLesson(currentLesson, currentCard, inQuiz, quizLines);
        if (currentPhase.inBoosterMode) {
          currentPhase.boosters.push(currentLesson);
        } else {
          currentPhase.lessons.push(currentLesson);
        }
        currentLesson = null;
        currentCard = null;
        inQuiz = false;
        quizLines = [];
      }
      if (currentPhase) phases.push(currentPhase);
      currentPhase = {
        number: parseInt(phaseMatch[1]),
        name: phaseMatch[2].toUpperCase(),
        startDay: parseInt(phaseMatch[3]),
        endDay: parseInt(phaseMatch[4]),
        lessons: [],
        boosters: []
      };
      currentLesson = null;
      currentCard = null;
      inQuiz = false;
      continue;
    }

    // Booster Package header
    const boosterPackageMatch = content.match(/^\*\*Phase \d+:\s*Booster/i);
    if (boosterPackageMatch && currentPhase) {
      // Finalize current lesson
      if (currentLesson) {
        finalizeLesson(currentLesson, currentCard, inQuiz, quizLines);
        currentPhase.lessons.push(currentLesson);
      }
      currentLesson = null;
      currentCard = null;
      inQuiz = false;
      quizLines = [];
      // Mark that we're in booster mode
      currentPhase.inBoosterMode = true;
      continue;
    }

    // Day header
    const dayMatch = content.match(/^\*\*Day (\d+):\s*(.+?)\*\*$/);
    if (dayMatch) {
      // Finalize previous lesson
      if (currentLesson) {
        finalizeLesson(currentLesson, currentCard, inQuiz, quizLines);
        if (currentPhase.inBoosterMode) {
          currentPhase.boosters.push(currentLesson);
        } else {
          currentPhase.lessons.push(currentLesson);
        }
      }

      currentLesson = {
        dayNumber: parseInt(dayMatch[1]),
        title: dayMatch[2].trim(),
        shortDescription: '',
        cards: [],
        quiz: null
      };
      currentCard = null;
      inQuiz = false;
      quizLines = [];
      continue;
    }

    // Booster header - match "**Booster: Title**" or "**Booster 7: Title**"
    const boosterMatch = content.match(/^\*\*Booster\s*\d*:\s*(.+?)\*\*\*?$/);
    if (boosterMatch && currentPhase) {
      // Finalize previous lesson
      if (currentLesson) {
        finalizeLesson(currentLesson, currentCard, inQuiz, quizLines);
        if (currentPhase.inBoosterMode) {
          currentPhase.boosters.push(currentLesson);
        } else {
          currentPhase.lessons.push(currentLesson);
        }
      }

      currentLesson = {
        isBooster: true,
        title: boosterMatch[1].trim(),
        shortDescription: '',
        cards: [],
        quiz: null
      };
      currentCard = null;
      inQuiz = false;
      quizLines = [];
      continue;
    }

    if (!currentLesson) continue;

    // Quiz header
    if (content.match(/^(\*\*)?(Daily\s+)?Quiz\*?\*?$/i) ||
        content.match(/^(\*\*)?Day\s+\d+\s+Quiz\*?\*?$/i) ||
        content.match(/^(\*\*)?Booster\s+Quiz\*?\*?$/i)) {
      if (currentCard) {
        currentLesson.cards.push(currentCard);
        currentCard = null;
      }
      inQuiz = true;
      quizLines = [];
      continue;
    }

    // Quiz content
    if (inQuiz) {
      quizLines.push(content);
      continue;
    }

    // Card header - match "Card N: Title" possibly followed by body text
    const cardMatch = content.match(/^(\*\*)?Card (\d+):\s*(.+)/);
    if (cardMatch) {
      if (currentCard) {
        currentLesson.cards.push(currentCard);
      }

      let titleAndBody = cardMatch[3].replace(/\*\*$/g, '').replace(/^\*\*/, '').trim();
      let title = '';
      let bodyText = '';

      // Simple approach: title ends at first sentence-ending punctuation followed by space and capital
      // Or if there's no such pattern, take up to 60 chars
      const sentenceEnd = titleAndBody.match(/^(.+?[.!?])\s+([A-Z])/);
      if (sentenceEnd && sentenceEnd[1].length <= 60) {
        title = sentenceEnd[1].trim();
        bodyText = sentenceEnd[2] + titleAndBody.substring(sentenceEnd[0].length - 1);
      } else if (titleAndBody.length <= 60) {
        // Short enough to be just a title
        title = titleAndBody;
      } else {
        // Take first 60 chars or up to a natural break
        const shortText = titleAndBody.substring(0, 60);
        const lastBreak = shortText.search(/\s+[A-Z]/);
        if (lastBreak > 15) {
          title = shortText.substring(0, lastBreak).trim();
          bodyText = titleAndBody.substring(lastBreak).trim();
        } else {
          // Just use first 50 chars
          title = titleAndBody.substring(0, 50).trim();
          if (titleAndBody.length > 50) {
            bodyText = titleAndBody.substring(50).trim();
          }
        }
      }

      currentCard = {
        order: parseInt(cardMatch[2]),
        title: title.replace(/\*\*/g, ''),
        body: bodyText ? [bodyText] : []
      };
      continue;
    }

    // Card content
    if (currentCard) {
      // Check if content contains an inline quiz (entire quiz on one line)
      if (content.match(/\*\*Daily Quiz\*\*|Daily Quiz.*Q:/i) && content.match(/Correct\s*Answer:/i)) {
        // This is an inline quiz - extract it
        const quizPart = content.match(/((?:\*\*)?Daily Quiz(?:\*\*)?\s*Q:.+)/i);
        if (quizPart) {
          currentLesson.cards.push(currentCard);
          currentCard = null;
          inQuiz = true;
          quizLines = [quizPart[1]];
        }
      } else {
        const prefix = tag === 'li' ? '* ' : '';
        currentCard.body.push(prefix + content);
      }
    } else if (!currentLesson.shortDescription && currentLesson.cards.length === 0) {
      // First content after day header is short description
      currentLesson.shortDescription = content.substring(0, 150);
    }
  }

  // Finalize last lesson and phase
  if (currentLesson) {
    finalizeLesson(currentLesson, currentCard, inQuiz, quizLines);
    if (currentPhase) {
      if (currentPhase.inBoosterMode) {
        currentPhase.boosters.push(currentLesson);
      } else {
        currentPhase.lessons.push(currentLesson);
      }
    }
  }
  if (currentPhase) phases.push(currentPhase);

  return phases;
}

function finalizeLesson(lesson, currentCard, inQuiz, quizLines) {
  if (currentCard) {
    lesson.cards.push(currentCard);
  }

  if (inQuiz && quizLines.length > 0) {
    lesson.quiz = parseQuizLines(quizLines);
  }

  // Generate short description if missing
  if (!lesson.shortDescription && lesson.cards.length > 0) {
    const firstBody = lesson.cards[0].body.join(' ');
    // Get first complete sentence (minimum 30 chars, max 150)
    const sentences = firstBody.split(/(?<=[.!?])\s+/);
    let description = '';
    for (const sentence of sentences) {
      if (description.length + sentence.length < 150) {
        description += (description ? ' ' : '') + sentence;
      } else {
        break;
      }
    }
    // Fallback: just take first 150 chars
    if (description.length < 30) {
      description = firstBody.substring(0, 150);
      // Try to end at word boundary
      const lastSpace = description.lastIndexOf(' ');
      if (lastSpace > 100) {
        description = description.substring(0, lastSpace) + '...';
      }
    }
    lesson.shortDescription = description.trim();
  }
}

function parseQuizLines(lines) {
  const combined = lines.join(' ').replace(/\s+/g, ' ');

  const quiz = {
    question: '',
    options: [],
    correctAnswer: '',
    reason: ''
  };

  // Extract question - everything between Q: and the first option
  const qMatch = combined.match(/Q:\s*(.+?)\s*(?=[A-D][\.\)])/);
  if (qMatch) {
    quiz.question = qMatch[1].trim();
  }

  // Extract options more carefully
  // Match A. or A) followed by text until next option, Correct, or end
  const optionsSection = combined.match(/([A-D][\.\)].+?)(?=Correct\s*Answer|$)/i);
  if (optionsSection) {
    const optText = optionsSection[1];
    // Split by option markers
    const optParts = optText.split(/(?=[A-D][\.\)])/);
    for (const part of optParts) {
      const optMatch = part.match(/^([A-D])[\.\)]\s*(.+)/);
      if (optMatch) {
        const text = optMatch[2].trim();
        if (text && text.length > 2) {
          quiz.options.push({
            label: optMatch[1].toUpperCase(),
            text: text
          });
        }
      }
    }
  }

  // Extract correct answer
  const answerMatch = combined.match(/Correct\s*Answer:\s*([A-D])/i);
  if (answerMatch) {
    quiz.correctAnswer = answerMatch[1].toUpperCase();
  }

  // Extract reason - everything after "Reason:"
  const reasonMatch = combined.match(/Reason:\s*(.+)$/i);
  if (reasonMatch) {
    quiz.reason = reasonMatch[1].trim();
  }

  return quiz;
}

// ============================================================================
// OUTPUT FORMATTER
// ============================================================================

function formatOutput(phases) {
  const lines = [];

  for (const phase of phases) {
    // Phase header
    const phaseName = phase.name === 'CONNECT' ? 'Connect' : 'Discipline';
    lines.push(`Phase ${phase.number}: ${phaseName} (Days ${phase.startDay}–${phase.endDay})`);
    lines.push('');

    // Regular lessons
    for (const lesson of phase.lessons) {
      lines.push(...formatLesson(lesson, phase.name));
      lines.push('');
    }

    // Boosters
    if (phase.boosters.length > 0) {
      for (const booster of phase.boosters) {
        lines.push(...formatBooster(booster, phase.name));
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

function formatLesson(lesson, phaseName) {
  const lines = [];

  lines.push(`Day ${lesson.dayNumber}: ${lesson.title}`);

  // Short description
  if (lesson.shortDescription) {
    lines.push(lesson.shortDescription);
  }

  // Cards
  for (const card of lesson.cards) {
    lines.push(`Card ${card.order}: ${card.title}`);
    for (const bodyLine of card.body) {
      lines.push(bodyLine);
    }
  }

  // Quiz
  if (lesson.quiz && lesson.quiz.question) {
    lines.push(`Day ${lesson.dayNumber} Quiz`);
    lines.push(`Q: ${lesson.quiz.question}`);
    for (const opt of lesson.quiz.options) {
      lines.push(`${opt.label}. ${opt.text}`);
    }
    lines.push(`Correct Answer: ${lesson.quiz.correctAnswer}`);
    if (lesson.quiz.reason) {
      lines.push(`Reason: ${lesson.quiz.reason}`);
    }
  }

  return lines;
}

function formatBooster(booster, phaseName) {
  const lines = [];

  lines.push(`Booster: ${booster.title}`);

  // Short description
  if (booster.shortDescription) {
    lines.push(booster.shortDescription);
  }

  // Cards
  for (const card of booster.cards) {
    lines.push(`Card ${card.order}: ${card.title}`);
    for (const bodyLine of card.body) {
      lines.push(bodyLine);
    }
  }

  // Quiz
  if (booster.quiz && booster.quiz.question) {
    lines.push(`Booster Quiz`);
    lines.push(`Q: ${booster.quiz.question}`);
    for (const opt of booster.quiz.options) {
      lines.push(`${opt.label}. ${opt.text}`);
    }
    lines.push(`Correct Answer: ${booster.quiz.correctAnswer}`);
    if (booster.quiz.reason) {
      lines.push(`Reason: ${booster.quiz.reason}`);
    }
  }

  return lines;
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log('🚀 Converting RTF to standardized lesson format...\n');

  // Check input file
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputPath}`);
    process.exit(1);
  }

  // Convert RTF to HTML
  const html = convertRtfToHtml(inputPath);

  // Parse HTML
  console.log('📖 Parsing HTML content...');
  const elements = parseHtml(html);
  console.log(`   Found ${elements.length} elements`);

  // Build structure
  console.log('🏗️  Building lesson structure...');
  const phases = buildLessonStructure(elements);

  // Print summary
  for (const phase of phases) {
    console.log(`\n📖 Phase ${phase.number}: ${phase.name}`);
    console.log(`   Lessons: ${phase.lessons.length}`);
    console.log(`   Boosters: ${phase.boosters.length}`);
  }

  // Format output
  console.log('\n📝 Formatting output...');
  const output = formatOutput(phases);

  // Write output
  fs.writeFileSync(outputPath, output, 'utf-8');
  console.log(`\n✅ Output written to: ${outputPath}`);

  // Stats
  const totalLessons = phases.reduce((sum, p) => sum + p.lessons.length + p.boosters.length, 0);
  const totalCards = phases.reduce((sum, p) =>
    sum + p.lessons.reduce((s, l) => s + l.cards.length, 0) +
    p.boosters.reduce((s, b) => s + b.cards.length, 0), 0);

  console.log(`\n📊 Summary:`);
  console.log(`   Total lessons: ${totalLessons}`);
  console.log(`   Total cards: ${totalCards}`);
}

main();
