/**
 * Quick replies in coach chat messages. In a Learn module chat the coach may
 * end a message with one line `OPTIONS: <option> | <option> | ...` (see
 * server/prompts/coach-screentime.txt); the line is stored with the message
 * text, so it's split off here for display and shown as tappable chips.
 */

// Last line only; also accepts a full-width colon (Chinese replies).
const OPTIONS_LINE_RE = /\n?[ \t]*\**OPTIONS\**[:：][ \t]*([^\n]*)\s*$/i;

export function parseQuickReplies(text: string): { text: string; options: string[] } {
  const match = text.match(OPTIONS_LINE_RE);
  if (!match) return { text, options: [] };
  const options = match[1]
    .split('|')
    .map(o => o.trim())
    .filter(Boolean);
  return { text: text.slice(0, match.index).trimEnd(), options };
}
