/**
 * Quick replies in coach chat messages. In a Learn module chat the coach may
 * end a message with one line `OPTIONS: <option> | <option> | ...` (see
 * server/prompts/coach-screentime.txt); the line is stored with the message
 * text, so it's split off here for display and shown as tappable chips.
 *
 * Or with an offer marker, `OFFER: special_play` (server/services/
 * specialPlayOffer.cjs), whose options are fixed app text.
 */

// Last line only; also accepts a full-width colon (Chinese replies).
const OPTIONS_LINE_RE = /\n?[ \t]*\**OPTIONS\**[:：][ \t]*([^\n]*)\s*$/i;
const OFFER_LINE_RE = /\n?[ \t]*OFFER:[ \t]*([a-z_]+)\s*$/;

export type ChatOffer = 'special_play';

export function parseQuickReplies(text: string): { text: string; options: string[]; offer: ChatOffer | null } {
  const offerMatch = text.match(OFFER_LINE_RE);
  if (offerMatch) {
    return {
      text: text.slice(0, offerMatch.index).trimEnd(),
      options: [],
      offer: offerMatch[1] === 'special_play' ? 'special_play' : null,
    };
  }
  const match = text.match(OPTIONS_LINE_RE);
  if (!match) return { text, options: [], offer: null };
  const options = match[1]
    .split('|')
    .map(o => o.trim())
    .filter(Boolean);
  return { text: text.slice(0, match.index).trimEnd(), options, offer: null };
}
