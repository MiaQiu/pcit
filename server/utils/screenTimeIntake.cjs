'use strict';

/**
 * Screen-time onboarding answers (User.screenTimeIntake, saved by the mobile
 * screen-time onboarding branch) as readable Q&A lines for module prompts.
 *
 * Questions and option labels mirror nora-mobile en.json
 * onboarding.screenTime.* (gender-neutral variants, "{{name}}" → "the child")
 * and the field layout of buildScreenTimeIntake in
 * nora-mobile/src/screens/onboarding/screenTime/screenTimeFlow.ts — keep in sync.
 */

const AGREEMENT = {
  strongly_disagree: 'Strongly disagree',
  somewhat_disagree: 'Somewhat disagree',
  somewhat_agree:    'Somewhat agree',
  agree:             'Agree',
};
const FREQUENCY = {
  almost_never:  'Almost never',
  rarely:        'Rarely',
  quite_often:   'Quite often',
  almost_always: 'Almost always',
};
const YES_NO = { yes: 'Yes', no: 'No' };

// Single-answer and multi-answer questions, in onboarding order.
const QUESTIONS = [
  { field: 'hardest', question: 'What feels hardest right now?', options: {
    resist:         'My child resists or refuses to stop.',
    long_meltdowns: 'The meltdowns can last a long time.',
    stay_calm:      'I find it hard to stay calm.',
    consistency:    "It's difficult to be consistent.",
    exhausted:      "I'm exhausted and don't know what else to try.",
    // Earlier option set, still on accounts onboarded before the change
    stop:  'Getting the child to stop',
    more:  'The child keeps asking for more',
    upset: 'The child gets very upset when it ends',
    after: "The child won't do anything else afterward",
    argue: 'I end up arguing or yelling',
  } },
  { field: 'pmum', question: 'Do you agree with the following statements?', statements: [
    'It is hard for my child to stop using screen media.',
    'Screen media is the only thing that seems to motivate my child.',
    'Screen media is all that my child seems to think about.',
    'My child’s screen media use interferes with family activities.',
    'My child’s screen media use causes problems for the family.',
    'My child becomes frustrated when he/she cannot use screen media.',
    'The amount of time my child wants to use screen media keeps increasing.',
    'My child sneaks using screen media.',
    'When my child has had a bad day, screen media seems to be the only thing that helps him/her feel better.',
  ], options: AGREEMENT },
  // No longer asked in onboarding (the module chat asks it); kept for accounts that answered it
  { field: 'stops', question: "When it's time to stop, what usually happens?", options: {
    asks:     'The child asks for more',
    ignores:  'The child ignores me and keeps watching',
    whines:   'The child whines or cries',
    meltdown: 'The child screams or has a meltdown',
    hits:     'The child hits, kicks or throws things',
  } },
  { field: 'dopamine', question: 'Have you heard about the dopamine loop?', options: YES_NO },
  { field: 'differences', question: 'Does the child have any learning and thinking differences?', options: {
    none:                 'None that I know of',
    developmental_delays: 'Developmental delays',
    adhd:                 'ADHD',
    asd:                  'ASD',
    anxiety:              'Anxiety',
    another:              'Another difference not listed here',
    suspected:            'I suspect one of those, but haven’t gotten a diagnosis yet',
  } },
  { field: 'strategies', question: 'What have you already tried to make screen time easier to end?', options: {
    warning:    'Giving a warning before time is up',
    timer:      'Using a timer',
    rules:      'Setting screen-time rules in advance',
    activity:   'Offering another activity',
    explaining: 'Explaining why it’s time to stop',
    extra:      'Giving a little extra time',
    away:       'Taking the device away',
  } },
  { field: 'worked', question: 'How well have those approaches worked?', options: {
    smoothly:    'Screen time usually ends smoothly',
    improvement: 'Some improvement',
    sometimes:   'Helps only sometimes',
    no_change:   'No real change',
    harder:      'It’s getting harder',
  } },
  { field: 'stress', question: 'How hard are screen-time endings on you?', options: {
    manageable:   'Manageable',
    somewhat:     'Somewhat stressful',
    very:         'Very stressful',
    overwhelming: 'Overwhelming',
  } },
  { field: 'teen', question: 'Do you worry those challenges might get harder as your child becomes a teenager?', options: {
    yes: 'Yes', no: 'No', not_sure: 'Not sure',
  } },
  { field: 'barriers', question: 'What’s holding you back?', options: {
    resistance:  'Child’s resistance',
    burnout:     'My own burnout',
    meltdowns:   'Unpredictable meltdowns',
    consistency: 'Lack of consistency',
    progress:    'Slow progress',
  } },
  // No longer asked in onboarding; kept for accounts that answered it
  { field: 'goal', question: 'What would you most like to change?', options: {
    meltdowns:   'Fewer meltdowns',
    recovery:    'Faster recovery',
    yelling:     'Less yelling',
    transitions: 'Easier transitions',
    confidence:  'More confidence holding the limit',
  } },
  { field: 'signals', question: 'How often does the child show these signals?', statements: [
    'How often does your child fidget with objects (pens, clothes, or hair)?',
    'How often does your child chew on things like pencils, toys or shirt sleeves?',
    'Does your child have compulsive habits (nail-biting, lip-chewing, or nose-picking)?',
    'How often does your child avoid eye contact or socializing when upset?',
    'Does your child fight sleep more when they know a hard day is coming?',
    'How often do your child’s frustrations turn into meltdowns with yelling?',
  ], options: FREQUENCY },
  { field: 'cortex', question: 'Have you heard of the prefrontal cortex?', options: { yes: 'Yes', not_really: 'Not really' } },
  { field: 'playAwareness', question: 'Have you heard before that play is one of the main ways children learn?', options: YES_NO },
];

const label = (options, value) => options[value] || value;

/**
 * @param {Object|null} intake - User.screenTimeIntake
 * @returns {string} "Q: … / A: …" lines, or '' when there are no answers
 */
function formatScreenTimeIntakeForPrompt(intake) {
  if (!intake || typeof intake !== 'object') return '';
  const lines = [];
  for (const q of QUESTIONS) {
    const value = intake[q.field];
    if (q.statements) {
      // One answer per statement; skip unanswered ones.
      const answered = q.statements
        .map((statement, i) => (Array.isArray(value) && value[i] ? `  - ${statement} → ${label(q.options, value[i])}` : null))
        .filter(Boolean);
      if (answered.length) lines.push(`- ${q.question}`, ...answered);
      continue;
    }
    if (value == null || (Array.isArray(value) && value.length === 0)) continue;
    const answer = Array.isArray(value) ? value.map(v => label(q.options, v)).join('; ') : label(q.options, value);
    lines.push(`- ${q.question} → ${answer}`);
  }
  return lines.join('\n');
}

/**
 * The parent's "learning and thinking differences" answers other than
 * "None that I know of" (e.g. ADHD, or a suspected difference), as labels.
 * @param {Object|null} intake - User.screenTimeIntake
 * @returns {string[]} empty when none were reported
 */
function reportedDifferences(intake) {
  const value = intake?.differences;
  if (!Array.isArray(value)) return [];
  const { options } = QUESTIONS.find(q => q.field === 'differences');
  return value.filter(v => v && v !== 'none').map(v => label(options, v));
}

// Short names for the signal statements (same order as QUESTIONS' signals).
const SIGNAL_SHORT = [
  'fidgets with objects',
  'chews on things',
  'compulsive habits (nail-biting, lip-chewing, nose-picking)',
  'avoids eye contact or people when upset',
  'fights sleep before a hard day',
  'frustrations turn into yelling meltdowns',
];
const AGREES = new Set(['somewhat_agree', 'agree']);
const OFTEN = new Set(['quite_often', 'almost_always']);

/**
 * What the answers add up to, for the coach to act on without decoding the
 * raw Q&A: the main problem, what happens at the end, what's been tried and
 * how it went, the parent's stress, how intense the media pull is, and the
 * regulation signals seen often. Lines are left out for unanswered questions.
 * @param {Object|null} intake - User.screenTimeIntake
 * @returns {string} "  - " lines (nested under a heading), or '' when there are no answers
 */
function summarizeScreenTimeIntake(intake) {
  if (!intake || typeof intake !== 'object') return '';
  const q = field => QUESTIONS.find(x => x.field === field);
  const labels = field => {
    const value = intake[field];
    const values = Array.isArray(value) ? value : value != null ? [value] : [];
    return values.filter(Boolean).map(v => label(q(field).options, v));
  };
  const lines = [];

  const [hardest] = labels('hardest');
  if (hardest) lines.push(`- Main problem (their words): "${hardest}"`);
  const stops = labels('stops');
  if (stops.length) lines.push(`- When screen time ends: ${stops.join('; ')}`);
  const tried = labels('strategies');
  const [worked] = labels('worked');
  if (tried.length) lines.push(`- Already tried: ${tried.join('; ')}${worked ? ` → result: ${worked}` : ''}`);
  const [stress] = labels('stress');
  if (stress) lines.push(`- How hard endings are on the parent: ${stress}`);

  const differences = reportedDifferences(intake);
  if (Array.isArray(intake.differences)) {
    lines.push(`- Learning and thinking differences: ${differences.length ? differences.join('; ') : 'none reported'}`);
  }

  if (Array.isArray(intake.pmum)) {
    const answered = intake.pmum.filter(Boolean).length;
    const agreed = q('pmum').statements.filter((_, i) => AGREES.has(intake.pmum[i]));
    if (answered) {
      const level = agreed.length >= 6 ? 'strong' : agreed.length >= 3 ? 'moderate' : 'mild';
      lines.push(`- Pull of screens: ${level} (agrees with ${agreed.length} of ${answered} problem-media statements)`
        + (agreed.length ? `, e.g. ${agreed.slice(0, 3).map(s => `"${s}"`).join(', ')}` : ''));
    }
  }

  if (Array.isArray(intake.signals)) {
    const often = SIGNAL_SHORT.filter((_, i) => OFTEN.has(intake.signals[i]));
    if (intake.signals.some(Boolean)) {
      lines.push(often.length
        ? `- Seen quite often or almost always: ${often.join('; ')}${often.length >= 3 ? ' (several signs the child struggles to regulate beyond screens)' : ''}`
        : '- Regulation signals: none seen often');
    }
  }

  const [teen] = labels('teen');
  if (teen) lines.push(`- Worried it gets harder in the teen years: ${teen}`);
  const knows = [
    intake.dopamine && `dopamine loop: ${intake.dopamine === 'yes' ? 'had heard of it' : 'new to them'}`,
    intake.cortex && `prefrontal cortex: ${intake.cortex === 'yes' ? 'had heard of it' : 'new to them'}`,
  ].filter(Boolean);
  if (knows.length) lines.push(`- Concepts onboarding then explained: ${knows.join('; ')}`);

  return lines.map(line => `  ${line}`).join('\n');
}

module.exports = { formatScreenTimeIntakeForPrompt, summarizeScreenTimeIntake, reportedDifferences };
