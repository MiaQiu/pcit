/**
 * Lightweight parser for LessonViewerScreen_v2 content: **bold**, "* " bullets,
 * ![](url) images / ![video](url) videos on their own line, and blank-line
 * paragraph breaks. Mirrors the authoring convention already used for
 * LessonSegment.bodyText, kept intentionally separate from the segment-card
 * formatter in LessonViewerScreen.tsx (which is coupled to keyword
 * highlighting).
 */

export type ContentBlock =
  | { type: 'paragraph'; runs: TextRun[] }
  | { type: 'bullet'; runs: TextRun[] }
  | { type: 'image'; url: string }
  | { type: 'video'; url: string };

export interface TextRun {
  text: string;
  bold: boolean;
}

const IMAGE_LINE = /^!\[\]\(([^)]+)\)$/;
const VIDEO_LINE = /^!\[video\]\(([^)]+)\)$/;

function parseRuns(line: string): TextRun[] {
  const runs: TextRun[] = [];
  const boldRegex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = boldRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      runs.push({ text: line.slice(lastIndex, match.index), bold: false });
    }
    runs.push({ text: match[1], bold: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) {
    runs.push({ text: line.slice(lastIndex), bold: false });
  }
  return runs.length > 0 ? runs : [{ text: '', bold: false }];
}

export function formatLessonContentV2(content: string): ContentBlock[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: ContentBlock[] = [];
  let paragraphLines: string[] = [];

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

// ---------------------------------------------------------------------------
// Chunk-level flattening — used by LiveScriptCard's live-highlighting mode so
// it can show **bold**/bullets/images/videos from contentV2 (the admin-edited
// source of truth) while still advancing word-by-word during playback. Kept
// separate from wordTimings, whose word list comes straight from the original
// audio transcription and can drift from contentV2 once an admin edits the
// text (removing filler words, changing punctuation, adding media, etc).
// Image/video blocks always become their own chunk (no words) so they render
// in place — and stay visible — instead of being silently dropped by a
// text-only flatten.
// ---------------------------------------------------------------------------

export interface DisplayWord {
  text: string;
  bold: boolean;
}

export type DisplayChunk =
  | { type: 'sentence'; words: DisplayWord[] }
  | { type: 'image'; url: string }
  | { type: 'video'; url: string };

const SENTENCE_END = /[.!?]["')\]]?$/;

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
      for (const text of run.text.split(/\s+/).filter(Boolean)) {
        current.push({ text, bold: run.bold });
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
