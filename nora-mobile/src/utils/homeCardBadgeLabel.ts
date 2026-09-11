/**
 * Badge text (HomeCardBadge.name, e.g. "Science Bite") is an admin-authored
 * English label, not per-card content, so it isn't translated via
 * HomeCardTranslation like message/attribution — it's a small fixed set in
 * practice (same exact-name vocabulary SubActionCard's icon lookup in
 * HomeScreen_v2.tsx matches against), so it's translated the same way as any
 * other static UI string: a lookup keyed by the exact English name into
 * homeV2.subActionBadges in the i18n locale files. Shared by SubActionCard
 * (HomeScreen_v2) and HomeCardDetailScreen so both surfaces agree. A badge
 * name that isn't in this set (e.g. one an admin just added) falls back to
 * showing the raw English name, same as the icon lookup falling back to no
 * icon.
 */
const HOME_CARD_BADGE_KEYS: Record<string, string> = {
  'Science Bite': 'homeV2.subActionBadges.scienceBite',
  'Try This Today': 'homeV2.subActionBadges.tryThisToday',
  'Quick Reflection': 'homeV2.subActionBadges.quickReflection',
  "Today's Thought": 'homeV2.subActionBadges.todaysThought',
  'Community Wisdom': 'homeV2.subActionBadges.communityWisdom',
};

export function getHomeCardBadgeLabel(t: (key: string) => string, badgeText: string): string {
  const key = HOME_CARD_BADGE_KEYS[badgeText];
  return key ? t(key) : badgeText;
}
