/**
 * Reformatter/cleanup for lesson-content.txt
 * Fixes formatting issues so import-all-lessons.cjs can parse the file correctly.
 * Can be run multiple times (idempotent).
 *
 * Usage: node scripts/reformat-lessons.cjs
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'lesson-content.txt');
const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
let lines = raw.split('\n');

// ============================================================================
// STEP 1: Remove Table of Contents (if present)
// ============================================================================

let tocEnd = -1;
let foundFirst = false;
for (let i = 0; i < lines.length; i++) {
  const clean = lines[i].replace(/\u200B/g, '').trim();
  if (clean.startsWith('Foundational Module')) {
    if (foundFirst) {
      tocEnd = i;
      break;
    }
    foundFirst = true;
  }
}

if (tocEnd > 0) {
  lines = lines.slice(tocEnd);
  console.log(`Removed TOC: first ${tocEnd} lines`);
}

// ============================================================================
// STEP 2: Join text and clean invisible characters
// ============================================================================

let text = lines.join('\n');
text = text.replace(/\u200B/g, '');
// Remove form feed characters (page breaks from document export)
text = text.replace(/\f/g, '');

// ============================================================================
// STEP 3: Fix Module headers → "Module: KEY"
// ============================================================================

// Foundational Module
text = text.replace(/^Foundational Module\s*\[Foundation\]\s*$/m, 'Module: FOUNDATION');

// Generic handler for "Module: Title\n[Key]" and "Module: Title\nWord[Key]" patterns
// Handle all multi-line variations with optional whitespace before newline
const moduleKeyMap = {
  'Managing Big Feelings & Tantrums': 'EMOTIONS',
  'Not Listening & Arguing': 'COOPERATION',
  'Navigating a New Baby': 'SIBLINGS',
  'Moving & School Changes': 'RELOCATION',
  'Social & Emotional Growth': 'DEVELOPMENT',
  'Stalling & Delaying': 'PROCRASTINATION',
  'Carelessness & Destruction': 'RESPONSIBILITY',
  'Aggression & Outbursts': 'AGGRESSION',
  'Picking Fights & Provocation': 'CONFLICT',
  'Disobedience & Defiance': 'DEFIANCE',
  'Problematic Sexual Behaviors': 'SAFETY',
};

// Multi-line: "Module: Title\n[Key]" (title on one line, [key] on next)
for (const [title, key] of Object.entries(moduleKeyMap)) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^Module:\\s*${escaped}\\s*\\n\\[${key.charAt(0)}${key.slice(1).toLowerCase()}\\]`, 'm');
  text = text.replace(re, `Module: ${key}`);
}

// Multi-line where title wraps: "Module: Part1\nPart2[Key]" or "Module: Part1\nPart2 [Key]"
text = text.replace(/^Module:\s*Navigating Parental\s*\nDivorce\s*\[Divorce\]/m, 'Module: DIVORCE');
text = text.replace(/^Module:\s*Screen Transitions & Device\s*\nConflicts\s*\[Screens\]/m, 'Module: SCREENS');
text = text.replace(/^Module:\s*Separation Anxiety & School\s*\nTransitions\s*\[Separation\]/m, 'Module: SEPARATION');

// Single-line: "Module: Title [Key]"
text = text.replace(/^Module:\s*Interrupting\s*\[Patience\]\s*$/m, 'Module: PATIENCE');
text = text.replace(/^Module:\s*Mealtime Troubles\s*\[Meals\]\s*$/m, 'Module: MEALS');
text = text.replace(/^Module:\s*Overactivity & Focus\s*\[Focus\]\s*$/m, 'Module: FOCUS');

// Catch-all: any remaining "Module: <anything>\n[Key]" patterns
// This handles cases where the title line has invisible chars or the generic loop missed it
text = text.replace(/^Module:[^\n]*\n\[(Emotions)\]\s*$/m, 'Module: EMOTIONS');
text = text.replace(/^Module:[^\n]*\n\[(Cooperation)\]\s*$/m, 'Module: COOPERATION');
text = text.replace(/^Module:[^\n]*\n\[(Siblings)\]\s*$/m, 'Module: SIBLINGS');
text = text.replace(/^Module:[^\n]*\n\[(Relocation)\]\s*$/m, 'Module: RELOCATION');
text = text.replace(/^Module:[^\n]*\n\[(Divorce)\]\s*$/m, 'Module: DIVORCE');
text = text.replace(/^Module:[^\n]*\n\[(Development)\]\s*$/m, 'Module: DEVELOPMENT');
text = text.replace(/^Module:[^\n]*\n\[(Procrastination)\]\s*$/m, 'Module: PROCRASTINATION');
text = text.replace(/^Module:[^\n]*\n\[(Responsibility)\]\s*$/m, 'Module: RESPONSIBILITY');
text = text.replace(/^Module:[^\n]*\n\[(Aggression)\]\s*$/m, 'Module: AGGRESSION');
text = text.replace(/^Module:[^\n]*\n\[(Conflict)\]\s*$/m, 'Module: CONFLICT');
text = text.replace(/^Module:[^\n]*\n\[(Defiance)\]\s*$/m, 'Module: DEFIANCE');
text = text.replace(/^Module:[^\n]*\n\[(Safety)\]\s*$/m, 'Module: SAFETY');
text = text.replace(/^Module:[^\n]*\n\[(Screens)\]\s*$/m, 'Module: SCREENS');
text = text.replace(/^Module:[^\n]*\n\[(Separation)\]\s*$/m, 'Module: SEPARATION');

// Also remove any orphaned [Key] lines that appear right after a Module: line
// (in case the Module line was already converted but [Key] remains)
text = text.replace(/^(Module: [A-Z]+)\n\[\w+\]\s*$/gm, '$1');

// ============================================================================
// STEP 3b: Fix SEPARATION module - add Day 1 header if missing
// The Separation module is a one-day module with no explicit Day header
// ============================================================================

text = text.replace(
  /^(Module: SEPARATION)\n((?!Day \d+:).+)$/m,
  '$1\nDay 1: Separation Anxiety & School Transitions\n$2'
);

// ============================================================================
// STEP 4: Remove Special Module (Temperament)
// ============================================================================

const specialIdx = text.search(/^Special Module:/m);
if (specialIdx !== -1) {
  text = text.substring(0, specialIdx).trimEnd() + '\n';
  console.log('Removed Special Module (Temperament)');
}

// ============================================================================
// STEP 5: Fix "Day 6 Why Ages" → "Day 6: Why Ages"
// ============================================================================

text = text.replace(/^(Day \d+) (Why )/m, '$1: $2');

// ============================================================================
// STEP 6: Remove bullet prefixes from all lines
// ============================================================================

// Remove ● (and surrounding whitespace) from card lines
text = text.replace(/^[●\u25CF]\s*/gm, '');

// ============================================================================
// STEP 7: Fix card titles - merge short titles with continuation lines
// then split title from body using sentence-starter heuristic
// ============================================================================

// Common sentence starters - words that begin body text (not titles)
const SENTENCE_STARTERS = new Set([
  'A', 'An', 'The', 'This', 'These', 'That', 'Those',
  'Your', 'Their', 'Its', 'Our', 'My', 'His', 'Her',
  'It', 'They', 'You', 'We', 'She', 'He', 'I',
  'For', 'When', 'While', 'If', 'By', 'After', 'Before', 'During',
  'Even', 'Instead', 'As', 'Although', 'Because', 'Since', 'Unless',
  'But', 'And', 'Or', 'So', 'Yet', 'However', 'Moreover',
  'In', 'At', 'On', 'From', 'With', 'To', 'Of',
  'Children', 'School', 'Research', 'Studies',
  'Once', 'Not', 'Only', 'Just', 'Already', 'Still', 'Never', 'Always',
  'Often', 'Many', 'Most', 'Some', 'All', 'Every', 'No', 'Each',
  "Don't", 'Do', 'Try', 'Use', 'Think', 'Give', 'Start', 'Stay',
  'Keep', 'Let', 'Make', 'Put', 'Take', 'Spend', 'Continue',
  'Notice', 'Avoid', 'Remember', 'Teach', 'Show', 'Say', 'Tell',
  'Set', 'Watch', 'Follow', 'Turn', 'Model', 'Describe',
  'Label', 'Catch', 'Mark', 'Celebrate', 'Draw', 'Create', 'Move',
  'Break', 'Narrate', 'Identify', 'Choose', 'Recognize', 'Practice',
  'Calm', 'Slow', 'Deep', 'Big', 'Both', 'Constant', 'Sitting',
  'Cleaning', 'Naming', 'Attempting',
  'Activities', 'Being', 'Going', 'Having', 'Making', 'Getting',
  'Divided', 'Sudden', 'Constant',
]);

function findSentenceBoundary(text, minTitleWords) {
  // Find where body text begins by looking for sentence starters
  // after at least minTitleWords words of title.
  // Requires the NEXT word after the starter to be lowercase
  // (titles use Title Case, body text uses sentence case).
  const words = text.split(/\s+/);

  // Only split if we have enough words to contain both title and body
  if (words.length <= 5) return -1;

  let charPos = 0;
  for (let w = 0; w < words.length; w++) {
    if (w > 0) charPos++; // space
    if (w >= minTitleWords && SENTENCE_STARTERS.has(words[w])) {
      // Check if next word is lowercase (sentence case = body text)
      if (w + 1 < words.length) {
        const nextWord = words[w + 1].replace(/^["'(]/, ''); // strip leading quotes
        if (nextWord.length > 0 && nextWord[0] === nextWord[0].toLowerCase() && nextWord[0] !== nextWord[0].toUpperCase()) {
          return charPos;
        }
      }
    }
    charPos += words[w].length;
  }
  return -1;
}

lines = text.split('\n');
let result = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const cardMatch = line.match(/^Card (\d+):\s*(.*)$/);

  if (!cardMatch) {
    result.push(line);
    continue;
  }

  const cardNum = cardMatch[1];
  let titleText = cardMatch[2].trim();

  // Function to check if a line is a section boundary
  const isSectionBoundary = (line) =>
    line.match(/^(Day \d+|Card \d+|Module:|Quiz$|Q:|[A-D][\).]|Correct Answer:|Reason:|\s*$)/);

  // Function to check if a line looks like body text (sentence start)
  const looksLikeSentence = (line) => {
    const words = line.trim().split(/\s+/);
    if (words.length < 2) return false;
    const firstWord = words[0].replace(/^["'(]/, '');
    const secondWord = words[1].replace(/^["'(]/, '');
    return SENTENCE_STARTERS.has(firstWord) &&
           secondWord.length > 0 &&
           secondWord[0] === secondWord[0].toLowerCase() &&
           secondWord[0] !== secondWord[0].toUpperCase();
  };

  // Function to check if title looks incomplete (ends with function word)
  const titleLooksIncomplete = (title) => {
    const lastWord = title.split(/\s+/).filter(Boolean).pop() || '';
    const cleanWord = lastWord.replace(/[,;:"""'']/g, '');
    const functionWords = new Set([
      'a', 'an', 'the', 'of', 'in', 'on', 'for', 'to', 'at', 'by',
      'from', 'with', 'about', 'and', 'or', 'but', 'nor', 'yet',
      'is', 'are', 'was', 'were', 'be', 'been',
      'your', 'their', 'its', 'our', 'my', 'his', 'her',
    ]);
    return functionWords.has(cleanWord.toLowerCase()) ||
           lastWord.endsWith('–') || lastWord.endsWith('-') ||
           lastWord.endsWith(',') || lastWord.endsWith('&') ||
           lastWord.endsWith('"') || lastWord.endsWith("'");
  };

  // Merge logic: merge with next line(s) if title appears truncated
  const titleWordCount = titleText.split(/\s+/).filter(Boolean).length;
  const shouldMerge = (titleWords, nextLine) => {
    if (!nextLine || isSectionBoundary(nextLine)) return false;
    const next = nextLine.trim();
    // Always merge very short titles (≤ 2 words)
    if (titleWords <= 2) return true;
    // Merge 3-4 word titles if they look incomplete
    if (titleWords <= 4 && titleLooksIncomplete(titleText)) return true;
    // Merge if next line is very short (≤ 25 chars) and doesn't look like a sentence
    if (titleWords <= 4 && next.length <= 25 && !next.includes('.') && !looksLikeSentence(nextLine)) return true;
    return false;
  };

  if (shouldMerge(titleWordCount, lines[i + 1])) {
    i++;
    titleText = titleText + ' ' + lines[i].trim();

    // After first merge, check if we need a second merge
    const mergedWords = titleText.split(/\s+/).filter(Boolean).length;
    if (mergedWords <= 4 && i + 1 < lines.length && shouldMerge(mergedWords, lines[i + 1])) {
      i++;
      titleText = titleText + ' ' + lines[i].trim();
    }
  }

  // Now try to split title from body in the merged text
  // Look for sentence boundary after at least 2 words of title
  const boundary = findSentenceBoundary(titleText, 2);
  if (boundary !== -1) {
    const title = titleText.substring(0, boundary).trim();
    const body = titleText.substring(boundary).trim();
    // Sanity check: title should be reasonable (2-10 words, no periods)
    const titleWords = title.split(/\s+/).length;
    if (titleWords >= 2 && titleWords <= 10 && !title.includes('.')) {
      result.push(`Card ${cardNum}: ${title}`);
      if (body) result.push(body);
      continue;
    }
  }

  // No split needed or possible - just output the card line
  result.push(`Card ${cardNum}: ${titleText}`);
}

text = result.join('\n');

// ============================================================================
// STEP 8: Fix Quiz sections
// Normalize various quiz prefixes and split inline options/answers
// ============================================================================

lines = text.split('\n');
result = [];

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  // Detect quiz question lines in various formats
  const quizMatch = line.match(/^(?:Day\s+\d+\s+)?(?:One-Day\s+)?(?:Quiz\s+)?Q:\s*(.+)$/);
  if (quizMatch) {
    let quizContent = quizMatch[1];

    // Gather continuation lines (including inline options A-D)
    // Stop at section boundaries or Correct Answer lines
    // Allow single blank lines within quiz content (some quiz options span blank lines)
    while (i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      if (nextLine.match(/^(Day \d+|Card \d+|Module:|Quiz$|Q:|Correct Answer:|Reason:)/)) {
        break;
      }
      if (nextLine.trim() === '') {
        // Allow blank line only if the line AFTER it continues the quiz
        if (i + 2 < lines.length) {
          const lineAfterBlank = lines[i + 2];
          if (lineAfterBlank.match(/^(Day \d+|Card \d+|Module:|Quiz$)/)) {
            break; // Blank before new section - stop
          }
          // Continue past blank if next content looks like quiz continuation
          if (lineAfterBlank.trim() !== '' &&
              (lineAfterBlank.match(/[A-D][\).]\s/) || lineAfterBlank.match(/Correct Answer:/) ||
               !lineAfterBlank.match(/^(Day|Card|Module|Quiz$)/))) {
            i++; // skip blank
            continue;
          }
        }
        break; // Default: stop at blank line
      }
      i++;
      quizContent += ' ' + lines[i].trim();
    }

    // Insert "Quiz" header (unless already present just above)
    if (result.length === 0 || result[result.length - 1].trim() !== 'Quiz') {
      result.push('Quiz');
    }

    // Extract question (everything before first option A/B/C/D)
    const optionStart = quizContent.search(/\s[A-D][\).]\s/);
    let question, remainder;
    if (optionStart !== -1) {
      question = quizContent.substring(0, optionStart).trim();
      remainder = quizContent.substring(optionStart).trim();
    } else {
      question = quizContent.trim();
      remainder = '';
    }

    result.push(`Q: ${question}`);

    if (remainder) {
      // Split into individual options
      const parts = remainder.split(/\s(?=[A-D][\).]\s)/);
      for (const part of parts) {
        const optMatch = part.match(/^([A-D])[\).]\s*(.+)$/);
        if (optMatch) {
          let optText = optMatch[2];

          // Check if "Correct Answer:" is embedded
          const correctIdx = optText.indexOf('Correct Answer:');
          if (correctIdx !== -1) {
            const optOnly = optText.substring(0, correctIdx).trim();
            const correctPart = optText.substring(correctIdx);
            result.push(`${optMatch[1]}) ${optOnly}`);

            const caMatch = correctPart.match(/Correct Answer:\s*([A-D])\s*Reason:\s*(.+)/s);
            if (caMatch) {
              result.push(`Correct Answer: ${caMatch[1]}`);
              result.push(`Reason: ${caMatch[2].trim()}`);
            } else {
              result.push(correctPart.trim());
            }
          } else {
            result.push(`${optMatch[1]}) ${optText}`);
          }
        }
      }
    }
    continue;
  }

  // Handle "Correct Answer: X Reason: text" on same line
  const standaloneCA = line.match(/^Correct Answer:\s*([A-D])\s+Reason:\s*(.+)$/);
  if (standaloneCA) {
    let reasonText = standaloneCA[2];
    while (i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      if (nextLine.trim() === '' ||
          nextLine.match(/^(Day \d+|Card \d+|Module:|Quiz$|Q:|[A-D][\).]|Correct Answer:|Reason:)/)) {
        break;
      }
      i++;
      reasonText += ' ' + lines[i].trim();
    }
    result.push(`Correct Answer: ${standaloneCA[1]}`);
    result.push(`Reason: ${reasonText.trim()}`);
    continue;
  }

  // Handle "D) option text. Correct Answer: X Reason: text" (option with embedded answer)
  const optWithAnswer = line.match(/^([A-D])[\).]\s*(.+?)\s*Correct Answer:\s*([A-D])\s*Reason:\s*(.+)$/);
  if (optWithAnswer) {
    result.push(`${optWithAnswer[1]}) ${optWithAnswer[2].trim()}`);
    let reasonText = optWithAnswer[4];
    while (i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      if (nextLine.trim() === '' ||
          nextLine.match(/^(Day \d+|Card \d+|Module:|Quiz$|Q:|[A-D][\).]|Correct Answer:|Reason:)/)) {
        break;
      }
      i++;
      reasonText += ' ' + lines[i].trim();
    }
    result.push(`Correct Answer: ${optWithAnswer[3]}`);
    result.push(`Reason: ${reasonText.trim()}`);
    continue;
  }

  // Handle Reason: continuation lines
  if (line.match(/^Reason:/) && i + 1 < lines.length) {
    let reasonLine = line;
    while (i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      if (nextLine.trim() === '' ||
          nextLine.match(/^(Day \d+|Card \d+|Module:|Quiz$|Q:|[A-D][\).]|Correct Answer:|Reason:)/)) {
        break;
      }
      i++;
      reasonLine += ' ' + lines[i].trim();
    }
    result.push(reasonLine);
    continue;
  }

  result.push(line);
}

text = result.join('\n');

// ============================================================================
// STEP 9: Clean up
// ============================================================================

// Collapse excessive blank lines
text = text.replace(/\n{4,}/g, '\n\n\n');

// Trim trailing whitespace per line
text = text.split('\n').map(l => l.trimEnd()).join('\n');

// Ensure single trailing newline
text = text.trimEnd() + '\n';

// ============================================================================
// Write output
// ============================================================================

fs.writeFileSync(filePath, text, 'utf-8');
console.log(`\nReformatted file written to: ${filePath}`);

// Stats
const moduleCount = (text.match(/^Module: [A-Z]+$/gm) || []).length;
const dayCount = (text.match(/^Day \d+:/gm) || []).length;
const cardCount = (text.match(/^Card \d+:/gm) || []).length;
const quizCount = (text.match(/^Quiz$/gm) || []).length;
const qCount = (text.match(/^Q: /gm) || []).length;

console.log(`\nStats:`);
console.log(`  Modules: ${moduleCount}`);
console.log(`  Days/Lessons: ${dayCount}`);
console.log(`  Cards: ${cardCount}`);
console.log(`  Quizzes (Quiz header): ${quizCount}`);
console.log(`  Questions (Q:): ${qCount}`);

// Validation: check for common issues
const shortTitles = [];
const cardLines = text.split('\n').filter(l => l.match(/^Card \d+:/));
for (const cl of cardLines) {
  const title = cl.replace(/^Card \d+:\s*/, '');
  if (title.split(/\s+/).length <= 2) {
    shortTitles.push(cl);
  }
}
if (shortTitles.length > 0) {
  console.log(`\nWarning: ${shortTitles.length} cards with very short titles (≤2 words):`);
  shortTitles.forEach(t => console.log(`  ${t}`));
}

const bracketModules = text.match(/^\[.*\]$/gm);
if (bracketModules) {
  console.log(`\nWarning: Found bracketed lines that may be unconverted module keys:`);
  bracketModules.forEach(m => console.log(`  ${m}`));
}
