'use strict';

/**
 * Server-side port of nora-mobile/src/utils/formatLessonContentV2.ts.
 * Must be kept in sync with that file -- both parse the same contentV2
 * markup and tokenize words the same way, so wordTimings generated here
 * always match the word count the mobile app computes for display and
 * highlighting (LiveScriptCard.tsx falls back to a crude position/duration
 * estimate for the whole lesson if the counts don't match exactly).
 */

const IMAGE_LINE = /^!\[\]\(([^)]+)\)$/;
const VIDEO_LINE = /^!\[video\]\(([^)]+)\)$/;
const HEADING_LINE = /^#{1,6}\s+(.+)$/;
const DIVIDER_LINE = /^-{3,}$/;

// See the matching comment in formatLessonContentV2.ts for why CJK characters
// are tokenized individually instead of via whitespace splitting.
const CJK_CHAR = '\\u4E00-\\u9FFF\\u3400-\\u4DBF\\uF900-\\uFAFF';
const TOKEN_REGEX = new RegExp(`[${CJK_CHAR}]|[^\\s${CJK_CHAR}]+`, 'g');
const CJK_CHAR_TEST = new RegExp(`[${CJK_CHAR}]`);

function tokenizeWords(text) {
  return text.match(TOKEN_REGEX) ?? [];
}

function parseItalicRuns(text, bold) {
  const runs = [];
  const italicRegex = /\*(.+?)\*/g;
  let lastIndex = 0;
  let match;
  while ((match = italicRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push({ text: text.slice(lastIndex, match.index), bold, italic: false });
    }
    runs.push({ text: match[1], bold, italic: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    runs.push({ text: text.slice(lastIndex), bold, italic: false });
  }
  return runs.length > 0 ? runs : [{ text: '', bold, italic: false }];
}

function parseRuns(line) {
  const runs = [];
  const boldRegex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;
  while ((match = boldRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      runs.push(...parseItalicRuns(line.slice(lastIndex, match.index), false));
    }
    runs.push({ text: match[1], bold: true, italic: false });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) {
    runs.push(...parseItalicRuns(line.slice(lastIndex), false));
  }
  return runs.length > 0 ? runs : [{ text: '', bold: false, italic: false }];
}

function formatLessonContentV2(content) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let paragraphLines = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push({ type: 'paragraph', runs: parseRuns(paragraphLines.join(' ')) });
    paragraphLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '') {
      flushParagraph();
      continue;
    }
    if (VIDEO_LINE.test(line)) {
      flushParagraph();
      blocks.push({ type: 'video' });
      continue;
    }
    if (IMAGE_LINE.test(line)) {
      flushParagraph();
      blocks.push({ type: 'image' });
      continue;
    }
    if (DIVIDER_LINE.test(line)) {
      // Purely decorative -- flush and drop, same as a blank line.
      flushParagraph();
      continue;
    }
    const headingMatch = line.match(HEADING_LINE);
    if (headingMatch) {
      flushParagraph();
      blocks.push({ type: 'heading', runs: parseRuns(headingMatch[1]) });
      continue;
    }
    if (line.startsWith('* ')) {
      flushParagraph();
      blocks.push({ type: 'bullet', runs: parseRuns(line.slice(2)) });
      continue;
    }
    paragraphLines.push(line);
  }
  flushParagraph();

  return blocks;
}

/**
 * Word-boundary scanner operating on a codepoint array (not a raw JS string).
 * Needed because JS string indices/.length count UTF-16 code units, but
 * ElevenLabs' returned character-alignment arrays count one entry per
 * Unicode codepoint (e.g. an emoji is 2 JS string units but 1 alignment
 * entry) -- mixing the two indexing schemes silently misaligns every word
 * timing after the first surrogate-pair character (emoji, etc).
 * @param {string[]} cps - codepoints, e.g. from Array.from(str)
 * @returns {Array<{start: number, end: number}>} - codepoint-index spans
 */
function tokenizeCodepoints(cps) {
  const words = [];
  let i = 0;
  while (i < cps.length) {
    if (/\s/.test(cps[i])) { i++; continue; }
    if (CJK_CHAR_TEST.test(cps[i])) {
      words.push({ start: i, end: i + 1 });
      i++;
      continue;
    }
    let j = i;
    while (j < cps.length && !/\s/.test(cps[j]) && !CJK_CHAR_TEST.test(cps[j])) j++;
    words.push({ start: i, end: j });
    i = j;
  }
  return words;
}

/**
 * Build a narration plan: plain text to send to a TTS engine, split into
 * <= maxChunkChars chunks at block (paragraph/bullet) boundaries, with each
 * chunk's word list given as {start, end} CODEPOINT offsets into that
 * chunk's text (see tokenizeCodepoints for why codepoints, not JS string
 * indices). Word count/order for each chunk exactly matches what the mobile
 * client computes via formatLessonContentV2 + tokenizeWords (same run-by-run
 * splitting, including the forced split at every bold/non-bold boundary even
 * without surrounding whitespace), so wordTimings built from these offsets
 * always line up with the client's own word count check.
 * @param {string} contentV2
 * @param {number} [maxChunkChars]
 * @returns {Array<{text: string, words: Array<{start: number, end: number}>}>}
 */
function buildNarrationPlan(contentV2, maxChunkChars = 4000) {
  if (!contentV2) return [];

  const blocks = formatLessonContentV2(contentV2);
  const textBlocks = [];

  for (const block of blocks) {
    if (block.type === 'image' || block.type === 'video') continue;

    // Tokenize each run separately (not the whole block concatenated) so a
    // bold/non-bold run boundary always forces a word split, matching the
    // client's flattenBlocksToChunks (which iterates block.runs and tokenizes
    // each run's text independently) -- e.g. "**play**." must split into
    // "play" + "." even though there's no whitespace at that boundary.
    let cps = [];
    let words = [];
    for (const run of block.runs) {
      const runCps = Array.from(run.text);
      const runOffset = cps.length;
      words = words.concat(tokenizeCodepoints(runCps).map((w) => ({ start: w.start + runOffset, end: w.end + runOffset })));
      cps = cps.concat(runCps);
    }
    if (words.length > 0) {
      textBlocks.push({ cps, words });
    }
  }

  const chunks = [];
  let curCps = [];
  let curWords = [];

  for (const tb of textBlocks) {
    const candidateLength = curCps.length + (curCps.length ? 2 : 0) + tb.cps.length;
    if (candidateLength > maxChunkChars && curCps.length) {
      chunks.push({ text: curCps.join(''), words: curWords });
      curCps = tb.cps.slice();
      curWords = tb.words.map((w) => ({ ...w }));
    } else {
      const offset = curCps.length ? curCps.length + 2 : 0;
      if (curCps.length) curCps = curCps.concat(['\n', '\n']);
      curCps = curCps.concat(tb.cps);
      curWords = curWords.concat(tb.words.map((w) => ({ start: w.start + offset, end: w.end + offset })));
    }
  }
  if (curCps.length) chunks.push({ text: curCps.join(''), words: curWords });

  return chunks;
}

module.exports = {
  parseRuns,
  formatLessonContentV2,
  tokenizeWords,
  buildNarrationPlan,
};
