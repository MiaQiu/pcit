/**
 * Lightweight parser for LessonViewerScreen_v2 content: **bold**, *italic*,
 * ||folded|| (hidden behind a tap-to-reveal toggle — see
 * DemoVideoDetailScreen's FaqAccordion), "* " bullets, "### " headings,
 * "---" dividers, ![](url) images / ![video](url) videos on their own
 * line, and blank-line paragraph breaks. Mirrors the authoring convention
 * already used for LessonSegment.bodyText, kept intentionally separate
 * from the segment-card formatter in LessonViewerScreen.tsx (which is
 * coupled to keyword highlighting).
 */

export type ContentBlock =
  | { type: 'paragraph'; runs: TextRun[] }
  | { type: 'bullet'; runs: TextRun[] }
  | { type: 'heading'; runs: TextRun[] }
  | { type: 'image'; url: string }
  | { type: 'video'; url: string };

export interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  // Wrapped in ||...|| by the author -- hidden behind a tap-to-reveal
  // toggle (see DemoVideoDetailScreen's FaqAccordion). When true, this
  // run's own text is always empty and the real content lives in
  // foldedBlocks instead, recursively parsed so a fold can itself contain
  // bullets/paragraphs/bold/italic, not just plain text. Ignored (always
  // shown, never hidden) by flattenBlocksToChunks/LiveScriptCard's
  // word-highlighting mode below, since hiding words mid-narration
  // wouldn't make sense there.
  folded: boolean;
  foldedBlocks?: ContentBlock[];
}

const IMAGE_LINE = /^!\[\]\(([^)]+)\)$/;
const VIDEO_LINE = /^!\[video\]\(([^)]+)\)$/;
const HEADING_LINE = /^#{1,6}\s+(.+)$/;
const DIVIDER_LINE = /^-{3,}$/;

// ||...|| can span multiple lines and contain its own bullets/paragraphs
// (e.g. an FAQ answer that itself has a bulleted list), so it can't be
// matched per-line like bold/italic -- a bullet line inside it would get
// mistaken for a new top-level block. Instead it's extracted from the raw
// content up front, before line splitting: each match is replaced by a
// single-line placeholder token wrapping the fold's index in double
// square brackets (a sequence an author won't otherwise type), so the
// line-based block parser below sees one ordinary short line in its
// place. The captured inner text is parsed recursively -- via this same
// function -- once a run reaches the placeholder
// (parseRunsWithPlaceholders).
const FOLD_PLACEHOLDER_OPEN = '[[FOLD:';
const FOLD_PLACEHOLDER_CLOSE = ']]';
const FOLD_PLACEHOLDER_REGEX = /\[\[FOLD:(\d+)\]\]/g;

function extractFolds(content: string): { text: string; folds: string[] } {
  const folds: string[] = [];
  const text = content.replace(/\|\|([\s\S]+?)\|\|/g, (_match, inner: string) => {
    const index = folds.length;
    folds.push(inner);
    return FOLD_PLACEHOLDER_OPEN + index + FOLD_PLACEHOLDER_CLOSE;
  });
  return { text, folds };
}

function parseItalicRuns(text: string, bold: boolean): TextRun[] {
  const runs: TextRun[] = [];
  const italicRegex = /\*(.+?)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = italicRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push({ text: text.slice(lastIndex, match.index), bold, italic: false, folded: false });
    }
    runs.push({ text: match[1], bold, italic: true, folded: false });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    runs.push({ text: text.slice(lastIndex), bold, italic: false, folded: false });
  }
  return runs.length > 0 ? runs : [{ text: '', bold, italic: false, folded: false }];
}

function parseRuns(line: string): TextRun[] {
  const runs: TextRun[] = [];
  const boldRegex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = boldRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      runs.push(...parseItalicRuns(line.slice(lastIndex, match.index), false));
    }
    runs.push({ text: match[1], bold: true, italic: false, folded: false });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) {
    runs.push(...parseItalicRuns(line.slice(lastIndex), false));
  }
  return runs.length > 0 ? runs : [{ text: '', bold: false, italic: false, folded: false }];
}

// Splits on fold placeholder tokens first (highest priority, like image/video
// markers get their own line), delegating everything else to the bold/italic
// parser. A placeholder always becomes its own isolated run -- regardless of
// adjacent whitespace/text -- carrying the fold's recursively parsed content
// in foldedBlocks instead of a literal text value.
function parseRunsWithPlaceholders(line: string, folds: string[]): TextRun[] {
  const runs: TextRun[] = [];
  const regex = new RegExp(FOLD_PLACEHOLDER_REGEX.source, 'g');
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      runs.push(...parseRuns(line.slice(lastIndex, match.index)));
    }
    const foldIndex = Number(match[1]);
    runs.push({
      text: '',
      bold: false,
      italic: false,
      folded: true,
      foldedBlocks: formatLessonContentV2(folds[foldIndex] ?? ''),
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) {
    runs.push(...parseRuns(line.slice(lastIndex)));
  }
  return runs.length > 0 ? runs : [{ text: '', bold: false, italic: false, folded: false }];
}

export function formatLessonContentV2(content: string): ContentBlock[] {
  const { text: extracted, folds } = extractFolds(content);
  const lines = extracted.replace(/\r\n/g, '\n').split('\n');
  const blocks: ContentBlock[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push({ type: 'paragraph', runs: parseRunsWithPlaceholders(paragraphLines.join(' '), folds) });
    paragraphLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '') {
      flushParagraph();
      continue;
    }
    const videoMatch = line.match(VIDEO_LINE);
    if (videoMatch) {
      flushParagraph();
      blocks.push({ type: 'video', url: videoMatch[1] });
      continue;
    }
    const imageMatch = line.match(IMAGE_LINE);
    if (imageMatch) {
      flushParagraph();
      blocks.push({ type: 'image', url: imageMatch[1] });
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
      blocks.push({ type: 'heading', runs: parseRunsWithPlaceholders(headingMatch[1], folds) });
      continue;
    }
    if (line.startsWith('* ')) {
      flushParagraph();
      blocks.push({ type: 'bullet', runs: parseRunsWithPlaceholders(line.slice(2), folds) });
      continue;
    }
    paragraphLines.push(line);
  }
  flushParagraph();

  return blocks;
}

// ---------------------------------------------------------------------------
// Chunk-level flattening -- used by LiveScriptCard's live-highlighting mode
// so it can show **bold**/bullets/images/videos from contentV2 (the
// admin-edited source of truth) while still advancing word-by-word during
// playback. Kept separate from wordTimings, whose word list comes straight
// from the original audio transcription and can drift from contentV2 once
// an admin edits the text (removing filler words, changing punctuation,
// adding media, etc). Image/video blocks always become their own chunk (no
// words) so they render in place -- and stay visible -- instead of being
// silently dropped by a text-only flatten.
// ---------------------------------------------------------------------------

export interface DisplayWord {
  text: string;
  bold: boolean;
  italic: boolean;
}

export type DisplayChunk =
  | { type: 'sentence'; words: DisplayWord[] }
  | { type: 'image'; url: string }
  | { type: 'video'; url: string };

const SENTENCE_END = /[.!?。！？]["')\]]?$/;

// CJK ideographs carry no whitespace between words, so a plain \s+ split
// collapses an entire Chinese paragraph into a single "word" for highlighting
// purposes. Tokenize each CJK character as its own unit while keeping
// whitespace-delimited runs (English, numbers, etc.) grouped as before.
// Must stay in sync with the server-side port in
// server/utils/lessonContentTokenizer.cjs (used to generate wordTimings) --
// LiveScriptCard falls back to a crude position/duration estimate for the
// whole lesson if the word count here doesn't exactly match wordTimings.length.
const CJK_CHAR = '\\u4E00-\\u9FFF\\u3400-\\u4DBF\\uF900-\\uFAFF';
const TOKEN_REGEX = new RegExp(`[${CJK_CHAR}]|[^\\s${CJK_CHAR}]+`, 'g');

export function tokenizeWords(text: string): string[] {
  return text.match(TOKEN_REGEX) ?? [];
}

export function flattenBlocksToChunks(blocks: ContentBlock[]): DisplayChunk[] {
  const chunks: DisplayChunk[] = [];

  for (const block of blocks) {
    if (block.type === 'image') {
      chunks.push({ type: 'image', url: block.url });
      continue;
    }
    if (block.type === 'video') {
      chunks.push({ type: 'video', url: block.url });
      continue;
    }

    let current: DisplayWord[] = [];
    for (const run of block.runs) {
      for (const text of tokenizeWords(run.text)) {
        current.push({ text, bold: run.bold, italic: run.italic });
        if (SENTENCE_END.test(text)) {
          chunks.push({ type: 'sentence', words: current });
          current = [];
        }
      }
    }
    if (current.length > 0) chunks.push({ type: 'sentence', words: current });
  }

  return chunks;
}

/** Total word count across all 'sentence' chunks (images don't count as words). */
export function countChunkWords(chunks: DisplayChunk[]): number {
  return chunks.reduce((sum, c) => (c.type === 'sentence' ? sum + c.words.length : sum), 0);
}
