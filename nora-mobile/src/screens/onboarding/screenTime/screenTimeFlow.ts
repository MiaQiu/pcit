/**
 * Screen-Time Onboarding Branch
 * Entered from ChildIssue when the parent picks "screen_time". Replicates the
 * Nora-Onboarding-1 prototype (github.com/MiaQiu/Nora-Onboarding-1) in the
 * app's onboarding style. Every step renders through ScreenTimeStepScreen,
 * which pushes `ScreenTimeStep` with the next index; the last step (plan)
 * saves the answers and finishes onboarding.
 *
 * Copy lives under `onboarding.screenTime.*`. Question keys:
 *   <id>.title, <id>.subtitle (optional), <id>.options.<value>
 * Option labels may have `_boy` / `_girl` variants (i18next context) for
 * pronouns; the base key is the gender-neutral fallback.
 */

export type ScreenTimeQuestionStep = {
  kind: 'question';
  id: string;
  // Field in OnboardingData.screenTime the answer is stored under
  field: string;
  options: string[];
  multi?: boolean;
  exclusive?: string[];
  // i18n key holding the option labels, when shared across steps
  optionsKey?: string;
  // i18n key for the title, when it isn't `<id>.title`
  titleKey?: string;
  subtitleKey?: string;
};

export type ScreenTimeInsightStep = {
  kind: 'insight';
  id: string;
  media?: 'dragon' | 'practiceScene' | 'playScene' | 'advisor';
};

export type ScreenTimePlanStep = { kind: 'plan'; id: 'plan' };

export type ScreenTimeStep = ScreenTimeQuestionStep | ScreenTimeInsightStep | ScreenTimePlanStep;

const AGREEMENT = ['strongly_disagree', 'somewhat_disagree', 'somewhat_agree', 'agree'];
const FREQUENCY = ['almost_never', 'rarely', 'quite_often', 'almost_always'];

// Problematic media use statements, one screen each
export const PMUM_COUNT = 9;
// Observation-only "hidden signal" questions, one screen each
export const SIGNAL_COUNT = 6;

export const HARDEST_OPTIONS = ['stop', 'more', 'upset', 'after', 'argue'];
export const STOP_OPTIONS = ['asks', 'ignores', 'whines', 'meltdown', 'hits'];
export const STRATEGY_OPTIONS = ['warning', 'timer', 'rules', 'activity', 'explaining', 'extra', 'away'];
export const GOAL_OPTIONS = ['meltdowns', 'recovery', 'yelling', 'transitions', 'confidence'];

export const SCREEN_TIME_STEPS: ScreenTimeStep[] = [
  { kind: 'insight', id: 'intro', media: 'dragon' },
  { kind: 'question', id: 'hardest', field: 'hardest', options: HARDEST_OPTIONS },
  ...Array.from({ length: PMUM_COUNT }, (_, i): ScreenTimeQuestionStep => ({
    kind: 'question',
    id: `pmum${i}`,
    field: `pmum${i}`,
    options: AGREEMENT,
    optionsKey: 'agreement',
    titleKey: `pmum.statement${i}`,
    subtitleKey: 'pmum.prompt',
  })),
  { kind: 'question', id: 'stops', field: 'stops', options: STOP_OPTIONS, multi: true },
  { kind: 'question', id: 'dopamine', field: 'dopamine', options: ['yes', 'no'], optionsKey: 'yesNo' },
  { kind: 'insight', id: 'context' },
  {
    kind: 'question',
    id: 'differences',
    field: 'differences',
    options: ['none', 'developmental_delays', 'adhd', 'asd', 'anxiety', 'another', 'suspected'],
    multi: true,
    exclusive: ['none'],
  },
  { kind: 'question', id: 'strategies', field: 'strategies', options: STRATEGY_OPTIONS, multi: true },
  { kind: 'question', id: 'worked', field: 'worked', options: ['smoothly', 'improvement', 'sometimes', 'no_change', 'harder'] },
  { kind: 'question', id: 'stress', field: 'stress', options: ['manageable', 'somewhat', 'very', 'overwhelming'] },
  { kind: 'question', id: 'teen', field: 'teen', options: ['yes', 'no', 'not_sure'] },
  { kind: 'question', id: 'barriers', field: 'barriers', options: ['resistance', 'burnout', 'meltdowns', 'consistency', 'progress'] },
  { kind: 'question', id: 'goal', field: 'goal', options: GOAL_OPTIONS },
  { kind: 'insight', id: 'why' },
  ...Array.from({ length: SIGNAL_COUNT }, (_, i): ScreenTimeQuestionStep => ({
    kind: 'question',
    id: `signal${i}`,
    field: `signal${i}`,
    options: FREQUENCY,
    optionsKey: 'frequency',
    titleKey: `signals.question${i}`,
  })),
  { kind: 'question', id: 'cortex', field: 'cortex', options: ['yes', 'not_really'] },
  { kind: 'insight', id: 'cortexHelp' },
  { kind: 'insight', id: 'windows' },
  { kind: 'insight', id: 'practice', media: 'practiceScene' },
  { kind: 'insight', id: 'transition' },
  { kind: 'question', id: 'playAwareness', field: 'playAwareness', options: ['yes', 'no'], optionsKey: 'yesNo' },
  { kind: 'insight', id: 'play', media: 'playScene' },
  { kind: 'insight', id: 'nora', media: 'advisor' },
  { kind: 'plan', id: 'plan' },
];

export type ScreenTimeAnswers = Record<string, string | string[]>;

// DEV ONLY: filled in when a dev force-landing passes `devSample`, so a jump
// straight to the plan shows every section
export const DEV_SAMPLE_ANSWERS: ScreenTimeAnswers = {
  hardest: 'upset',
  stops: ['asks', 'meltdown'],
  strategies: ['warning', 'timer'],
  goal: 'transitions',
};

/** Shapes the flat answers into the object saved as User.screenTimeIntake. */
export function buildScreenTimeIntake(answers: ScreenTimeAnswers) {
  const pick = (key: string) => answers[key] ?? null;
  return {
    version: 1,
    hardest: pick('hardest'),
    pmum: Array.from({ length: PMUM_COUNT }, (_, i) => pick(`pmum${i}`)),
    stops: pick('stops'),
    dopamine: pick('dopamine'),
    differences: pick('differences'),
    strategies: pick('strategies'),
    worked: pick('worked'),
    stress: pick('stress'),
    teen: pick('teen'),
    barriers: pick('barriers'),
    goal: pick('goal'),
    signals: Array.from({ length: SIGNAL_COUNT }, (_, i) => pick(`signal${i}`)),
    cortex: pick('cortex'),
    playAwareness: pick('playAwareness'),
    completedAt: new Date().toISOString(),
  };
}

/** i18next context for pronoun variants: 'boy' | 'girl' | undefined (neutral). */
export function genderContext(childGender: string | null | undefined): 'boy' | 'girl' | undefined {
  if (childGender === 'BOY') return 'boy';
  if (childGender === 'GIRL') return 'girl';
  return undefined;
}

/** Whole years since birthday, or null when unknown. */
export function childAgeYears(birthday: Date | string | null | undefined): number | null {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age -= 1;
  return Math.max(0, age);
}
