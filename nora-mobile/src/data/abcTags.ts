export type AgeTier = 'toddler' | 'school';

export interface TagSet {
  antecedents: string[];
  behaviors: string[];
  consequences: string[];
}

export const DEFAULT_TAGS: Record<AgeTier, TagSet> = {
  toddler: {
    antecedents: [
      "🛑 Told 'No'",
      '⏳ Activity Transition',
      '🧸 Sharing Conflict',
      '🥱 Tired / Hungry',
      '🍽️ Routine Interruption',
    ],
    behaviors: [
      '😭 Screaming / Tantrum',
      '🦷 Biting / Scratching',
      '🧎 Flopping to Floor',
      '🧸 Throwing Objects',
      '🏃 Elopement (Running Away)',
    ],
    consequences: [
      '🔄 Verbal Redirection',
      '🧸 Offered Sensory Comfort',
      '🙈 Planned Ignoring',
      '🛑 Time-out Chair',
      '🌟 Labeled Praise After Calm',
    ],
  },
  school: {
    antecedents: [
      '📋 Task Demand (Homework/Chores)',
      '🛑 Screen Time Ended',
      '🎮 Losing a Game',
      '👥 Sibling / Peer Conflict',
      '🏫 School Transition',
    ],
    behaviors: [
      "🗣️ Verbal Defiance ('No!')",
      '🚪 Slamming Doors',
      '💥 Physical Aggression',
      '😭 Emotional Meltdown',
      '🛑 Refusing to Comply',
    ],
    consequences: [
      '📱 Loss of Screen Privilege',
      '🚪 Sent to Quiet Space',
      '🗣️ Direct Instruction Repeated',
      '🌟 Token / Reward Earned',
      '🛑 Clear Command + Time-out Chair',
    ],
  },
};

export const INTENSITY_LABELS: Record<number, string> = {
  1: 'Mild — Whining / Fidgeting',
  2: 'Moderate — Disruptive / Aggressive Language',
  3: 'Severe — Safety Risk / Hitting / Elopement',
};

export const DURATION_BUCKETS = [
  'Less than 2 minutes',
  '2–5 minutes',
  '5–15 minutes',
  '15–30 minutes',
  'More than 30 minutes',
] as const;

export type DurationBucket = typeof DURATION_BUCKETS[number];
