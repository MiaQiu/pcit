/**
 * Derives the title/subtitle pair used everywhere a Home Card is shared
 * from (SubActionCard's feed card, HomeCardDetailScreen) so the WhatsApp
 * share text always matches the card's own share-image, regardless of
 * which screen the share was started from. Mirrors the server-side split
 * in server/routes/config.cjs's GET /home-cards/:id/share-image.png.
 */

// Strips the lightweight markdown syntax used in card message text
// (**bold**, *italic*, "* " bullets, "### " headings, image lines) down to
// plain text for a share message, which has no rich-text rendering.
export function stripMarkdownForShare(text: string): string {
  return (text || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\*\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();
}

export function getHomeCardShareText(card: {
  cardType: string;
  message: string;
  attribution?: string | null;
}): { title: string; subtitle?: string } {
  if (card.cardType === 'QUOTE') {
    return {
      title: stripMarkdownForShare(card.message),
      subtitle: card.attribution ? stripMarkdownForShare(card.attribution) : undefined,
    };
  }
  const newlineIndex = card.message.indexOf('\n');
  if (newlineIndex === -1) {
    return { title: stripMarkdownForShare(card.message) };
  }
  return {
    title: stripMarkdownForShare(card.message.slice(0, newlineIndex)),
    subtitle: stripMarkdownForShare(card.message.slice(newlineIndex + 1)),
  };
}
