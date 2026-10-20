'use strict';

/**
 * Special play time offers in the Learn module chat.
 *
 * When routines alone aren't working, the coach offers to add special play
 * time (the Play time card on the module's Today) by ending its reply with
 * the marker line `OFFER: special_play` (server/prompts/coach-screentime.txt).
 * The marker is kept in the stored message, so the app shows the offer's
 * fixed options under it (nora-mobile/src/utils/chatQuickReplies.ts), and
 * each offer is recorded as a SpecialPlayOffer row. The parent answers by
 * tapping an option (POST /api/learn-modules/:moduleKey/special-play) or by
 * typing (the coach's answer_special_play_offer tool). Accepting sets
 * User.specialPlayAddedAt, which shows the card.
 */

const prisma = require('./db.cjs');

const SPECIAL_PLAY_OFFER = 'special_play';
const OFFER_MARKER = `OFFER: ${SPECIAL_PLAY_OFFER}`;
// The marker on a line of its own, anywhere (the model may add bold or a
// full-width colon); OPTIONS lines are dropped with it, as the app shows the
// offer's own options.
const OFFER_LINE_RE = /^[ \t]*\**OFFER\**[ \t]*[:：][ \t]*\**special_play\**[ \t]*$/gim;
const OPTIONS_LINE_RE = /^[ \t]*\**OPTIONS\**[ \t]*[:：].*$/gim;
const RESPONSES = new Set(['accepted', 'declined']);

/**
 * Normalizes a module coach reply's offer marker: moved to the last line (no
 * OPTIONS line with it), or removed if the parent already has the card.
 * @returns {{ text: string, offered: boolean }}
 */
async function prepareOfferReply(userId, text) {
  if (!text.match(OFFER_LINE_RE)) return { text, offered: false };
  const body = text.replace(OFFER_LINE_RE, '').replace(OPTIONS_LINE_RE, '').trimEnd();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { specialPlayAddedAt: true } });
  if (user?.specialPlayAddedAt) return { text: body, offered: false };
  return { text: `${body}\n${OFFER_MARKER}`, offered: true };
}

function recordOffer(userId, moduleKey, messageId) {
  return prisma.specialPlayOffer.create({ data: { userId, moduleKey, messageId } });
}

/**
 * Records the parent's answer on their latest unanswered offer (or, when
 * they accept with none open, e.g. asked for it themselves, a new answered
 * row). Accepting adds the Play time card.
 * @param {'accepted'|'declined'} response
 * @param {'chip'|'chat'} via
 */
async function respondToOffer(userId, moduleKey, response, via) {
  if (!RESPONSES.has(response)) throw new Error(`Unknown special play response: ${response}`);
  const answer = { response, respondedVia: via, respondedAt: new Date() };
  const open = await prisma.specialPlayOffer.findFirst({
    where: { userId, moduleKey, response: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (open) {
    await prisma.specialPlayOffer.update({ where: { id: open.id }, data: answer });
  } else if (response === 'accepted') {
    await prisma.specialPlayOffer.create({ data: { userId, moduleKey, ...answer } });
  }
  if (response === 'accepted') {
    await prisma.user.updateMany({
      where: { id: userId, specialPlayAddedAt: null },
      data: { specialPlayAddedAt: new Date() },
    });
  }
  return { response };
}

module.exports = { SPECIAL_PLAY_OFFER, prepareOfferReply, recordOffer, respondToOffer };
