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
  // Only shown on these paths (see screenTimePath); every path when unset
  paths?: ScreenTimePath[];
};

export type ScreenTimeInsightStep = {
  kind: 'insight';
  id: string;
  media?: 'practiceScene' | 'playScene' | 'advisor';
  // Copy differs by path: lives under `<id>.<path>.*` instead of `<id>.*`
  byPath?: boolean;
  paths?: ScreenTimePath[];
};

/**
 * The branch splits on the differences answer: 'none' when the parent picked
 * only "None that I know of" (or skipped it), 'differences' when they picked
 * any difference, including a suspected one.
 */
export type ScreenTimePath = 'none' | 'differences';

export type ScreenTimePlanStep = { kind: 'plan'; id: 'plan' };

export type ScreenTimeStep = ScreenTimeQuestionStep | ScreenTimeInsightStep | ScreenTimePlanStep;

const AGREEMENT = ['strongly_disagree', 'somewhat_disagree', 'somewhat_agree', 'agree'];
const FREQUENCY = ['almost_never', 'rarely', 'quite_often', 'almost_always'];

// Problematic media use statements, one screen each
export const PMUM_COUNT = 9;
// Observation-only "hidden signal" questions, one screen each
export const SIGNAL_COUNT = 6;

export const HARDEST_OPTIONS = ['resist', 'long_meltdowns', 'stay_calm', 'consistency', 'exhausted'];
export const STRATEGY_OPTIONS = ['warning', 'timer', 'rules', 'activity', 'explaining', 'extra', 'away'];

export const SCREEN_TIME_STEPS: ScreenTimeStep[] = [
  { kind: 'insight', id: 'intro' },
  ...Array.from({ length: PMUM_COUNT }, (_, i): ScreenTimeQuestionStep => ({
    kind: 'question',
    id: `pmum${i}`,
    field: `pmum${i}`,
    options: AGREEMENT,
    optionsKey: 'agreement',
    titleKey: `pmum.statement${i}`,
    subtitleKey: 'pmum.prompt',
  })),
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
  { kind: 'question', id: 'hardest', field: 'hardest', options: HARDEST_OPTIONS },
  { kind: 'question', id: 'teen', field: 'teen', options: ['yes', 'no', 'not_sure'] },
  { kind: 'insight', id: 'why', byPath: true },
  ...Array.from({ length: SIGNAL_COUNT }, (_, i): ScreenTimeQuestionStep => ({
    kind: 'question',
    id: `signal${i}`,
    field: `signal${i}`,
    options: FREQUENCY,
    optionsKey: 'frequency',
    titleKey: `signals.question${i}`,
  })),
  // Differences path: what Nora will do and Special Play Time
  { kind: 'insight', id: 'routine', paths: ['differences'] },
  { kind: 'insight', id: 'specialPlay', paths: ['differences'] },
  // None path: the prefrontal cortex, learning the transition, the routine, then coaching and the account
  { kind: 'question', id: 'cortex', field: 'cortex', options: ['yes', 'not_really'], paths: ['none'] },
  { kind: 'insight', id: 'cortexHelp', paths: ['none'] },
  { kind: 'insight', id: 'canLearn', paths: ['none'] },
  { kind: 'insight', id: 'easierEnd', paths: ['none'] },
  // Both paths end on coaching (copy by path), then CreateAccount and the plan
  { kind: 'insight', id: 'coaching', byPath: true },
  { kind: 'plan', id: 'plan' },
];

export type ScreenTimeAnswers = Record<string, string | string[]>;

// DEV ONLY: filled in when a dev force-landing passes `devSample`, so a jump
// straight to the plan shows every section
export const DEV_SAMPLE_ANSWERS: ScreenTimeAnswers = {
  hardest: 'resist',
  strategies: ['warning', 'timer'],
  differences: ['none'],
};

/** Shapes the flat answers into the object saved as User.screenTimeIntake. */
export function buildScreenTimeIntake(answers: ScreenTimeAnswers) {
  const pick = (key: string) => answers[key] ?? null;
  const path = screenTimePath(answers);
  return {
    version: 1,
    pmum: Array.from({ length: PMUM_COUNT }, (_, i) => pick(`pmum${i}`)),
    dopamine: pick('dopamine'),
    differences: pick('differences'),
    strategies: pick('strategies'),
    worked: pick('worked'),
    stress: pick('stress'),
    hardest: pick('hardest'),
    teen: pick('teen'),
    path,
    signals: Array.from({ length: SIGNAL_COUNT }, (_, i) => pick(`signal${i}`)),
    // Only asked on the none path; drop an answer left over from switching paths
    cortex: path === 'none' ? pick('cortex') : null,
    completedAt: new Date().toISOString(),
  };
}

/** i18next context for pronoun variants: 'boy' | 'girl' | undefined (neutral). */
export function screenTimePath(answers: ScreenTimeAnswers): ScreenTimePath {
  const differences = answers.differences;
  const picked = Array.isArray(differences) ? differences : differences ? [differences] : [];
  return picked.some((v) => v !== 'none') ? 'differences' : 'none';
}

const isOnPath = (step: ScreenTimeStep, path: ScreenTimePath) =>
  step.kind === 'plan' || !step.paths || step.paths.includes(path);

/**
 * Index of the next (direction 1) or previous (-1) step on the parent's path,
 * skipping steps meant for the other path; -1 past either end.
 */
export function adjacentStepIndex(from: number, direction: 1 | -1, answers: ScreenTimeAnswers): number {
  const path = screenTimePath(answers);
  for (let i = from + direction; i >= 0 && i < SCREEN_TIME_STEPS.length; i += direction) {
    if (isOnPath(SCREEN_TIME_STEPS[i], path)) return i;
  }
  return -1;
}

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
