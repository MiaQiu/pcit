/**
 * Learning Modules Content Library
 * 7 Categories × 4 Levels = 28 Modules
 *
 * Categories: PRAISE, ECHO, NARRATION, CRITICISM, QUESTIONS, COMMANDS, MAINTENANCE
 * Levels: 1 (Novice), 2 (Practitioner), 3 (Refining), 4 (Blocker)
 */

export const learningModules = {
  // ============================================================================
  // PRAISE MODULES
  // ============================================================================
  PRAISE: {
    1: {
      category: 'PRAISE',
      level: 1,
      levelName: 'Novice',
      title: 'Introduction to Praise',
      concept: 'Praise is specific, positive feedback that describes what your child is doing well. Unlike general compliments ("Good job!"), effective praise names the exact behavior you want to see more of.',
      action: [
        'Watch your child play for 2 minutes',
        'Each time they do something positive, say exactly what they did: "You stacked those blocks so carefully!" or "You\'re sharing your toys with teddy!"',
        'Aim for 3-5 specific praises during playtime',
        'Notice: Does your child smile or continue the behavior when you praise them?',
      ],
    },
    2: {
      category: 'PRAISE',
      level: 2,
      levelName: 'Practitioner',
      title: 'Deepening Your Praise',
      concept: 'You\'re already praising! Now let\'s make each praise more powerful by adding why the behavior matters. This helps your child understand the value of what they\'re doing.',
      action: [
        'Continue your specific praise habit',
        'Add the "why" to 2-3 praises: "You put the toy back so gently - that keeps it safe!" or "You\'re waiting your turn - that shows respect!"',
        'Vary your praise words: wonderful, fantastic, excellent, terrific, amazing',
        'Track your progress: Can you reach 10+ praises per session?',
      ],
    },
    3: {
      category: 'PRAISE',
      level: 3,
      levelName: 'Refining',
      title: 'Mastering Praise Timing',
      concept: 'Great praise skills! Now let\'s perfect the timing. Immediate praise (within 1-2 seconds) is most powerful because it clearly connects your words to the behavior.',
      action: [
        'Set a goal: 10+ praises per 5-minute session',
        'Practice "catch them being good" - praise the small stuff immediately',
        'Challenge: Praise behaviors you usually take for granted (playing quietly, gentle touches, following directions)',
        'Experiment: Notice which praises get the biggest smiles or lead to repeated behaviors',
      ],
    },
    4: {
      category: 'PRAISE',
      level: 4,
      levelName: 'Blocker',
      title: 'Breaking Through Praise Barriers',
      concept: 'You\'ve been working on praise for several days. Let\'s identify what\'s blocking your progress and find personalized solutions.',
      action: [
        'Reflect: What makes praising difficult? (Forgetting? Feels awkward? Child doesn\'t respond? Too busy correcting problems?)',
        'Try this: Set a phone timer to beep every 30 seconds as a "praise reminder"',
        'Lower the bar: Praise ANY positive behavior, even tiny ones like sitting still or holding a toy gently',
        'Partner check-in: What would make praising easier for you? What specific support do you need?',
      ],
    },
  },

  // ============================================================================
  // ECHO MODULES
  // ============================================================================
  ECHO: {
    1: {
      category: 'ECHO',
      level: 1,
      levelName: 'Novice',
      title: 'Introduction to Echoing',
      concept: 'Echoing (also called reflecting) means repeating back what your child says. This simple technique shows you\'re listening and encourages more talking.',
      action: [
        'Listen for your child\'s words during play',
        'Repeat back exactly what they say: Child: "Blue car!" You: "Blue car!"',
        'Keep your tone warm and interested, not robotic',
        'Aim for 3-5 echoes during playtime',
        'Notice: Does your child say more when you echo them?',
      ],
    },
    2: {
      category: 'ECHO',
      level: 2,
      levelName: 'Practitioner',
      title: 'Expanding Your Echo',
      concept: 'You\'re echoing well! Now let\'s occasionally expand by adding one new word to build vocabulary. Keep most echoes simple (just repeating), but try expansions 2-3 times.',
      action: [
        'Continue simple echoing as your foundation',
        'Add gentle expansions: Child: "Dog!" You: "Brown dog!" or Child: "Car go!" You: "Car goes fast!"',
        'Keep it natural - don\'t correct, just model',
        'Track your progress: Aim for 10+ echoes per session',
        'Watch: Does your child try the new words you modeled?',
      ],
    },
    3: {
      category: 'ECHO',
      level: 3,
      levelName: 'Refining',
      title: 'Mastering Echo Rhythm',
      concept: 'Excellent echoing! Now let\'s work on the back-and-forth rhythm. Echo quickly (within 1-2 seconds) to keep the conversation flowing naturally.',
      action: [
        'Goal: 10+ echoes per 5-minute session',
        'Focus on immediate echoes - respond within 2 seconds',
        'Balance: Mix simple echoes (60%) with gentle expansions (40%)',
        'Challenge: Echo their sounds, not just words ("Vroom vroom!" or "Wheee!")',
        'Celebrate: You\'re building real conversations!',
      ],
    },
    4: {
      category: 'ECHO',
      level: 4,
      levelName: 'Blocker',
      title: 'Overcoming Echo Obstacles',
      concept: 'You\'ve been practicing echoing for several days. Let\'s troubleshoot what\'s making it hard and find what works for you.',
      action: [
        'Identify your barrier: Quiet child? Fast talker? You forget? Feels repetitive?',
        'For quiet children: Echo any sounds - hums, car noises, singing',
        'For fast talkers: Echo just the last word they said',
        'Practice trick: Play "copycat game" - make it silly and fun!',
        'Partner support: What would help you echo more consistently?',
      ],
    },
  },

  // ============================================================================
  // NARRATION MODULES
  // ============================================================================
  NARRATION: {
    1: {
      category: 'NARRATION',
      level: 1,
      levelName: 'Novice',
      title: 'Introduction to Narration',
      concept: 'Narration is like being a sports announcer for your child\'s play. You simply describe what they\'re doing as they do it, without asking questions or giving commands.',
      action: [
        'Watch your child play without interrupting',
        'Describe their actions: "You\'re stacking the red block on top" or "You\'re putting the doll to sleep"',
        'Keep it simple - just state what you see',
        'Aim for 3-5 narrations during playtime',
        'Notice: Does your child stay focused longer when you narrate?',
      ],
    },
    2: {
      category: 'NARRATION',
      level: 2,
      levelName: 'Practitioner',
      title: 'Adding Detail to Narration',
      concept: 'You\'re narrating well! Now let\'s add more descriptive words (colors, sizes, numbers, feelings) to build your child\'s vocabulary and understanding.',
      action: [
        'Continue your basic narration habit',
        'Add descriptive details: "You\'re stacking three tall blocks" or "You\'re drawing with the bright yellow crayon"',
        'Include emotion words when you see them: "You look proud of that tower!" or "That made you laugh!"',
        'Track: Aim for 10+ narrations per session',
        'Observe: Does your child start using these descriptive words too?',
      ],
    },
    3: {
      category: 'NARRATION',
      level: 3,
      levelName: 'Refining',
      title: 'Perfecting Narration Flow',
      concept: 'Great narration skills! Now let\'s work on creating a smooth, natural flow - not too much (overwhelming) or too little (disconnected).',
      action: [
        'Goal: 10+ narrations per 5-minute session',
        'Find your rhythm: Narrate about 50% of what they do, leaving space for quiet',
        'Match their pace: Slow down for focused play, speed up for active play',
        'Advanced: Narrate their thinking: "You\'re deciding which piece fits" or "You\'re planning your next move"',
        'Celebrate: You\'re creating a rich language environment!',
      ],
    },
    4: {
      category: 'NARRATION',
      level: 4,
      levelName: 'Blocker',
      title: 'Breaking Narration Barriers',
      concept: 'You\'ve been working on narration for several days. Let\'s identify what\'s getting in the way and create a personalized breakthrough plan.',
      action: [
        'Pinpoint the challenge: Feels unnatural? Hard to find words? Child plays too fast? You forget?',
        'Try this: Narrate in slow motion - even one narration per minute counts!',
        'Make it a game: Pretend you\'re a nature documentary narrator',
        'Simplify: Just name objects they touch: "Ball... truck... block..."',
        'Support needed: What specific help would make narrating easier?',
      ],
    },
  },

  // ============================================================================
  // CRITICISM MODULES
  // ============================================================================
  CRITICISM: {
    1: {
      category: 'CRITICISM',
      level: 1,
      levelName: 'Novice',
      title: 'Understanding Criticism Impact',
      concept: 'Criticism (negative comments about your child or their behavior) can hurt their confidence and increase misbehavior. Let\'s learn to recognize it so you can reduce it.',
      action: [
        'Learn what counts as criticism: "You\'re being difficult," "That\'s wrong," "You never listen," "Bad choice"',
        'During playtime, notice when you feel the urge to criticize',
        'Just notice - don\'t judge yourself, this is learning!',
        'Pause before speaking: Take one breath',
        'Goal: Reduce criticism to 2 or fewer per session',
      ],
    },
    2: {
      category: 'CRITICISM',
      level: 2,
      levelName: 'Practitioner',
      title: 'Replacing Criticism with Alternatives',
      concept: 'You\'re aware of criticism now! Let\'s practice replacing critical statements with neutral or positive alternatives.',
      action: [
        'When you catch yourself about to criticize, STOP',
        'Replace with: Neutral narration ("You\'re having a hard time") OR praise the opposite ("I see you sitting so nicely now")',
        'Practice phrase: Instead of "Stop being rough," try "Gentle touches please" or just ignore if minor',
        'Track: Aim for 1 or fewer criticisms per session',
        'Progress check: Are you catching yourself sooner?',
      ],
    },
    3: {
      category: 'CRITICISM',
      level: 3,
      levelName: 'Refining',
      title: 'Eliminating Subtle Criticism',
      concept: 'Great progress! Now let\'s catch subtle criticisms - sarcasm, backhanded compliments, or comparisons to others.',
      action: [
        'Goal: Zero criticism per session',
        'Watch for: "Finally!" "About time," "Why can\'t you always...," "Your sister doesn\'t..."',
        'Catch the tone: Even "Good job" can sound critical with the wrong tone',
        'Challenge: Full 5 minutes with only positive and neutral statements',
        'Celebrate: Notice how your child responds to criticism-free time!',
      ],
    },
    4: {
      category: 'CRITICISM',
      level: 4,
      levelName: 'Blocker',
      title: 'Breaking the Criticism Pattern',
      concept: 'You\'ve been working on this for days. Critical words may be a deep habit. Let\'s understand what triggers it and create new patterns.',
      action: [
        'Identify your triggers: When is criticism hardest to stop? (Defiance? Mess? Frustration? Comparison to other kids?)',
        'Root cause: What feeling comes right before? (Anger? Worry? Exhaustion?)',
        'Emergency plan: When triggered, step back, take 3 breaths, say nothing until calm',
        'Reframe: Your child\'s behavior is a signal they need help, not criticism',
        'Support: Who can help you process these triggers? (Partner, therapist, friend?)',
      ],
    },
  },

  // ============================================================================
  // QUESTIONS MODULES
  // ============================================================================
  QUESTIONS: {
    1: {
      category: 'QUESTIONS',
      level: 1,
      levelName: 'Novice',
      title: 'Understanding Questions in Play',
      concept: 'Questions during play can interrupt flow and create pressure to respond "correctly." In PCIT Child-Directed Interaction time, we reduce questions to let your child lead freely.',
      action: [
        'Notice when you ask questions: "What color is that?" "What are you making?" "Do you want to...?"',
        'Understand: Questions aren\'t bad, but during this special playtime, we\'re letting child lead',
        'Just observe today: How many questions do you typically ask?',
        'Goal: Reduce to 2 or fewer questions per session',
        'Remember: This is just for special CDI time, not all day!',
      ],
    },
    2: {
      category: 'QUESTIONS',
      level: 2,
      levelName: 'Practitioner',
      title: 'Replacing Questions with Narration',
      concept: 'You\'re noticing your questions! Now let\'s practice replacing them. Instead of asking, simply narrate what you see.',
      action: [
        'When you want to ask a question, STOP',
        'Transform it: "What color?" becomes "You picked the blue one!" "What are you making?" becomes "You\'re building something!"',
        'Trust: Your child will talk more when not pressured with questions',
        'Track: Aim for 1 or fewer questions per session',
        'Notice: Is your child talking more without the questions?',
      ],
    },
    3: {
      category: 'QUESTIONS',
      level: 3,
      levelName: 'Refining',
      title: 'Eliminating Automatic Questions',
      concept: 'Excellent work! Now let\'s catch the automatic, habitual questions we ask without thinking.',
      action: [
        'Goal: Zero questions per session',
        'Watch for sneaky ones: "Right?" "Okay?" "You know?" "See?"',
        'Catch rhetorical questions: "Isn\'t that nice?" becomes "That\'s nice!"',
        'Challenge: Full 5 minutes without a single question',
        'Celebrate: You\'re creating pressure-free, child-led playtime!',
      ],
    },
    4: {
      category: 'QUESTIONS',
      level: 4,
      levelName: 'Blocker',
      title: 'Breaking the Question Habit',
      concept: 'Questions are a hard habit to break! You\'ve been practicing for days. Let\'s find what\'s blocking you and create a breakthrough.',
      action: [
        'Identify the trigger: Why do you ask questions? (Testing knowledge? Filling silence? Habit? Anxiety about "doing it right?")',
        'Root issue: What need does questioning fill for you?',
        'Try this: Put tape over your mouth as a physical reminder, remove to narrate only',
        'Reframe: Silence is golden - it gives your child space to think and lead',
        'Support: What would help you feel comfortable with less talking?',
      ],
    },
  },

  // ============================================================================
  // COMMANDS MODULES
  // ============================================================================
  COMMANDS: {
    1: {
      category: 'COMMANDS',
      level: 1,
      levelName: 'Novice',
      title: 'Recognizing Commands in Play',
      concept: 'Commands (telling your child what to do) take away their leadership during special playtime. Let\'s learn to recognize both direct and indirect commands.',
      action: [
        'Direct commands: "Put that there," "Draw a circle," "Make it red"',
        'Indirect commands: "Let\'s build a tower," "How about we...," "Why don\'t you..."',
        'Today: Just notice how many commands you give',
        'No judgment - commands are normal! We\'re just observing',
        'Goal: Reduce to 2 or fewer commands per session',
      ],
    },
    2: {
      category: 'COMMANDS',
      level: 2,
      levelName: 'Practitioner',
      title: 'Hands Off, Voice Off Practice',
      concept: 'You\'re recognizing commands now! Let\'s practice "hands off, voice off" - following your child\'s lead instead of directing.',
      action: [
        'When you want to command, STOP - put hands in lap',
        'Instead: Narrate what they\'re already doing or praise their choice',
        'Let them lead: Even if they "do it wrong" or make a mess',
        'Track: Aim for 1 or fewer commands per session',
        'Observe: How does your child play when fully in charge?',
      ],
    },
    3: {
      category: 'COMMANDS',
      level: 3,
      levelName: 'Refining',
      title: 'Catching Subtle Commands',
      concept: 'Great progress! Now let\'s catch hidden commands - suggestions, hints, and "helpful" guidance that still takes away their leadership.',
      action: [
        'Goal: Zero commands per session',
        'Watch for: "Maybe you could...," "What if we...," "That piece might fit better..."',
        'Catch physical commands: Moving their hand, fixing their work, taking over',
        'Challenge: Full 5 minutes of pure following - child leads 100%',
        'Celebrate: You\'re giving them true autonomy!',
      ],
    },
    4: {
      category: 'COMMANDS',
      level: 4,
      levelName: 'Blocker',
      title: 'Letting Go of Control',
      concept: 'Stepping back is hard! You\'ve been practicing for days. Let\'s explore what makes it difficult to let your child fully lead.',
      action: [
        'Identify your barrier: What drives your commands? (Teaching urge? Fixing things? Fear of wrong choices? Discomfort with chaos?)',
        'Deep question: What would happen if you said nothing for 5 minutes?',
        'Try this: Sit on your hands literally - make it physical',
        'Reframe: "Mistakes" are learning. Mess is creativity. Their way is valid.',
        'Support: What would help you feel okay with less control?',
      ],
    },
  },

  // ============================================================================
  // MAINTENANCE MODULES
  // ============================================================================
  MAINTENANCE: {
    1: {
      category: 'MAINTENANCE',
      level: 1,
      levelName: 'Novice',
      title: 'Celebrating Your Success',
      concept: 'Congratulations! You\'ve met all your skill targets. This is a huge achievement. Now let\'s maintain this momentum and deepen your skills.',
      action: [
        'Review your progress: Look at where you started vs. now',
        'Identify your strength: Which skill feels most natural? Praise? Echo? Narration?',
        'Set a stretch goal: Can you increase your strongest skill even more?',
        'Celebrate: You\'re giving your child exactly what they need!',
        'Keep going: Consistency is key - practice daily',
      ],
    },
    2: {
      category: 'MAINTENANCE',
      level: 2,
      levelName: 'Practitioner',
      title: 'Expanding to New Situations',
      concept: 'You\'re maintaining your skills beautifully! Now let\'s practice using them in new settings beyond your usual playtime.',
      action: [
        'Try your skills during: Bath time, meal prep, car rides, bedtime routine',
        'Challenge: Use PRIDE skills (now PEN!) during a typically difficult moment',
        'Notice: Do the skills work in other situations too?',
        'Keep your targets: Maintain 10+ each of Praise, Echo, Narration',
        'Experiment: Where do these skills have the biggest impact?',
      ],
    },
    3: {
      category: 'MAINTENANCE',
      level: 3,
      levelName: 'Refining',
      title: 'Becoming Automatic',
      concept: 'Excellent consistency! Now let\'s make these skills so automatic that you don\'t have to think about them - they become your natural style.',
      action: [
        'Practice until effortless: Can you hit targets without counting?',
        'Add complexity: Maintain skills even when tired, stressed, or distracted',
        'Teach others: Explain your skills to partner, grandparent, or babysitter',
        'Notice changes: How has your relationship with your child transformed?',
        'Celebrate: You\'ve changed your family\'s dynamic!',
      ],
    },
    4: {
      category: 'MAINTENANCE',
      level: 4,
      levelName: 'Blocker',
      title: 'Sustaining Long-Term Success',
      concept: 'You\'ve maintained your skills for many days! Now let\'s ensure they last forever, even when life gets hard.',
      action: [
        'Identify risks: What could make you slip back? (Stress? New baby? Schedule change?)',
        'Create a backup plan: How will you maintain skills during hard times?',
        'Build support: Who can remind you to use your skills when you\'re struggling?',
        'Long-term vision: Imagine your child at 5, 10, 15 - how will these skills shape them?',
        'Commit: Make this your permanent parenting style, not just a program',
      ],
    },
  },
};

/**
 * Get a specific module by category and level
 * @param {string} category - Category name (e.g., 'PRAISE')
 * @param {number} level - Level number (1-4)
 * @returns {Object} Module content
 */
export function getModule(category, level) {
  return learningModules[category]?.[level] || null;
}

/**
 * Get all modules for a category
 * @param {string} category - Category name
 * @returns {Array} Array of modules
 */
export function getModulesByCategory(category) {
  const categoryModules = learningModules[category];
  if (!categoryModules) return [];

  return Object.values(categoryModules);
}
