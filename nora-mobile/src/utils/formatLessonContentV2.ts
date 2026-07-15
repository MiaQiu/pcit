/**
 * Lightweight parser for LessonViewerScreen_v2 content: **bold**, "* " bullets,
 * and blank-line paragraph breaks. Mirrors the authoring convention already used
 * for LessonSegment.bodyText, kept intentionally separate from the segment-card
 * formatter in LessonViewerScreen.tsx (which is coupled to keyword highlighting).
 */

export type ContentBlock =
  | { type: 'paragraph'; runs: TextRun[] }
  | { type: 'bullet'; runs: TextRun[] };

export interface TextRun {
  text: string;
  bold: boolean;
}

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
