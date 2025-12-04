const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Seed Lessons Script
 * Populates the database with initial lesson content for the Nora bite-size learning curriculum
 */

async function seedLessons() {
  try {
    console.log('🌱 Starting lesson seeding...\n');

    // Check if lessons already exist
    const existingLessons = await prisma.lesson.count();
    if (existingLessons > 0 && existingLessons < 41) {
      console.log(`⚠️  Found ${existingLessons} existing lessons in database.`);
      console.log('Resuming from where we left off...\n');
    } else if (existingLessons >= 41) {
      console.log(`✅ All 41 lessons already exist in database.`);
      console.log('To reseed, run: npx prisma db execute --stdin <<< "DELETE FROM \\"Lesson\\""');
      console.log('Then run this script again.\n');
      return;
    }

    console.log('Creating lessons...\n');

    // ============================================================================
    // CONNECT PHASE - Day 1
    // ============================================================================

    const lesson1 = await prisma.lesson.create({
      data: {
        phase: 'CONNECT',
        phaseNumber: 1,
        dayNumber: 1,
        title: 'The Power of Praise',
        subtitle: 'Why praise matters',
        shortDescription: 'Learn how praise shapes positive behavior and builds your child\'s confidence.',
        objectives: [
          'Understand why praise is powerful',
          'Learn the difference between labeled and unlabeled praise',
          'Practice giving specific praise'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [],
        teachesCategories: ['PRAISE'],
        dragonImageUrl: null, // Will be added when assets are ready
        backgroundColor: '#E4E4FF',
        ellipse77Color: '#9BD4DF',
        ellipse78Color: '#A6E0CB',
      }
    });

    // Create segments for Lesson 1
    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson1.id,
          order: 1,
          sectionTitle: 'Why Praise Matters',
          contentType: 'TEXT',
          bodyText: 'When you praise your child for positive behaviors, you\'re not just making them feel good—you\'re teaching them what to do more of.\n\nSpecific praise like "I love how you shared your toy!" is more effective than general praise like "Good job!" because it shows your child exactly what they did right.\n\nThink of praise as fuel for their confidence and motivation to keep trying.'
        },
        {
          lessonId: lesson1.id,
          order: 2,
          sectionTitle: 'Two Types of Praise',
          contentType: 'EXAMPLE',
          bodyText: '**Labeled Praise** (Specific):\n• "I love how you put your toys away!"\n• "Great job using gentle hands!"\n• "You\'re sitting so nicely!"\n\n**Unlabeled Praise** (General):\n• "Good job!"\n• "Nice!"\n• "That\'s great!"\n\nLabeled praise is more powerful because it tells your child exactly what they did right.'
        },
        {
          lessonId: lesson1.id,
          order: 3,
          sectionTitle: 'Practice Tips',
          contentType: 'TIP',
          bodyText: '**Start with simple observations:**\n\n1. Watch for any positive behavior during play\n2. Describe exactly what you see\n3. Add warmth and enthusiasm to your voice\n\n**Examples to try today:**\n• "You\'re sharing so nicely!"\n• "I love your creative building!"\n• "Great job listening!"\n\nPractice during play time when your child is behaving well.'
        }
      ]
    });

    // Create quiz for Lesson 1
    const quiz1 = await prisma.quiz.create({
      data: {
        lessonId: lesson1.id,
        question: 'Which is an example of "Labeled Praise"?',
        correctAnswer: '', // Will be set after creating options
        explanation: 'Labeled praise is specific and describes exactly what the child did right. "I love how you shared your toy!" tells them what behavior to repeat.'
      }
    });

    const quiz1Options = await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz1.id,
          optionLabel: 'A',
          optionText: 'Good job!',
          order: 1
        },
        {
          quizId: quiz1.id,
          optionLabel: 'B',
          optionText: 'I love how you shared your toy!',
          order: 2
        },
        {
          quizId: quiz1.id,
          optionLabel: 'C',
          optionText: 'Nice work!',
          order: 3
        },
        {
          quizId: quiz1.id,
          optionLabel: 'D',
          optionText: 'That\'s great!',
          order: 4
        }
      ]
    });

    // Get the correct option ID and update quiz
    const correctOption = await prisma.quizOption.findFirst({
      where: { quizId: quiz1.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz1.id },
      data: { correctAnswer: correctOption.id }
    });

    console.log('✓ Created Lesson 1: The Power of Praise');

    // ============================================================================
    // CONNECT PHASE - Day 2
    // ============================================================================

    const lesson2 = await prisma.lesson.create({
      data: {
        phase: 'CONNECT',
        phaseNumber: 1,
        dayNumber: 2,
        title: 'Reflection: Echo Their Words',
        subtitle: 'Building connection through listening',
        shortDescription: 'Learn how repeating your child\'s words shows you\'re listening and builds their language.',
        objectives: [
          'Understand the power of reflection',
          'Learn how to echo your child\'s words',
          'Practice active listening techniques'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson1.id],
        teachesCategories: ['ECHO'],
        dragonImageUrl: null,
        backgroundColor: '#E4F0FF',
        ellipse77Color: '#A6D4E0',
        ellipse78Color: '#B4E0CB',
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson2.id,
          order: 1,
          sectionTitle: 'What is Reflection?',
          contentType: 'TEXT',
          bodyText: 'Reflection means repeating back what your child says. It sounds simple, but it\'s incredibly powerful.\n\nWhen you echo their words, you:\n• Show you\'re truly listening\n• Help them feel heard and understood\n• Build their vocabulary and language skills\n• Encourage them to keep talking\n\nIt\'s like holding up a mirror to their thoughts.'
        },
        {
          lessonId: lesson2.id,
          order: 2,
          sectionTitle: 'How to Reflect',
          contentType: 'EXAMPLE',
          bodyText: '**Child says:** "Blue car!"\n**You reflect:** "Yes, a blue car!"\n\n**Child says:** "I\'m building a tower."\n**You reflect:** "You\'re building a tower!"\n\n**Child says:** "Doggie sleep."\n**You reflect:** "The doggie is sleeping."\n\nYou can repeat exactly or add a little detail, but keep it simple and match their words.'
        },
        {
          lessonId: lesson2.id,
          order: 3,
          sectionTitle: 'Practice Tips',
          contentType: 'TIP',
          bodyText: '**Tips for reflection:**\n\n• Use a warm, interested tone\n• Don\'t ask questions—just reflect\n• Match their excitement level\n• Keep it brief and natural\n\n**Try it today:**\nDuring play, simply repeat back 3-5 things your child says. Notice how they respond when they feel heard!'
        }
      ]
    });

    const quiz2 = await prisma.quiz.create({
      data: {
        lessonId: lesson2.id,
        question: 'Your child says "Red block!" What\'s the best reflection?',
        correctAnswer: '',
        explanation: 'Simply repeating "Red block!" shows you heard them without questioning or changing their words. This encourages more talking.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz2.id,
          optionLabel: 'A',
          optionText: 'What color is that?',
          order: 1
        },
        {
          quizId: quiz2.id,
          optionLabel: 'B',
          optionText: 'Red block!',
          order: 2
        },
        {
          quizId: quiz2.id,
          optionLabel: 'C',
          optionText: 'Can you find another red block?',
          order: 3
        },
        {
          quizId: quiz2.id,
          optionLabel: 'D',
          optionText: 'Good job naming colors!',
          order: 4
        }
      ]
    });

    const correctOption2 = await prisma.quizOption.findFirst({
      where: { quizId: quiz2.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz2.id },
      data: { correctAnswer: correctOption2.id }
    });

    console.log('✓ Created Lesson 2: Reflection - Echo Their Words');

    // ============================================================================
    // CONNECT PHASE - Day 3
    // ============================================================================

    const lesson3 = await prisma.lesson.create({
      data: {
        phase: 'CONNECT',
        phaseNumber: 1,
        dayNumber: 3,
        title: 'Narrate the Play',
        subtitle: 'Describing what you see',
        shortDescription: 'Learn how describing your child\'s actions builds language and shows attention.',
        objectives: [
          'Understand behavioral narration',
          'Learn to describe actions as they happen',
          'Practice non-directive commentary'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson1.id, lesson2.id],
        teachesCategories: ['NARRATION'],
        dragonImageUrl: null,
        backgroundColor: '#FFF4E4',
        ellipse77Color: '#FFD4A6',
        ellipse78Color: '#A6E0CB',
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson3.id,
          order: 1,
          sectionTitle: 'What is Narration?',
          contentType: 'TEXT',
          bodyText: 'Behavioral narration means describing what your child is doing as they play—like you\'re a sports announcer for their playtime.\n\n"You\'re stacking the blocks..."\n"You\'re putting the doll to bed..."\n"You\'re drawing a circle..."\n\nThis technique:\n• Shows you\'re paying attention\n• Builds their vocabulary\n• Helps them learn to focus\n• Creates a warm, engaging atmosphere'
        },
        {
          lessonId: lesson3.id,
          order: 2,
          sectionTitle: 'Examples in Action',
          contentType: 'EXAMPLE',
          bodyText: '**What they\'re doing → What you say:**\n\nStacking blocks → "You\'re making a tall tower!"\n\nDrawing → "You\'re using the red crayon!"\n\nPlaying with cars → "The car is going fast!"\n\nFeeding a doll → "You\'re giving baby a bottle!"\n\n**Remember:** Describe, don\'t direct. Let them lead!'
        },
        {
          lessonId: lesson3.id,
          order: 3,
          sectionTitle: 'Practice Tips',
          contentType: 'TIP',
          bodyText: '**Tips for narration:**\n\n• Use an interested, not bossy tone\n• Describe what you see, not what to do\n• Keep statements short and simple\n• Pause to let them respond\n• Don\'t narrate constantly—balance is key\n\n**Try it today:**\nSet aside 5 minutes of play time and simply describe 5-10 things your child does.'
        }
      ]
    });

    const quiz3 = await prisma.quiz.create({
      data: {
        lessonId: lesson3.id,
        question: 'Your child is coloring. Which is behavioral narration?',
        correctAnswer: '',
        explanation: '"You\'re using the blue crayon!" simply describes what you see without directing or questioning. This is pure narration.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz3.id,
          optionLabel: 'A',
          optionText: 'You\'re using the blue crayon!',
          order: 1
        },
        {
          quizId: quiz3.id,
          optionLabel: 'B',
          optionText: 'What are you drawing?',
          order: 2
        },
        {
          quizId: quiz3.id,
          optionLabel: 'C',
          optionText: 'Try coloring inside the lines.',
          order: 3
        },
        {
          quizId: quiz3.id,
          optionLabel: 'D',
          optionText: 'That\'s beautiful!',
          order: 4
        }
      ]
    });

    const correctOption3 = await prisma.quizOption.findFirst({
      where: { quizId: quiz3.id, optionLabel: 'A' }
    });
    await prisma.quiz.update({
      where: { id: quiz3.id },
      data: { correctAnswer: correctOption3.id }
    });

    console.log('✓ Created Lesson 3: Narrate the Play');

    // ============================================================================
    // CONNECT PHASE - Day 4
    // ============================================================================

    const lesson4 = await prisma.lesson.create({
      data: {
        phase: 'CONNECT',
        phaseNumber: 1,
        dayNumber: 4,
        title: 'Why Special Time Feels Like a Practice Gym',
        subtitle: 'High-Intensity Skill Practice',
        shortDescription: 'Understand why Special Time feels unnatural and how this "mental gym" builds lasting skills.',
        objectives: [
          'Understand Special Time as high-intensity skill practice',
          'Learn why the intensity is necessary',
          'Practice transitioning out of "gym mode"'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson1.id, lesson2.id, lesson3.id],
        teachesCategories: ['PRAISE', 'ECHO', 'NARRATION'],
        dragonImageUrl: null,
        backgroundColor: '#FFE4F0',
        ellipse77Color: '#FFB4D4',
        ellipse78Color: '#D4A6E0',
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson4.id,
          order: 1,
          sectionTitle: 'Think of Special Time as a Mental Gym',
          contentType: 'TEXT',
          bodyText: 'When you start practicing the PEN skills for 5 minutes a day, you might find yourself thinking, "This feels so unnatural!" or "I would never talk like this normally." This is completely normal and expected.\\n\\nThe 5 minutes of Special Time is not meant to reflect your spontaneous reality; it\'s designed to be a **high-intensity workout** for your parenting skills.\\n\\n**Gym Analogy:** In the gym, you isolate muscles (e.g., biceps curls) to strengthen them before integrating them into complex movements (e.g., lifting groceries).\\n\\n**Nora Model Analogy:** In Special Time, you isolate positive skills (Praise, Echo, Narrate) and practice them at a high density (e.g., 10-15 positive interactions per minute) while completely avoiding the "Don\'t" skills.'
        },
        {
          lessonId: lesson4.id,
          order: 2,
          sectionTitle: 'The Purpose of the Intensity',
          contentType: 'EXAMPLE',
          bodyText: 'We use this artificial intensity because:\\n\\n1. **It Builds Muscle Memory:** Practicing skills intentionally helps you use them reflexively outside of Special Time.\\n2. **It Overwrites Old Habits:** It forces you to consciously replace old habits (commands, questions, criticism) with positive ones.\\n\\nThe goal isn\'t to be a "sports commentator" all day; the goal is to practice so effectively that you naturally sprinkle PEN skills throughout your daily life, making all interactions more positive and effective.'
        },
        {
          lessonId: lesson4.id,
          order: 3,
          sectionTitle: 'Transitioning Out of "Gym Mode"',
          contentType: 'TIP',
          bodyText: '**Sample Script:**\\n\\nParent: (Looks at timer) "Wow, Special Time is over now! I really loved **how much fun we had** and **how creative you were** with the blocks! Now let\'s go make lunch, and I\'ll keep an eye out for how well you cooperate."\\n\\n(Return to normal communication, maybe sprinkling a few Praise statements later.)'
        }
      ]
    });

    const quiz4 = await prisma.quiz.create({
      data: {
        lessonId: lesson4.id,
        question: 'Why does Special Time often feel unnatural or "fake" to parents initially?',
        correctAnswer: '',
        explanation: 'Special Time is intentionally an intense practice session to build skill density and muscle memory before integrating the skills into daily life.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz4.id,
          optionLabel: 'A',
          optionText: 'Because the child is not being spontaneous or real during the session.',
          order: 1
        },
        {
          quizId: quiz4.id,
          optionLabel: 'B',
          optionText: 'Because it is designed to be an intense, isolated skill-building practice that doesn\'t reflect spontaneous daily life.',
          order: 2
        },
        {
          quizId: quiz4.id,
          optionLabel: 'C',
          optionText: 'Because the 5-minute time limit is too short to be effective.',
          order: 3
        },
        {
          quizId: quiz4.id,
          optionLabel: 'D',
          optionText: 'Because the parent is using too many "Don\'t" skills accidentally.',
          order: 4
        }
      ]
    });

    const correctOption4 = await prisma.quizOption.findFirst({
      where: { quizId: quiz4.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz4.id },
      data: { correctAnswer: correctOption4.id }
    });

    console.log('✓ Created Lesson 4: Why Special Time Feels Like a Practice Gym');

    // ============================================================================
    // CONNECT PHASE - Day 5
    // ============================================================================

    const lesson5 = await prisma.lesson.create({
      data: {
        phase: 'CONNECT',
        phaseNumber: 1,
        dayNumber: 5,
        title: 'Handling Whining or Testing in Special Time',
        subtitle: 'Selective Ignoring',
        shortDescription: 'Learn how to handle minor attention-seeking behaviors during Special Time using Selective Ignoring.',
        objectives: [
          'Understand what Selective Ignoring is',
          'Learn when to use Selective Ignoring',
          'Practice the immediate return after ignoring'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson1.id, lesson2.id, lesson3.id, lesson4.id],
        teachesCategories: ['SELECTIVE_IGNORING'],
        dragonImageUrl: null,
        backgroundColor: '#E4FFE4',
        ellipse77Color: '#A6E0A6',
        ellipse78Color: '#D4FFB4',
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson5.id,
          order: 1,
          sectionTitle: 'What is Selective Ignoring?',
          contentType: 'TEXT',
          bodyText: 'This is the only tool we use for minor, attention-seeking misbehaviors (like whining, silly noises, or pouting) that happen **during** Special Play Time. It works because the currency of connection is positive attention, and you are temporarily withdrawing it.\\n\\n**Action:** Immediately withdraw **all** attention (eye contact, verbal, physical). Turn your body slightly away and focus on a neutral object (like a spot on the wall).\\n\\n**Rule:** Ignore the behavior, not the child. Remain calm, neutral, and show no frustration.'
        },
        {
          lessonId: lesson5.id,
          order: 2,
          sectionTitle: 'The Immediate Return',
          contentType: 'EXAMPLE',
          bodyText: 'The critical step: The moment the whining stops and the child returns to neutral or positive behavior (even a moment of silence), you must **immediately** return attention with a Labeled Praise (P).\\n\\n**Example:**\\n• **Misbehavior:** Child whines, "I don\'t want to play blocks!"\\n• **Parent:** (Silent, looks away)\\n• **Child:** (Stops whining, picks up a block silently)\\n• **Parent (Immediate Praise):** "Thank you for **using your quiet hands!**"'
        },
        {
          lessonId: lesson5.id,
          order: 3,
          sectionTitle: 'Practice Tips',
          contentType: 'TIP',
          bodyText: '**Key Principles:**\\n\\n• Withdraw attention immediately when whining starts\\n• Stay calm and neutral - no frustration\\n• Turn your body slightly away\\n• Wait for the behavior to stop\\n• **Immediately** praise when they return to positive behavior\\n\\nRemember: You\'re ignoring the **behavior**, not the child. The instant they stop, you reconnect with warmth and praise.'
        }
      ]
    });

    const quiz5 = await prisma.quiz.create({
      data: {
        lessonId: lesson5.id,
        question: 'During Special Play Time, if your child starts whining to get a certain toy, what is the best immediate response?',
        correctAnswer: '',
        explanation: 'Selective Ignoring is the only effective tool for minor attention-seeking behavior, followed by immediate praise when the whining stops.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz5.id,
          optionLabel: 'A',
          optionText: 'Ask them calmly what toy they want.',
          order: 1
        },
        {
          quizId: quiz5.id,
          optionLabel: 'B',
          optionText: 'Immediately give a Clear Command to stop whining.',
          order: 2
        },
        {
          quizId: quiz5.id,
          optionLabel: 'C',
          optionText: 'Withdraw all attention (Selective Ignoring) until the whining stops.',
          order: 3
        },
        {
          quizId: quiz5.id,
          optionLabel: 'D',
          optionText: 'Use a Labeled Praise to distract them.',
          order: 4
        }
      ]
    });

    const correctOption5 = await prisma.quizOption.findFirst({
      where: { quizId: quiz5.id, optionLabel: 'C' }
    });
    await prisma.quiz.update({
      where: { id: quiz5.id },
      data: { correctAnswer: correctOption5.id }
    });

    console.log('✓ Created Lesson 5: Handling Whining or Testing in Special Time');

    // ============================================================================
    // CONNECT PHASE - Day 6
    // ============================================================================

    const lesson6 = await prisma.lesson.create({
      data: {
        phase: 'CONNECT',
        phaseNumber: 1,
        dayNumber: 6,
        title: 'Handling Chaos and Destruction in Special Time',
        subtitle: 'Setting Boundaries During Connection',
        shortDescription: 'Learn how to handle destructive or chaotic behavior during Special Play Time using redirection and session boundaries.',
        objectives: [
          'Learn Descriptive Redirection technique',
          'Understand when to end a session',
          'Practice calm boundary setting'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson1.id, lesson2.id, lesson3.id, lesson4.id, lesson5.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#FFF0E4',
        ellipse77Color: '#FFD0A6',
        ellipse78Color: '#A6D0E0',
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson6.id,
          order: 1,
          sectionTitle: 'Descriptive Redirection (First Defense)',
          contentType: 'TEXT',
          bodyText: 'If the play is just getting too chaotic or rough, use Narrate (N) and Echo (E) to describe the appropriate or gentle alternative.\n\n**Example:**\n• Chaos: Child throws a block hard across the room.\n• Parent (Redirection): "Wow, you are throwing that block hard! Let\'s see you put the block gently on the table, like this." (Use Copy/Imitation of the gentle action).'
        },
        {
          lessonId: lesson6.id,
          order: 2,
          sectionTitle: 'Ending the Session (Final Boundary)',
          contentType: 'EXAMPLE',
          bodyText: 'If Descriptive Redirection fails, or if the child is aggressive (hitting, biting) or destructive (breaking toys), the session must end immediately. This is the ultimate boundary of Connect.\n\n**Action:** Calmly state, "Special Play Time is over now. We will try again tomorrow."\n\n**Rule:** Do not argue or lecture. This teaches the child that destructive behavior automatically ends access to positive attention.'
        },
        {
          lessonId: lesson6.id,
          order: 3,
          sectionTitle: 'Practice Tips',
          contentType: 'TIP',
          bodyText: '**Key Principles:**\n\n• First try Descriptive Redirection\n• Stay calm and neutral\n• If redirection fails, end the session immediately\n• Don\'t lecture or argue\n• Try again the next day with a fresh start\n\nRemember: Ending the session is a teaching moment that shows destructive behavior ends positive attention.'
        }
      ]
    });

    const quiz6 = await prisma.quiz.create({
      data: {
        lessonId: lesson6.id,
        question: 'If Descriptive Redirection fails and your child continues to throw blocks violently during Special Play Time, what is the correct next step?',
        correctAnswer: '',
        explanation: 'Since commands are avoided in Connect, ending the session is the firm boundary that teaches the child that destructive or aggressive behavior immediately ends access to positive attention.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz6.id,
          optionLabel: 'A',
          optionText: 'Give a Time-Out warning and escort them.',
          order: 1
        },
        {
          quizId: quiz6.id,
          optionLabel: 'B',
          optionText: 'Immediately yell "STOP THAT!"',
          order: 2
        },
        {
          quizId: quiz6.id,
          optionLabel: 'C',
          optionText: 'Calmly end the Special Play Time session immediately.',
          order: 3
        },
        {
          quizId: quiz6.id,
          optionLabel: 'D',
          optionText: 'Continue to Narrate the throwing action.',
          order: 4
        }
      ]
    });

    const correctOption6 = await prisma.quizOption.findFirst({
      where: { quizId: quiz6.id, optionLabel: 'C' }
    });
    await prisma.quiz.update({
      where: { id: quiz6.id },
      data: { correctAnswer: correctOption6.id }
    });

    console.log('✓ Created Lesson 6: Handling Chaos and Destruction in Special Time');

    // ============================================================================
    // Day 7: The Parent is the Most Important Ingredient
    // ============================================================================

    const lesson7 = await prisma.lesson.create({
      data: {
        phase: 'CONNECT',
        phaseNumber: 1,
        dayNumber: 7,
        title: 'The Parent is the Most Important Ingredient',
        subtitle: 'Your Presence Matters More Than Toys',
        shortDescription: 'Discover how your attention and engagement are more powerful than any toy in building connection with your child.',
        objectives: [
          'Understand that parent attention drives play',
          'Learn how to be the "fun factor"',
          'Build confidence in connection without expensive toys'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson1.id, lesson2.id, lesson3.id, lesson4.id, lesson5.id, lesson6.id],
        teachesCategories: ['PRAISE', 'ECHO', 'NARRATE'],
        dragonImageUrl: null,
        backgroundColor: '#E4E4FF',
        ellipse77Color: '#C7B3FF',
        ellipse78Color: '#9BD4DF'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson7.id,
          order: 1,
          sectionTitle: 'You Are the Magic',
          contentType: 'TEXT',
          bodyText: 'Many parents worry they don\'t have the "right" toys for Special Play Time. But here\'s the truth: your child doesn\'t need expensive toys or elaborate setups.\n\nWhat makes Special Play Time powerful is YOU—your attention, your narration, your excitement. When you use Praise, Echo, and Narrate, you become the most interesting part of the play. Your child will be drawn to you, not just the toys.\n\nEven simple objects like blocks, crayons, or plastic animals become magical when you\'re fully engaged.'
        },
        {
          lessonId: lesson7.id,
          order: 2,
          sectionTitle: 'Example: Transforming Simple Play',
          contentType: 'EXAMPLE',
          bodyText: 'Child is stacking blocks.\n\nWithout PEN:\n"That\'s nice, sweetie." (parent looks at phone)\n\nWith PEN:\n"You\'re building a tall tower! You chose the red block for the bottom—such a strong base! Now you\'re adding blue on top. You\'re stacking so carefully!"\n\nNotice how the second example makes the parent the "narrator" of an exciting story. The child feels seen, heard, and important.'
        },
        {
          lessonId: lesson7.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'Today, try Special Play Time with the simplest toys you have—even just paper and crayons. Focus entirely on PEN skills. Notice how your child lights up when YOU are the main ingredient, not the toys.'
        }
      ]
    });

    const quiz7 = await prisma.quiz.create({
      data: {
        lessonId: lesson7.id,
        question: 'What is the "most important ingredient" in Special Play Time?',
        correctAnswer: '',
        explanation: 'Your full attention and engagement (using PEN skills) are what make Special Play Time powerful, not the toys themselves. Children crave connection with their parents more than anything else.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz7.id,
          optionLabel: 'A',
          optionText: 'Expensive educational toys',
          order: 1
        },
        {
          quizId: quiz7.id,
          optionLabel: 'B',
          optionText: 'A large playroom with lots of options',
          order: 2
        },
        {
          quizId: quiz7.id,
          optionLabel: 'C',
          optionText: 'The parent\'s full attention and engagement',
          order: 3
        },
        {
          quizId: quiz7.id,
          optionLabel: 'D',
          optionText: 'At least 30 minutes of uninterrupted time',
          order: 4
        }
      ]
    });

    const correctOption7 = await prisma.quizOption.findFirst({
      where: { quizId: quiz7.id, optionLabel: 'C' }
    });
    await prisma.quiz.update({
      where: { id: quiz7.id },
      data: { correctAnswer: correctOption7.id }
    });

    console.log('✓ Created Lesson 7: The Parent is the Most Important Ingredient');

    // ============================================================================
    // Day 8: Dealing with Whining and Tantrums During Special Time
    // ============================================================================

    const lesson8 = await prisma.lesson.create({
      data: {
        phase: 'CONNECT',
        phaseNumber: 1,
        dayNumber: 8,
        title: 'Dealing with Whining and Tantrums During Special Time',
        subtitle: 'Stay Calm When Emotions Run High',
        shortDescription: 'Learn how to handle whining, crying, and tantrums during Special Play Time without breaking connection.',
        objectives: [
          'Understand why tantrums happen during connection time',
          'Learn the "Validate and Redirect" technique',
          'Maintain boundaries while staying emotionally present'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson1.id, lesson2.id, lesson3.id, lesson4.id, lesson5.id, lesson6.id, lesson7.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#FFF0E4',
        ellipse77Color: '#FFD0A6',
        ellipse78Color: '#A6D0E0'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson8.id,
          order: 1,
          sectionTitle: 'Why Tantrums Happen',
          contentType: 'TEXT',
          bodyText: 'Sometimes during Special Play Time, your child may whine, cry, or even have a tantrum. This can feel frustrating—you\'re trying to connect, and they\'re melting down!\n\nBut here\'s what\'s happening: your focused attention is stirring up big emotions. Children who are used to getting attention through negative behavior may "test" whether you\'ll stay present when things get hard.\n\nThis is actually progress. Your child is learning that you\'re a safe person to express emotions with.'
        },
        {
          lessonId: lesson8.id,
          order: 2,
          sectionTitle: 'Validate and Redirect',
          contentType: 'TEXT',
          bodyText: 'When your child whines or cries during Special Play Time:\n\n1. Validate: "I see you\'re feeling frustrated."\n2. Redirect: "Let\'s take a deep breath together. What would you like to play with next?"\n3. Continue PEN: Return to Narrating and Praising as soon as they re-engage.\n\nDo NOT:\n- Give in to demands outside the session rules\n- End the session early (unless behavior is dangerous)\n- Lecture or scold ("You\'re ruining our special time!")'
        },
        {
          lessonId: lesson8.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'If your child has a tantrum during Special Play Time today, stay calm. Validate their feelings with one sentence, then wait quietly. When they calm down, immediately return to PEN skills. Show them you won\'t abandon them when emotions are big.'
        }
      ]
    });

    const quiz8 = await prisma.quiz.create({
      data: {
        lessonId: lesson8.id,
        question: 'Your child starts crying because you won\'t let them play with a forbidden toy during Special Play Time. What should you do?',
        correctAnswer: '',
        explanation: 'Validate their emotion ("I see you\'re upset"), then redirect them to an allowed toy while staying calm. This teaches emotional regulation while maintaining boundaries.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz8.id,
          optionLabel: 'A',
          optionText: 'End the session immediately to avoid conflict.',
          order: 1
        },
        {
          quizId: quiz8.id,
          optionLabel: 'B',
          optionText: 'Give in and let them play with the toy.',
          order: 2
        },
        {
          quizId: quiz8.id,
          optionLabel: 'C',
          optionText: 'Validate their feelings, then calmly redirect to an allowed toy.',
          order: 3
        },
        {
          quizId: quiz8.id,
          optionLabel: 'D',
          optionText: 'Ignore the crying completely and continue playing.',
          order: 4
        }
      ]
    });

    const correctOption8 = await prisma.quizOption.findFirst({
      where: { quizId: quiz8.id, optionLabel: 'C' }
    });
    await prisma.quiz.update({
      where: { id: quiz8.id },
      data: { correctAnswer: correctOption8.id }
    });

    console.log('✓ Created Lesson 8: Dealing with Whining and Tantrums During Special Time');

    // ============================================================================
    // Day 9: Building Trust Through Consistency
    // ============================================================================

    const lesson9 = await prisma.lesson.create({
      data: {
        phase: 'CONNECT',
        phaseNumber: 1,
        dayNumber: 9,
        title: 'Building Trust Through Consistency',
        subtitle: 'Why Regular Special Time Changes Everything',
        shortDescription: 'Understand how consistent Special Play Time builds deep trust and security in your relationship.',
        objectives: [
          'Learn why consistency matters more than perfection',
          'Create a sustainable Special Time routine',
          'Handle interruptions and missed sessions'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson1.id, lesson2.id, lesson3.id, lesson4.id, lesson5.id, lesson6.id, lesson7.id, lesson8.id],
        teachesCategories: ['PRAISE', 'ECHO', 'NARRATE'],
        dragonImageUrl: null,
        backgroundColor: '#E4E4FF',
        ellipse77Color: '#C7B3FF',
        ellipse78Color: '#9BD4DF'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson9.id,
          order: 1,
          sectionTitle: 'Consistency Builds Trust',
          contentType: 'TEXT',
          bodyText: 'One great Special Play Time session is wonderful. But *regular* Special Play Time is transformational.\n\nWhen your child knows they can count on this time with you—every day or every other day—they begin to trust that:\n- You will show up for them\n- Their needs matter\n- They don\'t have to "act out" to get your attention\n\nThis predictability creates deep emotional security.'
        },
        {
          lessonId: lesson9.id,
          order: 2,
          sectionTitle: 'It Doesn\'t Have to Be Perfect',
          contentType: 'TEXT',
          bodyText: 'Many parents worry they need to do Special Play Time "perfectly" or not at all. But that\'s not true.\n\nWhat matters most:\n- Consistency (even 5 minutes is valuable)\n- Full attention during that time\n- Using PEN skills as best you can\n\nWhat matters less:\n- The exact time of day\n- Whether you miss a day occasionally\n- Whether every session feels "magical"\n\nYour child will benefit from consistent, imperfect Special Time far more than from occasional "perfect" sessions.'
        },
        {
          lessonId: lesson9.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'Choose a realistic time for Special Play Time—maybe right after school, or before bedtime. Put it on your calendar. Treat it like a doctor\'s appointment you wouldn\'t cancel. Even on hard days, show up for those 5-10 minutes.'
        }
      ]
    });

    const quiz9 = await prisma.quiz.create({
      data: {
        lessonId: lesson9.id,
        question: 'What is MORE important than having "perfect" Special Play Time sessions?',
        correctAnswer: '',
        explanation: 'Consistency builds trust and security in children. Regular, imperfect Special Time is far more powerful than occasional perfect sessions.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz9.id,
          optionLabel: 'A',
          optionText: 'Having expensive toys',
          order: 1
        },
        {
          quizId: quiz9.id,
          optionLabel: 'B',
          optionText: 'Doing it at the exact same time every day',
          order: 2
        },
        {
          quizId: quiz9.id,
          optionLabel: 'C',
          optionText: 'Showing up consistently, even if imperfect',
          order: 3
        },
        {
          quizId: quiz9.id,
          optionLabel: 'D',
          optionText: 'Making every session last 30+ minutes',
          order: 4
        }
      ]
    });

    const correctOption9 = await prisma.quizOption.findFirst({
      where: { quizId: quiz9.id, optionLabel: 'C' }
    });
    await prisma.quiz.update({
      where: { id: quiz9.id },
      data: { correctAnswer: correctOption9.id }
    });

    console.log('✓ Created Lesson 9: Building Trust Through Consistency');

    // ============================================================================
    // Day 10: When Siblings Want In
    // ============================================================================

    const lesson10 = await prisma.lesson.create({
      data: {
        phase: 'CONNECT',
        phaseNumber: 1,
        dayNumber: 10,
        title: 'When Siblings Want In',
        subtitle: 'Managing One-on-One Time with Multiple Kids',
        shortDescription: 'Learn strategies for doing Special Play Time with each child individually when you have multiple children.',
        objectives: [
          'Understand why one-on-one time is crucial',
          'Create fair rotation schedules',
          'Handle sibling jealousy and interruptions'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson1.id, lesson2.id, lesson3.id, lesson4.id, lesson5.id, lesson6.id, lesson7.id, lesson8.id, lesson9.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#FFF0E4',
        ellipse77Color: '#FFD0A6',
        ellipse78Color: '#A6D0E0'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson10.id,
          order: 1,
          sectionTitle: 'Why One-on-One Matters',
          contentType: 'TEXT',
          bodyText: 'If you have multiple children, you might be tempted to do Special Play Time with everyone together. But this defeats the purpose.\n\nChildren need individual attention from their parents—time when they\'re not competing for your focus. This is especially true for:\n- Middle children (who often feel overlooked)\n- Children with siblings who have special needs\n- Children who are quieter and get "drowned out"\n\nEach child deserves to feel like the most important person in your world, even if just for 10 minutes.'
        },
        {
          lessonId: lesson10.id,
          order: 2,
          sectionTitle: 'Creating a Fair System',
          contentType: 'TEXT',
          bodyText: 'Strategies for managing multiple kids:\n\n1. **Rotate days**: Child A gets Monday, Child B gets Tuesday, etc.\n2. **Use a visual schedule**: Let kids see whose "turn" it is\n3. **Set clear expectations**: "This is Ella\'s Special Time. You\'ll have yours tomorrow."\n4. **Protect the boundary**: If a sibling interrupts, calmly redirect them: "This is Jack\'s time. I\'ll play with you during your time tomorrow."\n\nConsistency is key—kids will learn to trust the system if you stick to it.'
        },
        {
          lessonId: lesson10.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'If you have multiple children, create a visual calendar showing whose turn it is each day. Explain the system to everyone. When interruptions happen, calmly enforce the boundary: "This is Maya\'s Special Time. Your turn is tomorrow." Be consistent, even when it\'s hard.'
        }
      ]
    });

    const quiz10 = await prisma.quiz.create({
      data: {
        lessonId: lesson10.id,
        question: 'Your other child keeps interrupting during Special Play Time. What should you do?',
        correctAnswer: '',
        explanation: 'Protecting one-on-one time teaches both children that their individual time with you is important and will be respected. This actually reduces sibling rivalry over time.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz10.id,
          optionLabel: 'A',
          optionText: 'Let them join so nobody feels left out.',
          order: 1
        },
        {
          quizId: quiz10.id,
          optionLabel: 'B',
          optionText: 'Calmly redirect them and remind them of their scheduled turn.',
          order: 2
        },
        {
          quizId: quiz10.id,
          optionLabel: 'C',
          optionText: 'End the session to avoid conflict.',
          order: 3
        },
        {
          quizId: quiz10.id,
          optionLabel: 'D',
          optionText: 'Ignore the interruption and continue playing.',
          order: 4
        }
      ]
    });

    const correctOption10 = await prisma.quizOption.findFirst({
      where: { quizId: quiz10.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz10.id },
      data: { correctAnswer: correctOption10.id }
    });

    console.log('✓ Created Lesson 10: When Siblings Want In');

    // ============================================================================
    // Day 11: What If My Child Ignores Me During Special Time?
    // ============================================================================

    const lesson11 = await prisma.lesson.create({
      data: {
        phase: 'CONNECT',
        phaseNumber: 1,
        dayNumber: 11,
        title: 'What If My Child Ignores Me During Special Time?',
        subtitle: 'When Connection Feels One-Sided',
        shortDescription: 'Learn what to do when your child seems disengaged or uninterested during Special Play Time.',
        objectives: [
          'Understand why children sometimes ignore parents',
          'Learn the "Stay Present and Keep Narrating" approach',
          'Build patience and trust in the process'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson1.id, lesson2.id, lesson3.id, lesson4.id, lesson5.id, lesson6.id, lesson7.id, lesson8.id, lesson9.id, lesson10.id],
        teachesCategories: ['ECHO', 'NARRATE'],
        dragonImageUrl: null,
        backgroundColor: '#E4E4FF',
        ellipse77Color: '#C7B3FF',
        ellipse78Color: '#9BD4DF'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson11.id,
          order: 1,
          sectionTitle: 'Why Children Ignore Us',
          contentType: 'TEXT',
          bodyText: 'It can be heartbreaking: you sit down for Special Play Time, ready to connect, and your child barely acknowledges you. They play quietly by themselves, don\'t respond to your comments, and seem... distant.\n\nThis happens for a few reasons:\n- They\'re testing whether you\'ll stay (especially if connection has been inconsistent)\n- They\'re overwhelmed by the attention and need time to adjust\n- They\'re used to playing alone and don\'t know how to engage yet\n\nThis is NORMAL. Don\'t take it personally.'
        },
        {
          lessonId: lesson11.id,
          order: 2,
          sectionTitle: 'Stay Present and Keep Narrating',
          contentType: 'TEXT',
          bodyText: 'What to do when your child ignores you:\n\n1. **Keep using PEN skills anyway**: "You\'re lining up the cars. Now you\'re putting the red one first."\n2. **Stay calm and warm**: Don\'t sound hurt or frustrated\n3. **Don\'t force interaction**: No questions like "Why aren\'t you talking to me?"\n4. **Trust the process**: Connection takes time\n\nYour child is absorbing your presence even if they\'re not responding. Over days or weeks, they\'ll begin to open up.'
        },
        {
          lessonId: lesson11.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'If your child is quiet or distant during Special Play Time, resist the urge to "fix" it. Continue Narrating their play in a warm, non-demanding voice. Think of yourself as a gentle sportscaster. Your consistent presence will eventually draw them in.'
        }
      ]
    });

    const quiz11 = await prisma.quiz.create({
      data: {
        lessonId: lesson11.id,
        question: 'Your child is playing silently and not responding to your Narration during Special Time. What should you do?',
        correctAnswer: '',
        explanation: 'Staying present and continuing to use PEN skills without forcing interaction shows your child that your attention is unconditional. This builds trust over time.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz11.id,
          optionLabel: 'A',
          optionText: 'Ask them why they\'re ignoring you.',
          order: 1
        },
        {
          quizId: quiz11.id,
          optionLabel: 'B',
          optionText: 'End the session since they\'re not engaged.',
          order: 2
        },
        {
          quizId: quiz11.id,
          optionLabel: 'C',
          optionText: 'Stay present and keep Narrating warmly without forcing interaction.',
          order: 3
        },
        {
          quizId: quiz11.id,
          optionLabel: 'D',
          optionText: 'Try to get them excited by suggesting different toys.',
          order: 4
        }
      ]
    });

    const correctOption11 = await prisma.quizOption.findFirst({
      where: { quizId: quiz11.id, optionLabel: 'C' }
    });
    await prisma.quiz.update({
      where: { id: quiz11.id },
      data: { correctAnswer: correctOption11.id }
    });

    console.log('✓ Created Lesson 11: What If My Child Ignores Me During Special Time?');

    // ============================================================================
    // Day 12: Special Time for Different Ages
    // ============================================================================

    const lesson12 = await prisma.lesson.create({
      data: {
        phase: 'CONNECT',
        phaseNumber: 1,
        dayNumber: 12,
        title: 'Special Time for Different Ages',
        subtitle: 'Adapting Connection for Toddlers, Preschoolers, and Big Kids',
        shortDescription: 'Learn how to adapt Special Play Time for different developmental stages from toddlers to school-age children.',
        objectives: [
          'Adapt PEN skills for toddlers (18 months - 3 years)',
          'Adjust for preschoolers (3-5 years)',
          'Modify for school-age children (5-10 years)'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson1.id, lesson2.id, lesson3.id, lesson4.id, lesson5.id, lesson6.id, lesson7.id, lesson8.id, lesson9.id, lesson10.id, lesson11.id],
        teachesCategories: ['PRAISE', 'ECHO', 'NARRATE'],
        dragonImageUrl: null,
        backgroundColor: '#FFF0E4',
        ellipse77Color: '#FFD0A6',
        ellipse78Color: '#A6D0E0'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson12.id,
          order: 1,
          sectionTitle: 'Toddlers (18 months - 3 years)',
          contentType: 'TEXT',
          bodyText: 'Toddlers have short attention spans and big emotions. With toddlers:\n\n- **Keep sessions short**: 5 minutes is plenty\n- **Use simple language**: "You\'re stacking! Red block!"\n- **Narrate movements**: "You\'re walking to the toy box. You\'re reaching for the ball."\n- **Expect chaos**: Toddlers explore through dumping, throwing, and moving constantly\n- **Follow their lead completely**: They\'ll switch activities every 30 seconds—that\'s normal\n\nGoal: Help them feel seen and safe.'
        },
        {
          lessonId: lesson12.id,
          order: 2,
          sectionTitle: 'Preschoolers (3-5 years) and School-Age (5-10 years)',
          contentType: 'TEXT',
          bodyText: 'Preschoolers (3-5 years):\n- More complex play (pretend scenarios, building projects)\n- Use richer vocabulary: "You\'re creating a zoo for the animals!"\n- Sessions can last 10-15 minutes\n- May start testing boundaries more\n\nSchool-Age (5-10 years):\n- May prefer structured activities (board games, crafts, sports)\n- Appreciate more detailed observations: "You\'re using strategy—you\'re thinking ahead!"\n- Can handle 15-20 minute sessions\n- May feel "too old" for Special Time at first—normalize it as "hang out time"\n\nGoal: Strengthen connection as they grow more independent.'
        },
        {
          lessonId: lesson12.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'Today, think about your child\'s age and adjust your expectations. If you have a toddler, celebrate 5 minutes of chaotic connection. If you have a school-age child, try a board game and Narrate their strategy choices.'
        }
      ]
    });

    const quiz12 = await prisma.quiz.create({
      data: {
        lessonId: lesson12.id,
        question: 'Your 2-year-old switches activities every 30 seconds during Special Play Time. What does this mean?',
        correctAnswer: '',
        explanation: 'Toddlers have very short attention spans and explore through rapid activity changes. This is developmentally normal and healthy—not a sign that Special Time isn\'t working.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz12.id,
          optionLabel: 'A',
          optionText: 'Special Play Time isn\'t working for them.',
          order: 1
        },
        {
          quizId: quiz12.id,
          optionLabel: 'B',
          optionText: 'They might have attention problems.',
          order: 2
        },
        {
          quizId: quiz12.id,
          optionLabel: 'C',
          optionText: 'This is completely normal for toddlers.',
          order: 3
        },
        {
          quizId: quiz12.id,
          optionLabel: 'D',
          optionText: 'You need to redirect them to one activity.',
          order: 4
        }
      ]
    });

    const correctOption12 = await prisma.quizOption.findFirst({
      where: { quizId: quiz12.id, optionLabel: 'C' }
    });
    await prisma.quiz.update({
      where: { id: quiz12.id },
      data: { correctAnswer: correctOption12.id }
    });

    console.log('✓ Created Lesson 12: Special Time for Different Ages');

    // ============================================================================
    // Day 13: When You're Touched Out and Exhausted
    // ============================================================================

    const lesson13 = await prisma.lesson.create({
      data: {
        phase: 'CONNECT',
        phaseNumber: 1,
        dayNumber: 13,
        title: 'When You\'re Touched Out and Exhausted',
        subtitle: 'Self-Care So You Can Show Up',
        shortDescription: 'Learn how to do Special Play Time even when you\'re exhausted, touched out, or running on empty.',
        objectives: [
          'Recognize parental burnout signs',
          'Use low-energy Special Time strategies',
          'Protect your own nervous system'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson1.id, lesson2.id, lesson3.id, lesson4.id, lesson5.id, lesson6.id, lesson7.id, lesson8.id, lesson9.id, lesson10.id, lesson11.id, lesson12.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#E4E4FF',
        ellipse77Color: '#C7B3FF',
        ellipse78Color: '#9BD4DF'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson13.id,
          order: 1,
          sectionTitle: 'You Can\'t Pour from an Empty Cup',
          contentType: 'TEXT',
          bodyText: 'Some days you wake up already exhausted. You\'re "touched out," your patience is gone, and the thought of Special Play Time feels impossible.\n\nThis is real. Parenting is relentless. And here\'s the truth: you STILL need to show up for connection—but you can do it in a way that doesn\'t drain you further.\n\nSpecial Play Time doesn\'t have to be high-energy. It just needs to be present.'
        },
        {
          lessonId: lesson13.id,
          order: 2,
          sectionTitle: 'Low-Energy Special Time Ideas',
          contentType: 'TEXT',
          bodyText: 'When you\'re exhausted, try these low-energy options:\n\n- **Sit on the floor and Narrate while they play**: You don\'t have to actively play—just be present\n- **Choose calmer activities**: Coloring, puzzles, books\n- **Shorten the session**: Even 5 minutes counts\n- **Be honest (age-appropriately)**: "Mommy is tired today, but I still want our Special Time together."\n- **Use PEN skills while sitting/lying down**: "You\'re drawing a purple flower. You\'re so focused."\n\nYour child benefits from your calm presence even if you\'re not bouncing around the room.'
        },
        {
          lessonId: lesson13.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'On your hardest day this week, still do Special Play Time—but give yourself permission to do the lowest-energy version. Sit on the couch, let your child play nearby, and Narrate gently. This teaches you both that connection doesn\'t require perfection.'
        }
      ]
    });

    const quiz13 = await prisma.quiz.create({
      data: {
        lessonId: lesson13.id,
        question: 'You\'re completely exhausted and "touched out." What is the best approach to Special Play Time?',
        correctAnswer: '',
        explanation: 'Special Play Time doesn\'t require high energy—it requires presence. Even sitting calmly and Narrating while your child plays nearby creates valuable connection without draining you further.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz13.id,
          optionLabel: 'A',
          optionText: 'Skip it entirely until you feel better.',
          order: 1
        },
        {
          quizId: quiz13.id,
          optionLabel: 'B',
          optionText: 'Force yourself to be high-energy so your child doesn\'t notice.',
          order: 2
        },
        {
          quizId: quiz13.id,
          optionLabel: 'C',
          optionText: 'Do a low-energy version: sit nearby, Narrate gently, keep it short.',
          order: 3
        },
        {
          quizId: quiz13.id,
          optionLabel: 'D',
          optionText: 'Turn on a show so you can rest instead.',
          order: 4
        }
      ]
    });

    const correctOption13 = await prisma.quizOption.findFirst({
      where: { quizId: quiz13.id, optionLabel: 'C' }
    });
    await prisma.quiz.update({
      where: { id: quiz13.id },
      data: { correctAnswer: correctOption13.id }
    });

    console.log('✓ Created Lesson 13: When You\'re Touched Out and Exhausted');

    // ============================================================================
    // Day 14: Celebrating Progress - You've Built the Foundation
    // ============================================================================

    const lesson14 = await prisma.lesson.create({
      data: {
        phase: 'CONNECT',
        phaseNumber: 1,
        dayNumber: 14,
        title: 'Celebrating Progress - You\'ve Built the Foundation',
        subtitle: 'Recognizing the Changes in Your Relationship',
        shortDescription: 'Reflect on the connection you\'ve built over the past two weeks and recognize the positive changes.',
        objectives: [
          'Identify signs of stronger connection',
          'Recognize your own growth as a parent',
          'Prepare for the transition to Phase 2: Discipline'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson1.id, lesson2.id, lesson3.id, lesson4.id, lesson5.id, lesson6.id, lesson7.id, lesson8.id, lesson9.id, lesson10.id, lesson11.id, lesson12.id, lesson13.id],
        teachesCategories: ['PRAISE', 'ECHO', 'NARRATE'],
        dragonImageUrl: null,
        backgroundColor: '#FFF0E4',
        ellipse77Color: '#FFD0A6',
        ellipse78Color: '#A6D0E0'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson14.id,
          order: 1,
          sectionTitle: 'What You\'ve Accomplished',
          contentType: 'TEXT',
          bodyText: 'Over the past two weeks, you\'ve learned:\n\n✓ The power of PEN skills (Praise, Echo, Narrate)\n✓ How to do Special Play Time consistently\n✓ How to handle chaos, tantrums, and interruptions\n✓ How to stay present even when it\'s hard\n✓ That YOU are the most important ingredient in your child\'s growth\n\nThis is HUGE. You\'ve built a foundation of connection that will make everything else easier.'
        },
        {
          lessonId: lesson14.id,
          order: 2,
          sectionTitle: 'Signs of Progress',
          contentType: 'TEXT',
          bodyText: 'You might be noticing:\n\n- Your child seeking you out more\n- Less attention-seeking behavior\n- More cooperation (even in small moments)\n- Your child talking more during Special Time\n- Fewer power struggles\n- You feeling more confident as a parent\n\nEven if the changes are subtle, they\'re real. Connection is the invisible foundation for everything else.'
        },
        {
          lessonId: lesson14.id,
          order: 3,
          sectionTitle: 'What Comes Next',
          contentType: 'TEXT',
          bodyText: 'You\'ve completed Phase 1: CONNECT. Now you\'re ready for Phase 2: DISCIPLINE.\n\nIn the next phase, you\'ll learn:\n- How to set boundaries effectively\n- How to use consequences that actually work\n- How to stay calm during meltdowns\n- How to reduce power struggles\n\nBecause you\'ve built a strong connection first, your child will be more receptive to boundaries. Connection makes discipline work.'
        }
      ]
    });

    const quiz14 = await prisma.quiz.create({
      data: {
        lessonId: lesson14.id,
        question: 'Why is it important to build connection BEFORE focusing on discipline?',
        correctAnswer: '',
        explanation: 'A strong connection creates trust and emotional safety. When children feel connected to their parents, they\'re more receptive to boundaries and discipline because they trust that their parent has their best interests at heart.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz14.id,
          optionLabel: 'A',
          optionText: 'So children feel guilty when they misbehave.',
          order: 1
        },
        {
          quizId: quiz14.id,
          optionLabel: 'B',
          optionText: 'Connection creates trust, making children more receptive to boundaries.',
          order: 2
        },
        {
          quizId: quiz14.id,
          optionLabel: 'C',
          optionText: 'Discipline doesn\'t work without bribes and rewards.',
          order: 3
        },
        {
          quizId: quiz14.id,
          optionLabel: 'D',
          optionText: 'It\'s not—you can start with discipline right away.',
          order: 4
        }
      ]
    });

    const correctOption14 = await prisma.quizOption.findFirst({
      where: { quizId: quiz14.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz14.id },
      data: { correctAnswer: correctOption14.id }
    });

    console.log('✓ Created Lesson 14: Celebrating Progress');

    // ============================================================================
    // Day 15: Preparing for Phase 2 - What to Expect
    // ============================================================================

    const lesson15 = await prisma.lesson.create({
      data: {
        phase: 'CONNECT',
        phaseNumber: 1,
        dayNumber: 15,
        title: 'Preparing for Phase 2 - What to Expect',
        subtitle: 'Transitioning from Connection to Discipline',
        shortDescription: 'Get ready for Phase 2 by understanding how discipline works differently when connection is strong.',
        objectives: [
          'Understand the Connect → Discipline framework',
          'Learn what makes discipline effective',
          'Set expectations for Phase 2'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson1.id, lesson2.id, lesson3.id, lesson4.id, lesson5.id, lesson6.id, lesson7.id, lesson8.id, lesson9.id, lesson10.id, lesson11.id, lesson12.id, lesson13.id, lesson14.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#E4E4FF',
        ellipse77Color: '#C7B3FF',
        ellipse78Color: '#9BD4DF'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson15.id,
          order: 1,
          sectionTitle: 'Why Discipline Fails Without Connection',
          contentType: 'TEXT',
          bodyText: 'Most parenting advice jumps straight to discipline: timeouts, consequences, reward charts. But these tools often fail because there\'s no foundation.\n\nThink of it like building a house:\n- Connection = Foundation\n- Discipline = Walls and roof\n\nYou can\'t build walls without a foundation. Similarly, discipline doesn\'t work when children don\'t feel connected to their parents.\n\nBut now you\'ve built that foundation. Your child trusts you. They feel seen and valued. This changes everything.'
        },
        {
          lessonId: lesson15.id,
          order: 2,
          sectionTitle: 'What You\'ll Learn in Phase 2',
          contentType: 'TEXT',
          bodyText: 'In Phase 2, you\'ll learn:\n\n**Week 1: Clear Expectations**\n- How to give effective commands\n- Setting up predictable routines\n- Creating visual schedules\n\n**Week 2: Consequences That Work**\n- Natural vs. logical consequences\n- Time-outs done right\n- The "when/then" framework\n\n**Week 3: Staying Calm Under Pressure**\n- Managing your own emotions\n- De-escalation techniques\n- Repairing after conflict\n\nPhase 2 is NOT about becoming stricter. It\'s about becoming clearer and calmer.'
        },
        {
          lessonId: lesson15.id,
          order: 3,
          sectionTitle: 'One Important Rule',
          contentType: 'TEXT',
          bodyText: 'As you move into Phase 2, remember this:\n\n**Keep doing Special Play Time.**\n\nConnection isn\'t something you do once and then stop. It\'s ongoing. Even as you set more boundaries, continue your daily Special Play Time.\n\nThis balance—connection AND boundaries—is what creates secure, confident children.'
        }
      ]
    });

    const quiz15 = await prisma.quiz.create({
      data: {
        lessonId: lesson15.id,
        question: 'As you move into Phase 2 (Discipline), what should you continue doing?',
        correctAnswer: '',
        explanation: 'Connection through Special Play Time must continue throughout Phase 2 and beyond. The balance of connection AND boundaries creates secure, well-regulated children.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz15.id,
          optionLabel: 'A',
          optionText: 'Stop Special Play Time since the connection is built.',
          order: 1
        },
        {
          quizId: quiz15.id,
          optionLabel: 'B',
          optionText: 'Continue daily Special Play Time while adding boundaries.',
          order: 2
        },
        {
          quizId: quiz15.id,
          optionLabel: 'C',
          optionText: 'Only do Special Time as a reward for good behavior.',
          order: 3
        },
        {
          quizId: quiz15.id,
          optionLabel: 'D',
          optionText: 'Reduce Special Time to once per week.',
          order: 4
        }
      ]
    });

    const correctOption15 = await prisma.quizOption.findFirst({
      where: { quizId: quiz15.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz15.id },
      data: { correctAnswer: correctOption15.id }
    });

    console.log('✓ Created Lesson 15: Preparing for Phase 2');
    console.log('\n🎉 Phase 1 (CONNECT) Complete! All 15 lessons added.\n');

    // ============================================================================
    // PHASE 2: DISCIPLINE
    // ============================================================================
    // Days 1-26: Building effective boundaries and consequences
    // ============================================================================

    // ============================================================================
    // Day 1: The Foundation of Effective Commands
    // ============================================================================

    const lesson16 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 1,
        title: 'The Foundation of Effective Commands',
        subtitle: 'Getting Your Child to Listen the First Time',
        shortDescription: 'Learn how to give clear, effective commands that your child is more likely to follow without nagging or repeating.',
        objectives: [
          'Understand why most commands fail',
          'Learn the 5 elements of an effective command',
          'Practice giving commands that work'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#E4E4FF',
        ellipse77Color: '#C7B3FF',
        ellipse78Color: '#9BD4DF'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson16.id,
          order: 1,
          sectionTitle: 'Why Commands Fail',
          contentType: 'TEXT',
          bodyText: 'Most parents give dozens of commands every day that children ignore:\n\n"Can you please put your shoes on?"\n"It\'s time to clean up, okay?"\n"Let\'s get ready for bed now."\n\nThese sound like commands, but they\'re actually requests or suggestions. They include escape routes:\n- Questions ("Can you...?") imply the child has a choice\n- "Please" makes it optional\n- "Okay?" at the end asks for agreement\n\nChildren learn quickly that these aren\'t real commands—they\'re negotiations.'
        },
        {
          lessonId: lesson16.id,
          order: 2,
          sectionTitle: 'The 5 Elements of an Effective Command',
          contentType: 'TEXT',
          bodyText: 'An effective command has 5 elements:\n\n1. **Get their attention first**: Make eye contact or use their name\n2. **Use a calm, firm voice**: Not angry, not pleading—neutral and confident\n3. **Be specific**: "Put your shoes on" not "Get ready"\n4. **Use a statement, not a question**: "Put your plate in the sink" not "Can you put your plate in the sink?"\n5. **Give them time to comply**: Wait 5 seconds silently before repeating\n\nExample:\n"Maya." (wait for eye contact) "Put your toys in the bin." (then wait silently)\n\nNo "please," no "okay?", no bargaining.'
        },
        {
          lessonId: lesson16.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'Today, pick ONE routine command you give often (like "Put your shoes on" or "Come to the table"). Practice giving it using all 5 elements. Notice if your child responds differently when you\'re clear and calm instead of asking or pleading.'
        }
      ]
    });

    const quiz16 = await prisma.quiz.create({
      data: {
        lessonId: lesson16.id,
        question: 'Which of the following is the MOST effective command?',
        correctAnswer: '',
        explanation: 'This command has all 5 elements: it gets attention, is calm and firm, is specific, uses a statement (not a question), and implies you\'ll wait for compliance. The others are questions or requests that give the child an escape route.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz16.id,
          optionLabel: 'A',
          optionText: 'Can you please put your coat on?',
          order: 1
        },
        {
          quizId: quiz16.id,
          optionLabel: 'B',
          optionText: 'Let\'s get your coat on, okay?',
          order: 2
        },
        {
          quizId: quiz16.id,
          optionLabel: 'C',
          optionText: 'Jack, put your coat on.',
          order: 3
        },
        {
          quizId: quiz16.id,
          optionLabel: 'D',
          optionText: 'It would be great if you could put your coat on.',
          order: 4
        }
      ]
    });

    const correctOption16 = await prisma.quizOption.findFirst({
      where: { quizId: quiz16.id, optionLabel: 'C' }
    });
    await prisma.quiz.update({
      where: { id: quiz16.id },
      data: { correctAnswer: correctOption16.id }
    });

    console.log('✓ Created Lesson 16 (Discipline Day 1): The Foundation of Effective Commands');

    // ============================================================================
    // Day 2: The 5-Second Rule
    // ============================================================================

    const lesson17 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 2,
        title: 'The 5-Second Rule',
        subtitle: 'Why Waiting Silently is Powerful',
        shortDescription: 'Discover why waiting 5 seconds after giving a command is more effective than repeating or nagging.',
        objectives: [
          'Understand the power of silence after commands',
          'Learn to resist the urge to repeat',
          'Practice patient waiting'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#FFF0E4',
        ellipse77Color: '#FFD0A6',
        ellipse78Color: '#A6D0E0'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson17.id,
          order: 1,
          sectionTitle: 'The Nagging Trap',
          contentType: 'TEXT',
          bodyText: 'After giving a command, most parents immediately:\n- Repeat it louder\n- Add threats: "I\'m not going to tell you again!"\n- Explain why: "You need to listen because..."\n- Negotiate: "If you do this, I\'ll let you..."\n\nThis teaches children to ignore the first command. They learn: "Mom will ask 5 times before she\'s serious."\n\nThe fix? Wait.'
        },
        {
          lessonId: lesson17.id,
          order: 2,
          sectionTitle: 'Why 5 Seconds Works',
          contentType: 'TEXT',
          bodyText: 'After you give a command, count to 5 in your head. Stay silent. Don\'t talk, don\'t explain, don\'t threaten.\n\nHere\'s what happens:\n1. Your child\'s brain processes the command\n2. They decide whether to comply\n3. Your silence shows you mean it\n4. They realize there\'s no negotiation\n\nMost children will comply within 5 seconds when you:\n- Give a clear command\n- Stay calm\n- Wait silently\n\nIf they don\'t comply after 5 seconds, repeat the command ONCE. Then move to a consequence (we\'ll cover this soon).'
        },
        {
          lessonId: lesson17.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'Today, after giving a command, count slowly to 5 in your head. Resist the urge to talk, repeat, or explain. Just wait. Notice how your child responds when you stay calm and silent instead of nagging.'
        }
      ]
    });

    const quiz17 = await prisma.quiz.create({
      data: {
        lessonId: lesson17.id,
        question: 'You give your child a clear command: "Put your tablet on the table." They don\'t respond immediately. What should you do?',
        correctAnswer: '',
        explanation: 'Waiting silently for 5 seconds gives your child time to process and comply. It also shows that you\'re serious and not going to nag or negotiate. Most children will comply when parents stay calm and wait.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz17.id,
          optionLabel: 'A',
          optionText: 'Immediately repeat it louder.',
          order: 1
        },
        {
          quizId: quiz17.id,
          optionLabel: 'B',
          optionText: 'Wait silently for 5 seconds before responding.',
          order: 2
        },
        {
          quizId: quiz17.id,
          optionLabel: 'C',
          optionText: 'Explain why they need to put the tablet down.',
          order: 3
        },
        {
          quizId: quiz17.id,
          optionLabel: 'D',
          optionText: 'Take the tablet away immediately.',
          order: 4
        }
      ]
    });

    const correctOption17 = await prisma.quizOption.findFirst({
      where: { quizId: quiz17.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz17.id },
      data: { correctAnswer: correctOption17.id }
    });

    console.log('✓ Created Lesson 17 (Discipline Day 2): The 5-Second Rule');

    // ============================================================================
    // Day 3: When Compliance Happens - Label It!
    // ============================================================================

    const lesson18 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 3,
        title: 'When Compliance Happens - Label It!',
        subtitle: 'Reinforcing Good Behavior in the Moment',
        shortDescription: 'Learn how to use Labeled Praise to increase compliance and make discipline more positive.',
        objectives: [
          'Understand the power of Labeled Praise for compliance',
          'Learn to notice and name good behavior immediately',
          'Create a positive discipline cycle'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id, lesson17.id],
        teachesCategories: ['PRAISE'],
        dragonImageUrl: null,
        backgroundColor: '#E4E4FF',
        ellipse77Color: '#C7B3FF',
        ellipse78Color: '#9BD4DF'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson18.id,
          order: 1,
          sectionTitle: 'Catch Them Being Good',
          contentType: 'TEXT',
          bodyText: 'When your child complies with a command, most parents just move on to the next task. But this is a HUGE missed opportunity.\n\nEvery time your child listens, you should Label it with Praise:\n\n"You put your shoes on when I asked. Thank you for listening!"\n"You came to the table right away. I appreciate that!"\n"You cleaned up your toys the first time. Great job!"\n\nThis teaches your child: "Listening gets me positive attention." Over time, compliance becomes more rewarding than defiance.'
        },
        {
          lessonId: lesson18.id,
          order: 2,
          sectionTitle: 'Example: Praise vs. No Praise',
          contentType: 'EXAMPLE',
          bodyText: 'Scenario: You ask your child to put their cup in the sink.\n\n**Without Labeled Praise:**\nParent: "Put your cup in the sink."\nChild: (puts cup in sink)\nParent: (says nothing, moves on)\n\n**With Labeled Praise:**\nParent: "Put your cup in the sink."\nChild: (puts cup in sink)\nParent: "You put your cup in the sink when I asked! Thank you for listening."\n\nNotice the difference? The second example teaches the child that listening is valued. This makes them MORE likely to comply next time.'
        },
        {
          lessonId: lesson18.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'Today, every time your child complies with a command—even small ones—immediately Label their compliance with specific praise. "You put your coat on when I asked!" Notice how this changes the tone of discipline from negative to positive.'
        }
      ]
    });

    const quiz18 = await prisma.quiz.create({
      data: {
        lessonId: lesson18.id,
        question: 'Your child puts their toys away after you give a command. What should you do?',
        correctAnswer: '',
        explanation: 'Labeled Praise reinforces the behavior you want to see more of. When you specifically name the behavior ("You cleaned up when I asked"), your child learns that listening brings positive attention, making future compliance more likely.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz18.id,
          optionLabel: 'A',
          optionText: 'Say nothing and move on to the next task.',
          order: 1
        },
        {
          quizId: quiz18.id,
          optionLabel: 'B',
          optionText: 'Immediately praise: "You cleaned up when I asked! Thank you for listening!"',
          order: 2
        },
        {
          quizId: quiz18.id,
          optionLabel: 'C',
          optionText: 'Give them a sticker or treat as a reward.',
          order: 3
        },
        {
          quizId: quiz18.id,
          optionLabel: 'D',
          optionText: 'Point out that they should have done it faster.',
          order: 4
        }
      ]
    });

    const correctOption18 = await prisma.quizOption.findFirst({
      where: { quizId: quiz18.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz18.id },
      data: { correctAnswer: correctOption18.id }
    });

    console.log('✓ Created Lesson 18 (Discipline Day 3): When Compliance Happens - Label It!');

    // ============================================================================
    // Day 4: Natural vs. Logical Consequences
    // ============================================================================

    const lesson19 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 4,
        title: 'Natural vs. Logical Consequences',
        subtitle: 'Letting Reality Be the Teacher',
        shortDescription: 'Understand the difference between natural and logical consequences and when to use each.',
        objectives: [
          'Learn what natural consequences are',
          'Understand logical consequences',
          'Know when to let natural consequences happen'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id, lesson17.id, lesson18.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#FFF0E4',
        ellipse77Color: '#FFD0A6',
        ellipse78Color: '#A6D0E0'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson19.id,
          order: 1,
          sectionTitle: 'Natural Consequences',
          contentType: 'TEXT',
          bodyText: 'Natural consequences happen automatically without parent intervention:\n\n- Child refuses to wear a coat → Gets cold outside\n- Child doesn\'t eat dinner → Gets hungry later\n- Child leaves toy outside → Toy gets rained on\n\nThese are the best teachers because they\'re immediate and reality-based. The world teaches the lesson, not you.\n\nWhen it\'s SAFE to do so, let natural consequences happen. Don\'t rescue your child from learning.'
        },
        {
          lessonId: lesson19.id,
          order: 2,
          sectionTitle: 'Logical Consequences',
          contentType: 'TEXT',
          bodyText: 'Logical consequences are created by the parent and directly related to the behavior:\n\n- Child throws food → Meal ends, plate removed\n- Child won\'t get in car seat → Car doesn\'t move, trip delayed\n- Child breaks a rule during Special Time → Session ends\n\nLogical consequences:\n✓ Are related to the behavior\n✓ Are immediate\n✓ Are calmly enforced\n✓ Teach cause-and-effect\n\n✗ Are NOT punishments\n✗ Don\'t involve lectures or shaming'
        },
        {
          lessonId: lesson19.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'Today, identify one area where you can let a natural consequence happen instead of rescuing. For example, if your child refuses to wear a coat and it\'s not dangerously cold, let them feel chilly and learn. Don\'t say "I told you so"—just let reality teach.'
        }
      ]
    });

    const quiz19 = await prisma.quiz.create({
      data: {
        lessonId: lesson19.id,
        question: 'Your child refuses to eat lunch. What is the natural consequence?',
        correctAnswer: '',
        explanation: 'Natural consequences happen automatically from the child\'s choice. If they don\'t eat, they naturally feel hungry. This teaches them about their body\'s needs without parent intervention.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz19.id,
          optionLabel: 'A',
          optionText: 'You make them sit at the table until they eat.',
          order: 1
        },
        {
          quizId: quiz19.id,
          optionLabel: 'B',
          optionText: 'They feel hungry later (natural consequence).',
          order: 2
        },
        {
          quizId: quiz19.id,
          optionLabel: 'C',
          optionText: 'You take away their toys as punishment.',
          order: 3
        },
        {
          quizId: quiz19.id,
          optionLabel: 'D',
          optionText: 'You lecture them about nutrition.',
          order: 4
        }
      ]
    });

    const correctOption19 = await prisma.quizOption.findFirst({
      where: { quizId: quiz19.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz19.id },
      data: { correctAnswer: correctOption19.id }
    });

    console.log('✓ Created Lesson 19 (Discipline Day 4): Natural vs. Logical Consequences');

    // ============================================================================
    // Day 5: The "When/Then" Framework
    // ============================================================================

    const lesson20 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 5,
        title: 'The "When/Then" Framework',
        subtitle: 'Turning Power Struggles into Cooperation',
        shortDescription: 'Learn how to use "When/Then" statements to motivate compliance without bribing or threatening.',
        objectives: [
          'Understand the When/Then framework',
          'Learn to use it without making it a bribe',
          'Practice turning demands into cooperation'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id, lesson17.id, lesson18.id, lesson19.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#E4E4FF',
        ellipse77Color: '#C7B3FF',
        ellipse78Color: '#9BD4DF'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson20.id,
          order: 1,
          sectionTitle: 'What is When/Then?',
          contentType: 'TEXT',
          bodyText: 'The "When/Then" framework links a required task with something the child wants:\n\n"When you put your shoes on, then we can go to the park."\n"When you finish your vegetables, then you can have dessert."\n"When you clean up your toys, then we can read a book."\n\nThis is NOT a bribe. A bribe is offering something extra to manipulate behavior. When/Then simply states reality: first this, then that.'
        },
        {
          lessonId: lesson20.id,
          order: 2,
          sectionTitle: 'Why It Works',
          contentType: 'TEXT',
          bodyText: 'When/Then works because:\n\n1. It gives the child control over the outcome\n2. It\'s stated calmly, not as a threat\n3. It focuses on what happens WHEN they cooperate, not what they lose if they don\'t\n4. It removes the power struggle\n\nCompare:\n❌ "If you don\'t clean up, no TV!" (threat)\n✓ "When you clean up, then you can watch TV." (choice)\n\nThe first creates resentment. The second creates motivation.'
        },
        {
          lessonId: lesson20.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'Today, identify one recurring power struggle (getting dressed, leaving the park, bedtime). Reframe it using When/Then: "When you put your pajamas on, then we can read two stories." Say it calmly, then wait. Notice if the power struggle dissolves.'
        }
      ]
    });

    const quiz20 = await prisma.quiz.create({
      data: {
        lessonId: lesson20.id,
        question: 'Which of the following is a proper "When/Then" statement?',
        correctAnswer: '',
        explanation: 'This is a proper When/Then statement because it calmly links the required behavior (putting toys away) with the desired activity (going outside), giving the child control over the outcome without threats.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz20.id,
          optionLabel: 'A',
          optionText: 'If you don\'t clean up, you\'re going to timeout!',
          order: 1
        },
        {
          quizId: quiz20.id,
          optionLabel: 'B',
          optionText: 'When you put your toys away, then we can go outside.',
          order: 2
        },
        {
          quizId: quiz20.id,
          optionLabel: 'C',
          optionText: 'Clean up right now or else!',
          order: 3
        },
        {
          quizId: quiz20.id,
          optionLabel: 'D',
          optionText: 'If you clean up, I\'ll give you candy.',
          order: 4
        }
      ]
    });

    const correctOption20 = await prisma.quizOption.findFirst({
      where: { quizId: quiz20.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz20.id },
      data: { correctAnswer: correctOption20.id }
    });

    console.log('✓ Created Lesson 20 (Discipline Day 5): The When/Then Framework');

    // ============================================================================
    // Day 6: Time-Outs That Actually Work
    // ============================================================================

    const lesson21 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 6,
        title: 'Time-Outs That Actually Work',
        subtitle: 'Using Time-Out as a Teaching Tool, Not Punishment',
        shortDescription: 'Learn how to implement effective time-outs that teach self-regulation without shaming or isolating your child.',
        objectives: [
          'Understand what makes time-outs effective',
          'Learn the proper time-out procedure',
          'Avoid common time-out mistakes'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id, lesson17.id, lesson18.id, lesson19.id, lesson20.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#FFF0E4',
        ellipse77Color: '#FFD0A6',
        ellipse78Color: '#A6D0E0'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson21.id,
          order: 1,
          sectionTitle: 'What Time-Out Is (and Isn\'t)',
          contentType: 'TEXT',
          bodyText: 'Time-out is NOT:\n❌ Banishment ("Go to your room and think about what you did!")\n❌ Humiliation (sitting on a "naughty chair" in public)\n❌ An hour-long isolation\n\nTime-out IS:\n✓ A brief pause from attention and activity\n✓ A chance for the child to calm down\n✓ A consequence for specific behaviors (hitting, not following through after a warning)\n✓ Short: 1 minute per year of age (3 years old = 3 minutes)\n\nTime-out works because it removes the child from stimulation and attention, giving them space to reset.'
        },
        {
          lessonId: lesson21.id,
          order: 2,
          sectionTitle: 'Effective Time-Out Procedure',
          contentType: 'TEXT',
          bodyText: '1. **Give a warning first**: "If you hit again, you\'ll go to time-out."\n2. **Follow through calmly**: "You hit. Time-out." (no lecture)\n3. **Take them to the time-out spot**: A boring chair or corner, not their room\n4. **Set a timer**: 1 minute per year of age\n5. **No interaction during time-out**: No talking, no eye contact\n6. **After timer**: "Time-out is over. Can you use gentle hands?" (brief check-in)\n7. **Move on**: Don\'t rehash or lecture\n\nKey: Stay calm and consistent. Time-out isn\'t effective if you\'re yelling or emotional.'
        },
        {
          lessonId: lesson21.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'Choose a time-out spot today—a boring chair or corner where your child can sit safely. Explain the new rule: "If you [specific behavior like hitting], you\'ll sit here for [X] minutes." When it happens, follow through calmly without lectures.'
        }
      ]
    });

    const quiz21 = await prisma.quiz.create({
      data: {
        lessonId: lesson21.id,
        question: 'How long should a time-out last for a 4-year-old child?',
        correctAnswer: '',
        explanation: 'The rule is 1 minute per year of age. For a 4-year-old, that\'s 4 minutes. This is long enough to be effective but short enough to be age-appropriate.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz21.id,
          optionLabel: 'A',
          optionText: '2 minutes',
          order: 1
        },
        {
          quizId: quiz21.id,
          optionLabel: 'B',
          optionText: '4 minutes',
          order: 2
        },
        {
          quizId: quiz21.id,
          optionLabel: 'C',
          optionText: '10 minutes',
          order: 3
        },
        {
          quizId: quiz21.id,
          optionLabel: 'D',
          optionText: 'Until they apologize',
          order: 4
        }
      ]
    });

    const correctOption21 = await prisma.quizOption.findFirst({
      where: { quizId: quiz21.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz21.id },
      data: { correctAnswer: correctOption21.id }
    });

    console.log('✓ Created Lesson 21 (Discipline Day 6): Time-Outs That Actually Work');

    // ============================================================================
    // Day 7: The Warning System
    // ============================================================================

    const lesson22 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 7,
        title: 'The Warning System',
        subtitle: 'Giving One Clear Chance Before Consequences',
        shortDescription: 'Learn how to use warnings effectively to give children a chance to correct behavior before consequences.',
        objectives: [
          'Understand when to give warnings vs. immediate consequences',
          'Learn how to deliver effective warnings',
          'Know when NOT to give warnings'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id, lesson17.id, lesson18.id, lesson19.id, lesson20.id, lesson21.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#E4E4FF',
        ellipse77Color: '#C7B3FF',
        ellipse78Color: '#9BD4DF'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson22.id,
          order: 1,
          sectionTitle: 'When to Give a Warning',
          contentType: 'TEXT',
          bodyText: 'Warnings are appropriate for:\n✓ Behaviors the child can stop immediately (running inside, yelling, not sharing)\n✓ First-time offenses in a new situation\n✓ Minor boundary-pushing\n\nWarnings are NOT appropriate for:\n❌ Dangerous behaviors (hitting, biting, running into street)\n❌ Behaviors you\'ve already warned about multiple times\n❌ Deliberate defiance after a clear command\n\nFor dangerous or repeat behaviors, skip the warning and go straight to the consequence.'
        },
        {
          lessonId: lesson22.id,
          order: 2,
          sectionTitle: 'How to Give an Effective Warning',
          contentType: 'TEXT',
          bodyText: 'An effective warning has 3 parts:\n\n1. **Name the behavior**: "You\'re throwing toys."\n2. **State the expectation**: "Toys stay on the floor."\n3. **State the consequence**: "If you throw again, playtime ends."\n\nExample: "You\'re yelling. We use inside voices. If you yell again, you\'ll go to time-out."\n\nThen WAIT. Give them a chance to comply. If they do, praise them: "Thank you for using your inside voice!"\n\nIf they don\'t comply, immediately follow through with the consequence. No second warnings.'
        },
        {
          lessonId: lesson22.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'Today, when your child pushes a boundary, give ONE clear warning with all 3 parts (name behavior, state expectation, state consequence). Then wait. If they comply, praise them. If they don\'t, immediately follow through. NO second warnings.'
        }
      ]
    });

    const quiz22 = await prisma.quiz.create({
      data: {
        lessonId: lesson22.id,
        question: 'Your child hits their sibling. Should you give a warning?',
        correctAnswer: '',
        explanation: 'Hitting is a dangerous behavior that requires immediate consequences, not warnings. The child needs to learn that hitting always results in an immediate consequence like time-out.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz22.id,
          optionLabel: 'A',
          optionText: 'Yes, always give a warning first.',
          order: 1
        },
        {
          quizId: quiz22.id,
          optionLabel: 'B',
          optionText: 'No, hitting requires immediate consequences without warning.',
          order: 2
        },
        {
          quizId: quiz22.id,
          optionLabel: 'C',
          optionText: 'Give three warnings before a consequence.',
          order: 3
        },
        {
          quizId: quiz22.id,
          optionLabel: 'D',
          optionText: 'Only give a warning if they didn\'t mean to hit.',
          order: 4
        }
      ]
    });

    const correctOption22 = await prisma.quizOption.findFirst({
      where: { quizId: quiz22.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz22.id },
      data: { correctAnswer: correctOption22.id }
    });

    console.log('✓ Created Lesson 22 (Discipline Day 7): The Warning System');

    // ============================================================================
    // Day 8: Following Through Every Time
    // ============================================================================

    const lesson23 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 8,
        title: 'Following Through Every Time',
        subtitle: 'Why Consistency is Everything',
        shortDescription: 'Understand why consistent follow-through is the key to effective discipline and how to maintain it.',
        objectives: [
          'Learn why inconsistency undermines discipline',
          'Develop strategies for consistent follow-through',
          'Handle situations when follow-through is difficult'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id, lesson17.id, lesson18.id, lesson19.id, lesson20.id, lesson21.id, lesson22.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#FFF0E4',
        ellipse77Color: '#FFD0A6',
        ellipse78Color: '#A6D0E0'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson23.id,
          order: 1,
          sectionTitle: 'Inconsistency = Confusion',
          contentType: 'TEXT',
          bodyText: 'When you follow through with consequences sometimes but not others, your child learns:\n\n"If I push hard enough, the rule will disappear."\n"Mom says \'no\' but she doesn\'t always mean it."\n"I just need to whine longer and she\'ll give in."\n\nInconsistency teaches children that rules are negotiable and that persistence pays off. This creates MORE power struggles, not fewer.\n\nConsistent follow-through teaches: "When Mom says something, she means it. There\'s no point arguing."'
        },
        {
          lessonId: lesson23.id,
          order: 2,
          sectionTitle: 'How to Be Consistent (Even When It\'s Hard)',
          contentType: 'TEXT',
          bodyText: 'Strategies for consistent follow-through:\n\n1. **Only give commands you\'re willing to enforce**: Don\'t threaten consequences you won\'t follow through on\n2. **Plan ahead**: If you\'re in public, have a plan for consequences before you need them\n3. **Stay calm**: Follow through matter-of-factly, not angrily\n4. **Get support**: If you\'re exhausted, ask your partner to handle enforcement\n5. **Accept short-term pain for long-term gain**: Following through might disrupt your day NOW, but it prevents bigger battles later\n\nExample: If you say "We\'re leaving the park in 5 minutes," you MUST leave in 5 minutes, even if your child melts down. Otherwise, they learn to ignore your warnings.'
        },
        {
          lessonId: lesson23.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'Today, commit to following through on EVERY consequence you state. If you give a warning, enforce the consequence if they don\'t comply. If you say "When you clean up, we can go outside," don\'t go outside until it\'s clean. 100% consistency, even when it\'s inconvenient.'
        }
      ]
    });

    const quiz23 = await prisma.quiz.create({
      data: {
        lessonId: lesson23.id,
        question: 'You told your child they\'d go to time-out if they threw toys again. They throw a toy, but you\'re exhausted. What should you do?',
        correctAnswer: '',
        explanation: 'Consistent follow-through is essential. Even when tired, following through teaches your child that consequences are predictable. Not following through teaches them to test boundaries more.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz23.id,
          optionLabel: 'A',
          optionText: 'Let it slide this one time since you\'re tired.',
          order: 1
        },
        {
          quizId: quiz23.id,
          optionLabel: 'B',
          optionText: 'Follow through with time-out as stated.',
          order: 2
        },
        {
          quizId: quiz23.id,
          optionLabel: 'C',
          optionText: 'Give another warning instead.',
          order: 3
        },
        {
          quizId: quiz23.id,
          optionLabel: 'D',
          optionText: 'Yell at them instead of doing time-out.',
          order: 4
        }
      ]
    });

    const correctOption23 = await prisma.quizOption.findFirst({
      where: { quizId: quiz23.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz23.id },
      data: { correctAnswer: correctOption23.id }
    });

    console.log('✓ Created Lesson 23 (Discipline Day 8): Following Through Every Time');

    // ============================================================================
    // Day 9: Handling Public Meltdowns
    // ============================================================================

    const lesson24 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 9,
        title: 'Handling Public Meltdowns',
        subtitle: 'Staying Calm When Everyone is Watching',
        shortDescription: 'Learn strategies for managing tantrums and defiance in public places without giving in or losing your cool.',
        objectives: [
          'Prepare for public meltdowns in advance',
          'Use the "Leave or Contain" strategy',
          'Handle judgment from others'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id, lesson17.id, lesson18.id, lesson19.id, lesson20.id, lesson21.id, lesson22.id, lesson23.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#E4E4FF',
        ellipse77Color: '#C7B3FF',
        ellipse78Color: '#9BD4DF'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson24.id,
          order: 1,
          sectionTitle: 'Why Public Meltdowns Feel Worse',
          contentType: 'TEXT',
          bodyText: 'Public tantrums are harder because:\n\n- You feel judged by strangers\n- Your child knows you might cave to avoid embarrassment\n- You can\'t use your usual consequences (like time-out)\n- You\'re stressed and less patient\n\nBut here\'s the truth: other parents understand. And giving in to avoid embarrassment teaches your child that public places = you\'ll give in.\n\nYou need a plan BEFORE the meltdown happens.'
        },
        {
          lessonId: lesson24.id,
          order: 2,
          sectionTitle: 'The "Leave or Contain" Strategy',
          contentType: 'TEXT',
          bodyText: 'When your child melts down in public, you have 2 options:\n\n**Option 1: Leave**\n- Calmly pick up your child and leave the store/restaurant/park\n- Say once: "We\'re leaving because you\'re not following the rules."\n- Don\'t lecture or yell\n- Return to car or go home\n- This is the MOST powerful consequence for public meltdowns\n\n**Option 2: Contain**\n- If leaving isn\'t possible (you\'re in line, on a plane, etc.)\n- Stay calm and quiet\n- Don\'t give attention to the tantrum\n- Keep them safe but don\'t engage\n- Follow through with a consequence when you get home\n\nThe key: Don\'t negotiate or give in to end the tantrum.'
        },
        {
          lessonId: lesson24.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'Before your next outing, tell your child the rules and consequence: "We\'re going to the store. If you run away or throw a tantrum, we\'ll leave immediately." Then follow through if needed, even if your cart is full.'
        }
      ]
    });

    const quiz24 = await prisma.quiz.create({
      data: {
        lessonId: lesson24.id,
        question: 'Your child throws a tantrum in the grocery store because you won\'t buy candy. What\'s the most effective response?',
        correctAnswer: '',
        explanation: 'Leaving immediately is the most powerful consequence for public tantrums. It teaches that tantrums don\'t work and that you\'ll follow through even when it\'s inconvenient. Staying and negotiating teaches them that tantrums work.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz24.id,
          optionLabel: 'A',
          optionText: 'Buy the candy to stop the tantrum.',
          order: 1
        },
        {
          quizId: quiz24.id,
          optionLabel: 'B',
          optionText: 'Calmly leave the store immediately, abandoning your cart.',
          order: 2
        },
        {
          quizId: quiz24.id,
          optionLabel: 'C',
          optionText: 'Yell at them to stop embarrassing you.',
          order: 3
        },
        {
          quizId: quiz24.id,
          optionLabel: 'D',
          optionText: 'Ignore them and continue shopping.',
          order: 4
        }
      ]
    });

    const correctOption24 = await prisma.quizOption.findFirst({
      where: { quizId: quiz24.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz24.id },
      data: { correctAnswer: correctOption24.id }
    });

    console.log('✓ Created Lesson 24 (Discipline Day 9): Handling Public Meltdowns');

    // ============================================================================
    // Day 10: When Your Child Hits or Bites
    // ============================================================================

    const lesson25 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 10,
        title: 'When Your Child Hits or Bites',
        subtitle: 'Responding to Aggressive Behavior',
        shortDescription: 'Learn how to respond immediately and effectively to hitting, biting, and other aggressive behaviors.',
        objectives: [
          'Understand why young children hit and bite',
          'Implement immediate consequences for aggression',
          'Teach alternative behaviors'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id, lesson17.id, lesson18.id, lesson19.id, lesson20.id, lesson21.id, lesson22.id, lesson23.id, lesson24.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#FFF0E4',
        ellipse77Color: '#FFD0A6',
        ellipse78Color: '#A6D0E0'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson25.id,
          order: 1,
          sectionTitle: 'Why Children Hit and Bite',
          contentType: 'TEXT',
          bodyText: 'Young children hit and bite because:\n\n- They lack language to express frustration ("I\'m mad!" = hit)\n- They\'re testing boundaries\n- They want a toy or attention\n- They\'re overwhelmed emotionally\n- They\'ve learned it gets results\n\nAggression is developmentally normal for toddlers and preschoolers. But it MUST be addressed immediately and consistently, or it becomes a habit.'
        },
        {
          lessonId: lesson25.id,
          order: 2,
          sectionTitle: 'Immediate Response to Aggression',
          contentType: 'TEXT',
          bodyText: 'When your child hits or bites:\n\n1. **Stop the behavior immediately**: Physically block or remove them\n2. **Use a firm, calm voice**: "No hitting. Hitting hurts."\n3. **Immediate consequence**: "You hit. Time-out." (no warning for aggression)\n4. **Attend to the victim first**: Check on the hurt child, show empathy\n5. **After consequence, teach**: "When you\'re mad, use words. Say \'I\'m angry!\' or come get me."\n6. **Practice alternatives**: Role-play using words instead of hitting\n\nNever hit back to "show them how it feels." This teaches that hitting is acceptable when you\'re bigger/stronger.'
        },
        {
          lessonId: lesson25.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'Today, if your child hits or bites, respond immediately with time-out (no warning). Afterward, teach one alternative: "When you\'re frustrated, stomp your feet instead" or "Say \'I need space!\'". Practice it together when everyone is calm.'
        }
      ]
    });

    const quiz25 = await prisma.quiz.create({
      data: {
        lessonId: lesson25.id,
        question: 'Your 3-year-old hits their sibling. What should you do FIRST?',
        correctAnswer: '',
        explanation: 'Immediately implementing the consequence (time-out) for hitting is the first priority after ensuring safety. This teaches that hitting always results in an immediate consequence. Teaching alternatives comes after the consequence.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz25.id,
          optionLabel: 'A',
          optionText: 'Explain why hitting is wrong.',
          order: 1
        },
        {
          quizId: quiz25.id,
          optionLabel: 'B',
          optionText: 'Immediately implement time-out.',
          order: 2
        },
        {
          quizId: quiz25.id,
          optionLabel: 'C',
          optionText: 'Make them apologize to their sibling.',
          order: 3
        },
        {
          quizId: quiz25.id,
          optionLabel: 'D',
          optionText: 'Give a warning that next time will be time-out.',
          order: 4
        }
      ]
    });

    const correctOption25 = await prisma.quizOption.findFirst({
      where: { quizId: quiz25.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz25.id },
      data: { correctAnswer: correctOption25.id }
    });

    console.log('✓ Created Lesson 25 (Discipline Day 10): When Your Child Hits or Bites');

    // ============================================================================
    // Day 11: Dealing with Defiance
    // ============================================================================

    const lesson26 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 11,
        title: 'Dealing with Defiance',
        subtitle: 'Responding to "No!" and Outright Refusal',
        shortDescription: 'Learn effective strategies for handling defiant behavior and outright refusal without escalating power struggles.',
        objectives: [
          'Understand why children become defiant',
          'Learn the "Choice Within Limits" strategy',
          'Stay calm during defiant episodes'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id, lesson17.id, lesson18.id, lesson19.id, lesson20.id, lesson21.id, lesson22.id, lesson23.id, lesson24.id, lesson25.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#E4E4FF',
        ellipse77Color: '#C7B3FF',
        ellipse78Color: '#9BD4DF'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson26.id,
          order: 1,
          sectionTitle: 'Why Defiance Happens',
          contentType: 'TEXT',
          bodyText: 'Defiance is a normal part of child development, especially ages 2-5. Children say "No!" because:\n\n- They\'re testing their independence\n- They want control over their world\n- They\'re frustrated and don\'t have words\n- They\'ve learned that defiance gets attention\n- They\'re tired, hungry, or overwhelmed\n\nDefiance doesn\'t mean your child is "bad" or that you\'re failing. It means they\'re developing autonomy—which is healthy. Your job is to respond calmly and consistently.'
        },
        {
          lessonId: lesson26.id,
          order: 2,
          sectionTitle: 'Choice Within Limits',
          contentType: 'TEXT',
          bodyText: 'When your child refuses a command, offer a "choice within limits":\n\nInstead of: "Put your shoes on NOW!"\nTry: "You need to put your shoes on. Do you want to put them on yourself, or should I help you?"\n\nInstead of: "Get in the car!"\nTry: "It\'s time to go. Do you want to walk to the car or should I carry you?"\n\nThis gives your child autonomy while maintaining your boundary. They feel in control of HOW, but you control WHAT happens.\n\nIf they refuse both choices, calmly follow through: "I see you\'re not choosing. I\'ll choose for you." Then do it without anger.'
        },
        {
          lessonId: lesson26.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'Today, when your child refuses a command, offer two acceptable choices instead of repeating the command. Stay calm. If they refuse both, calmly say "I\'ll choose for you" and follow through. This reduces power struggles while maintaining boundaries.'
        }
      ]
    });

    const quiz26 = await prisma.quiz.create({
      data: {
        lessonId: lesson26.id,
        question: 'Your child refuses to get dressed. What is the most effective "choice within limits" response?',
        correctAnswer: '',
        explanation: 'This offers autonomy (choosing which task first) while maintaining the boundary (both tasks must happen). It gives the child control over HOW without negotiating WHAT.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz26.id,
          optionLabel: 'A',
          optionText: 'Fine, you don\'t have to get dressed then.',
          order: 1
        },
        {
          quizId: quiz26.id,
          optionLabel: 'B',
          optionText: 'Do you want to put your shirt on first or your pants on first?',
          order: 2
        },
        {
          quizId: quiz26.id,
          optionLabel: 'C',
          optionText: 'If you don\'t get dressed right now, no TV!',
          order: 3
        },
        {
          quizId: quiz26.id,
          optionLabel: 'D',
          optionText: 'Why are you always so difficult?',
          order: 4
        }
      ]
    });

    const correctOption26 = await prisma.quizOption.findFirst({
      where: { quizId: quiz26.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz26.id },
      data: { correctAnswer: correctOption26.id }
    });

    console.log('✓ Created Lesson 26 (Discipline Day 11): Dealing with Defiance');

    // ============================================================================
    // Day 12: The Power of Routines
    // ============================================================================

    const lesson27 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 12,
        title: 'The Power of Routines',
        subtitle: 'Building Predictable Structure That Reduces Battles',
        shortDescription: 'Understand how consistent routines reduce power struggles and help children feel secure and cooperative.',
        objectives: [
          'Learn why routines reduce behavior problems',
          'Identify key routines to establish',
          'Create age-appropriate routine structures'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id, lesson17.id, lesson18.id, lesson19.id, lesson20.id, lesson21.id, lesson22.id, lesson23.id, lesson24.id, lesson25.id, lesson26.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#FFF0E4',
        ellipse77Color: '#FFD0A6',
        ellipse78Color: '#A6D0E0'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson27.id,
          order: 1,
          sectionTitle: 'Why Routines Work',
          contentType: 'TEXT',
          bodyText: 'Children thrive on predictability. When they know what comes next, they feel:\n\n- Safe and secure\n- In control (they know what to expect)\n- Less need to resist or negotiate\n- More cooperative\n\nRoutines turn daily battles into automatic sequences. Instead of arguing about bedtime every night, the routine becomes "just what we do."\n\nRoutines also reduce the number of commands you need to give. The routine becomes the authority, not you.'
        },
        {
          lessonId: lesson27.id,
          order: 2,
          sectionTitle: 'Key Routines to Establish',
          contentType: 'TEXT',
          bodyText: 'Focus on these high-conflict times:\n\n**Morning Routine:**\n1. Wake up\n2. Use bathroom\n3. Get dressed\n4. Eat breakfast\n5. Brush teeth\n6. Put shoes on\n7. Leave for school/daycare\n\n**Bedtime Routine:**\n1. Bath\n2. Pajamas\n3. Brush teeth\n4. Two books\n5. Lights out\n\n**Mealtime Routine:**\n1. Wash hands\n2. Sit at table\n3. Eat\n4. Clear plate\n\nKeep routines simple (3-7 steps) and the same every day. Consistency is key.'
        },
        {
          lessonId: lesson27.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'Choose ONE routine that causes daily battles (bedtime, morning, or mealtime). Write down 5-7 simple steps. For the next week, follow this routine in the exact same order every single day. When your child resists, remind them: "This is what we do. Bath comes after dinner."'
        }
      ]
    });

    const quiz27 = await prisma.quiz.create({
      data: {
        lessonId: lesson27.id,
        question: 'Why do routines reduce power struggles?',
        correctAnswer: '',
        explanation: 'Routines provide predictability, which helps children feel secure and in control. When they know what to expect, there\'s less to negotiate or resist. The routine becomes the authority, not the parent.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz27.id,
          optionLabel: 'A',
          optionText: 'Because children get bored and stop caring.',
          order: 1
        },
        {
          quizId: quiz27.id,
          optionLabel: 'B',
          optionText: 'Because predictability makes children feel secure and reduces resistance.',
          order: 2
        },
        {
          quizId: quiz27.id,
          optionLabel: 'C',
          optionText: 'Because parents give up and routines are easier.',
          order: 3
        },
        {
          quizId: quiz27.id,
          optionLabel: 'D',
          optionText: 'Routines don\'t actually reduce power struggles.',
          order: 4
        }
      ]
    });

    const correctOption27 = await prisma.quizOption.findFirst({
      where: { quizId: quiz27.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz27.id },
      data: { correctAnswer: correctOption27.id }
    });

    console.log('✓ Created Lesson 27 (Discipline Day 12): The Power of Routines');

    // ============================================================================
    // Day 13: Visual Schedules for Success
    // ============================================================================

    const lesson28 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 13,
        title: 'Visual Schedules for Success',
        subtitle: 'Using Pictures to Support Transitions and Routines',
        shortDescription: 'Learn how to create and use visual schedules to help children follow routines independently.',
        objectives: [
          'Understand the power of visual supports',
          'Create simple visual schedules',
          'Use visuals to reduce nagging'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id, lesson17.id, lesson18.id, lesson19.id, lesson20.id, lesson21.id, lesson22.id, lesson23.id, lesson24.id, lesson25.id, lesson26.id, lesson27.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#E4E4FF',
        ellipse77Color: '#C7B3FF',
        ellipse78Color: '#9BD4DF'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson28.id,
          order: 1,
          sectionTitle: 'Why Visual Schedules Work',
          contentType: 'TEXT',
          bodyText: 'Visual schedules show children what comes next using pictures or symbols. They work because:\n\n- Young children are visual learners\n- Pictures don\'t require reading\n- Seeing the sequence reduces anxiety\n- The schedule becomes the "boss," not you\n- Children can check progress independently\n\nInstead of saying "Get dressed!" 10 times, you can point to the schedule: "Look, getting dressed is next!"\n\nThis reduces nagging and gives children ownership of the routine.'
        },
        {
          lessonId: lesson28.id,
          order: 2,
          sectionTitle: 'Creating a Visual Schedule',
          contentType: 'TEXT',
          bodyText: 'Simple steps to create one:\n\n1. **Choose the routine**: Morning, bedtime, or after-school\n2. **Break it into 5-7 steps**\n3. **Find or draw simple pictures**: Print clip art, take photos, or draw stick figures\n4. **Put them in order**: Use a poster board, wall chart, or laminated cards\n5. **Add checkboxes or velcro**: Let your child mark each step as complete\n\nExample morning schedule:\n[Picture of toilet] → [Picture of clothes] → [Picture of breakfast] → [Picture of toothbrush] → [Picture of shoes]\n\nReview the schedule with your child when everyone is calm, not during a power struggle.'
        },
        {
          lessonId: lesson28.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'This week, create a simple visual schedule for ONE routine (morning or bedtime). Use 5-7 pictures in order. Show it to your child and practice using it together. When they resist a step, point to the schedule: "Look! Brushing teeth comes after pajamas."'
        }
      ]
    });

    const quiz28 = await prisma.quiz.create({
      data: {
        lessonId: lesson28.id,
        question: 'What is the main benefit of using visual schedules with young children?',
        correctAnswer: '',
        explanation: 'Visual schedules transfer authority from the parent to the routine itself. Instead of the parent nagging, the schedule shows what comes next, reducing power struggles and helping children follow routines more independently.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz28.id,
          optionLabel: 'A',
          optionText: 'They look nice on the wall.',
          order: 1
        },
        {
          quizId: quiz28.id,
          optionLabel: 'B',
          optionText: 'The schedule becomes the authority, reducing nagging and power struggles.',
          order: 2
        },
        {
          quizId: quiz28.id,
          optionLabel: 'C',
          optionText: 'Children learn to read faster.',
          order: 3
        },
        {
          quizId: quiz28.id,
          optionLabel: 'D',
          optionText: 'Parents don\'t have to be involved in routines anymore.',
          order: 4
        }
      ]
    });

    const correctOption28 = await prisma.quizOption.findFirst({
      where: { quizId: quiz28.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz28.id },
      data: { correctAnswer: correctOption28.id }
    });

    console.log('✓ Created Lesson 28 (Discipline Day 13): Visual Schedules for Success');

    // ============================================================================
    // Day 14: Bedtime Without Battles
    // ============================================================================

    const lesson29 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 14,
        title: 'Bedtime Without Battles',
        subtitle: 'Creating a Sleep Routine That Works',
        shortDescription: 'Learn strategies for smooth bedtimes through consistent routines, boundaries, and calm follow-through.',
        objectives: [
          'Establish a consistent bedtime routine',
          'Handle bedtime stalling and resistance',
          'Use the "Silent Return" technique for repeated exits'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id, lesson17.id, lesson18.id, lesson19.id, lesson20.id, lesson21.id, lesson22.id, lesson23.id, lesson24.id, lesson25.id, lesson26.id, lesson27.id, lesson28.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#FFF0E4',
        ellipse77Color: '#FFD0A6',
        ellipse78Color: '#A6D0E0'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson29.id,
          order: 1,
          sectionTitle: 'Why Bedtime is Hard',
          contentType: 'TEXT',
          bodyText: 'Bedtime is one of the biggest battlegrounds because:\n\n- Children don\'t want to miss out on fun\n- They\'re overtired and dysregulated\n- It\'s easy to stall ("I need water!" "One more story!")\n- Parents are exhausted and give in\n- There\'s no consistent routine\n\nThe solution? A predictable routine with firm, calm boundaries.'
        },
        {
          lessonId: lesson29.id,
          order: 2,
          sectionTitle: 'The Bedtime Routine + Silent Return',
          contentType: 'TEXT',
          bodyText: '**Step 1: Create a 5-7 Step Routine**\n1. Bath\n2. Pajamas\n3. Brush teeth\n4. Two books\n5. Tuck in\n6. Lights out\n7. Leave room\n\n**Step 2: Handle Stalling**\n"I need water!" → "You already had water. It\'s time for sleep."\n"One more book!" → "We read two books. That\'s the rule."\n\nStay calm. Don\'t negotiate.\n\n**Step 3: Silent Return**\nIf your child gets out of bed:\n- Say ONCE: "It\'s bedtime. Stay in bed."\n- Every time after: silently walk them back to bed\n- No talking, no eye contact, no emotion\n- Repeat as many times as needed\n\nThis usually takes 20-30 returns the first night, then drops dramatically.'
        },
        {
          lessonId: lesson29.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'Tonight, implement a simple bedtime routine and stick to it. If your child gets out of bed, use Silent Return: walk them back calmly without talking. Be prepared to do this many times the first night. Consistency will pay off quickly.'
        }
      ]
    });

    const quiz29 = await prisma.quiz.create({
      data: {
        lessonId: lesson29.id,
        question: 'Your child gets out of bed for the 5th time saying "I need another hug." What should you do?',
        correctAnswer: '',
        explanation: 'After the first reminder, Silent Return is most effective. Silently walking them back to bed without talking or engaging teaches that getting up doesn\'t result in attention or negotiation.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz29.id,
          optionLabel: 'A',
          optionText: 'Give them a hug and let them stay up 10 more minutes.',
          order: 1
        },
        {
          quizId: quiz29.id,
          optionLabel: 'B',
          optionText: 'Silently walk them back to bed without talking.',
          order: 2
        },
        {
          quizId: quiz29.id,
          optionLabel: 'C',
          optionText: 'Yell at them to stay in bed.',
          order: 3
        },
        {
          quizId: quiz29.id,
          optionLabel: 'D',
          optionText: 'Explain why they need sleep for the 5th time.',
          order: 4
        }
      ]
    });

    const correctOption29 = await prisma.quizOption.findFirst({
      where: { quizId: quiz29.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz29.id },
      data: { correctAnswer: correctOption29.id }
    });

    console.log('✓ Created Lesson 29 (Discipline Day 14): Bedtime Without Battles');

    // ============================================================================
    // Day 15: Morning Routines That Work
    // ============================================================================

    const lesson30 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 15,
        title: 'Morning Routines That Work',
        subtitle: 'Starting the Day Smoothly and Stress-Free',
        shortDescription: 'Create morning routines that prevent rushing, arguing, and chaos before school or daycare.',
        objectives: [
          'Design an effective morning routine',
          'Use When/Then to motivate morning tasks',
          'Handle morning resistance calmly'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id, lesson17.id, lesson18.id, lesson19.id, lesson20.id, lesson21.id, lesson22.id, lesson23.id, lesson24.id, lesson25.id, lesson26.id, lesson27.id, lesson28.id, lesson29.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#E4E4FF',
        ellipse77Color: '#C7B3FF',
        ellipse78Color: '#9BD4DF'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson30.id,
          order: 1,
          sectionTitle: 'Why Mornings Are Chaotic',
          contentType: 'TEXT',
          bodyText: 'Morning chaos happens because:\n\n- Everyone is rushed and stressed\n- Children are slow to wake up\n- There\'s no clear sequence\n- Parents are doing everything (nagging, reminding, doing tasks for them)\n- Consequences feel impossible (you can\'t be late!)\n\nThe key: Start the routine earlier and transfer responsibility to your child.'
        },
        {
          lessonId: lesson30.id,
          order: 2,
          sectionTitle: 'The Morning Routine Formula',
          contentType: 'TEXT',
          bodyText: '**Step 1: Create a Simple Sequence**\n1. Wake up\n2. Use bathroom\n3. Get dressed\n4. Eat breakfast\n5. Brush teeth\n6. Put shoes on\n7. Get backpack\n\n**Step 2: Use When/Then**\n"When you\'re dressed, then you can have breakfast."\n"When you have your shoes on, then we can watch one show before we leave."\n\n**Step 3: Natural Consequences**\nIf they\'re not ready:\n- They go to school in pajamas (bring clothes in a bag)\n- They miss breakfast (bring a snack for later)\n- They miss screen time\n\nDon\'t rescue them. Let reality teach.'
        },
        {
          lessonId: lesson30.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'Tomorrow morning, wake your child 15 minutes earlier. Use a visual schedule and When/Then statements. If they\'re not ready on time, follow through with a natural consequence calmly. Don\'t nag or do tasks for them.'
        }
      ]
    });

    const quiz30 = await prisma.quiz.create({
      data: {
        lessonId: lesson30.id,
        question: 'Your child refuses to get dressed and you need to leave in 5 minutes. What should you do?',
        correctAnswer: '',
        explanation: 'Natural consequences teach responsibility. Bringing clothes and letting them get dressed at school (or in the car) teaches that morning tasks are their responsibility, not yours to nag about.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz30.id,
          optionLabel: 'A',
          optionText: 'Force them into clothes while they scream.',
          order: 1
        },
        {
          quizId: quiz30.id,
          optionLabel: 'B',
          optionText: 'Calmly say "We\'re leaving now. You can get dressed at school" and bring the clothes.',
          order: 2
        },
        {
          quizId: quiz30.id,
          optionLabel: 'C',
          optionText: 'Let them stay home from school.',
          order: 3
        },
        {
          quizId: quiz30.id,
          optionLabel: 'D',
          optionText: 'Yell at them about being irresponsible.',
          order: 4
        }
      ]
    });

    const correctOption30 = await prisma.quizOption.findFirst({
      where: { quizId: quiz30.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz30.id },
      data: { correctAnswer: correctOption30.id }
    });

    console.log('✓ Created Lesson 30 (Discipline Day 15): Morning Routines That Work');

    // ============================================================================
    // Day 16: Managing Screen Time
    // ============================================================================

    const lesson31 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 16,
        title: 'Managing Screen Time',
        subtitle: 'Setting Healthy Boundaries Around Devices',
        shortDescription: 'Learn how to set and enforce screen time limits without constant battles and meltdowns.',
        objectives: [
          'Establish clear screen time rules',
          'Use timers and When/Then for screens',
          'Handle screen time tantrums effectively'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id, lesson17.id, lesson18.id, lesson19.id, lesson20.id, lesson21.id, lesson22.id, lesson23.id, lesson24.id, lesson25.id, lesson26.id, lesson27.id, lesson28.id, lesson29.id, lesson30.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#FFF0E4',
        ellipse77Color: '#FFD0A6',
        ellipse78Color: '#A6D0E0'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson31.id,
          order: 1,
          sectionTitle: 'Why Screen Time is Hard to Manage',
          contentType: 'TEXT',
          bodyText: 'Screen time battles happen because:\n\n- Screens are highly rewarding (dopamine hits)\n- Children don\'t have internal "stop" signals\n- Transitions away from screens are hard\n- Parents feel guilty and give in\n- Rules are inconsistent\n\nThe solution: Clear rules, timers, and calm follow-through.'
        },
        {
          lessonId: lesson31.id,
          order: 2,
          sectionTitle: 'The Screen Time System',
          contentType: 'TEXT',
          bodyText: '**Step 1: Set Clear Limits**\nDecide on daily limits (e.g., 30 minutes after homework, 1 hour on weekends).\n\n**Step 2: Use When/Then**\n"When you finish your chores, then you can have 30 minutes of screen time."\n\n**Step 3: Use Visual Timers**\nSet a timer your child can see. Give a 5-minute warning.\n"The timer is going off in 5 minutes. Then screens go away."\n\n**Step 4: Follow Through**\nWhen the timer goes off:\n"Timer\'s done. Hand me the tablet."\nIf they refuse: "You have two choices: hand it to me, or I take it and you lose screen time tomorrow."\n\n**Step 5: Handle the Meltdown**\nThey WILL tantrum at first. Stay calm. Don\'t give in. After 3-4 days of consistency, tantrums will decrease.'
        },
        {
          lessonId: lesson31.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'Today, set a clear screen time limit and use a visible timer. Give a 5-minute warning. When the timer goes off, calmly take the device. If your child melts down, stay calm and consistent. Don\'t lecture or negotiate.'
        }
      ]
    });

    const quiz31 = await prisma.quiz.create({
      data: {
        lessonId: lesson31.id,
        question: 'The timer goes off, but your child refuses to hand over the tablet and starts crying. What should you do?',
        correctAnswer: '',
        explanation: 'Offering a choice within limits maintains your boundary (screen time is over) while giving the child some control. If they still refuse, calmly follow through with the consequence.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz31.id,
          optionLabel: 'A',
          optionText: 'Let them have 5 more minutes to avoid the meltdown.',
          order: 1
        },
        {
          quizId: quiz31.id,
          optionLabel: 'B',
          optionText: 'Calmly say "You can hand it to me, or I\'ll take it and no screens tomorrow."',
          order: 2
        },
        {
          quizId: quiz31.id,
          optionLabel: 'C',
          optionText: 'Take the tablet away and throw it in the trash.',
          order: 3
        },
        {
          quizId: quiz31.id,
          optionLabel: 'D',
          optionText: 'Lecture them about why too much screen time is bad.',
          order: 4
        }
      ]
    });

    const correctOption31 = await prisma.quizOption.findFirst({
      where: { quizId: quiz31.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz31.id },
      data: { correctAnswer: correctOption31.id }
    });

    console.log('✓ Created Lesson 31 (Discipline Day 16): Managing Screen Time');

    // ============================================================================
    // Day 17: Sibling Conflict Resolution
    // ============================================================================

    const lesson32 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 17,
        title: 'Sibling Conflict Resolution',
        subtitle: 'Teaching Kids to Solve Problems Together',
        shortDescription: 'Learn when to intervene in sibling conflicts and how to teach children problem-solving skills.',
        objectives: [
          'Know when to intervene vs. let them work it out',
          'Teach the "Talk it Out" framework',
          'Handle aggressive sibling behavior'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id, lesson17.id, lesson18.id, lesson19.id, lesson20.id, lesson21.id, lesson22.id, lesson23.id, lesson24.id, lesson25.id, lesson26.id, lesson27.id, lesson28.id, lesson29.id, lesson30.id, lesson31.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#E4E4FF',
        ellipse77Color: '#C7B3FF',
        ellipse78Color: '#9BD4DF'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson32.id,
          order: 1,
          sectionTitle: 'When to Intervene',
          contentType: 'TEXT',
          bodyText: 'Sibling conflicts are normal and even healthy. They teach negotiation, compromise, and emotional regulation.\n\n**Let them work it out when:**\n- Both children are verbal and not aggressive\n- It\'s about sharing, taking turns, or minor disagreements\n- No one is in danger\n\n**Intervene immediately when:**\n- Physical aggression (hitting, biting, pushing)\n- One child is much younger/smaller\n- Name-calling or cruel words\n- One child is crying or very upset\n\nRule of thumb: If it\'s just noise and arguing, stay out. If someone might get hurt emotionally or physically, step in.'
        },
        {
          lessonId: lesson32.id,
          order: 2,
          sectionTitle: 'The "Talk It Out" Framework',
          contentType: 'TEXT',
          bodyText: 'When you need to intervene:\n\n**Step 1: Stop the conflict**\n"Stop. We don\'t hit/grab/yell at each other."\n\n**Step 2: Separate if needed**\n"Both of you, take a breath. Sit here and here."\n\n**Step 3: Teach Talk It Out**\n"Each of you gets to say how you feel without being interrupted."\n"Maya, tell Jack how you feel. Jack, just listen."\n"Jack, now you tell Maya how you feel. Maya, listen."\n"Now, what\'s one solution you both can agree on?"\n\n**Step 4: Support the solution**\n"You decided to take turns. Great problem-solving!"\n\nDon\'t solve it for them. Guide them to find their own solution.'
        },
        {
          lessonId: lesson32.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'Next time your children fight over a toy, use Talk It Out. Have each child say how they feel, then ask "What\'s a solution you both agree on?" Guide but don\'t solve it for them. Praise their problem-solving when they find a solution.'
        }
      ]
    });

    const quiz32 = await prisma.quiz.create({
      data: {
        lessonId: lesson32.id,
        question: 'Your two children are arguing loudly about whose turn it is with a toy. What should you do?',
        correctAnswer: '',
        explanation: 'Non-violent conflicts are opportunities for children to learn negotiation and problem-solving. Only intervene if there\'s aggression or if they explicitly ask for help.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz32.id,
          optionLabel: 'A',
          optionText: 'Immediately take the toy away from both of them.',
          order: 1
        },
        {
          quizId: quiz32.id,
          optionLabel: 'B',
          optionText: 'Let them work it out unless it becomes aggressive.',
          order: 2
        },
        {
          quizId: quiz32.id,
          optionLabel: 'C',
          optionText: 'Decide whose turn it is and enforce your decision.',
          order: 3
        },
        {
          quizId: quiz32.id,
          optionLabel: 'D',
          optionText: 'Send both children to time-out for arguing.',
          order: 4
        }
      ]
    });

    const correctOption32 = await prisma.quizOption.findFirst({
      where: { quizId: quiz32.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz32.id },
      data: { correctAnswer: correctOption32.id }
    });

    console.log('✓ Created Lesson 32 (Discipline Day 17): Sibling Conflict Resolution');

    // ============================================================================
    // Day 18: Teaching Emotional Regulation
    // ============================================================================

    const lesson33 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 18,
        title: 'Teaching Emotional Regulation',
        subtitle: 'Helping Kids Manage Big Feelings',
        shortDescription: 'Learn how to coach children through big emotions and teach them self-regulation skills.',
        objectives: [
          'Name emotions to help children identify feelings',
          'Teach coping strategies for big emotions',
          'Model healthy emotional regulation'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id, lesson17.id, lesson18.id, lesson19.id, lesson20.id, lesson21.id, lesson22.id, lesson23.id, lesson24.id, lesson25.id, lesson26.id, lesson27.id, lesson28.id, lesson29.id, lesson30.id, lesson31.id, lesson32.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#FFF0E4',
        ellipse77Color: '#FFD0A6',
        ellipse78Color: '#A6D0E0'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson33.id,
          order: 1,
          sectionTitle: 'Why Kids Can\'t "Just Calm Down"',
          contentType: 'TEXT',
          bodyText: 'Young children\'s brains are still developing. The part that manages emotions (prefrontal cortex) won\'t be fully developed until their mid-20s.\n\nWhen you say "Calm down!" to a dysregulated child, they literally cannot. Their thinking brain is offline.\n\nYour job: Co-regulate first (help them calm down), then teach regulation skills.'
        },
        {
          lessonId: lesson33.id,
          order: 2,
          sectionTitle: 'Emotion Coaching Strategy',
          contentType: 'TEXT',
          bodyText: '**Step 1: Name the Emotion**\n"You\'re feeling really angry right now." (This activates the thinking brain)\n\n**Step 2: Validate**\n"It\'s okay to feel angry. Everyone feels angry sometimes."\n\n**Step 3: Set Boundaries**\n"You can be angry, but you can\'t hit. Hitting hurts."\n\n**Step 4: Offer Coping Strategies**\n"Let\'s try some deep breaths together. Or do you want to stomp your feet?"\n\nExample:\n"You\'re feeling frustrated that we have to leave the park. That makes sense—the park is fun! You can be upset, but we still need to go. Do you want to walk to the car, or should I carry you?"'
        },
        {
          lessonId: lesson33.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'Today, when your child has a big emotion, name it out loud: "You seem really frustrated." Validate the feeling, then offer two coping choices: "Do you want to take deep breaths with me, or do you want to squeeze this pillow really hard?"'
        }
      ]
    });

    const quiz33 = await prisma.quiz.create({
      data: {
        lessonId: lesson33.id,
        question: 'Your child is crying and screaming because they can\'t have a cookie before dinner. What\'s the best first response?',
        correctAnswer: '',
        explanation: 'Naming and validating the emotion helps activate the child\'s thinking brain and shows them you understand. This is the first step in co-regulation before teaching coping strategies.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz33.id,
          optionLabel: 'A',
          optionText: 'Yell "Stop crying or you\'ll get a time-out!"',
          order: 1
        },
        {
          quizId: quiz33.id,
          optionLabel: 'B',
          optionText: 'Calmly name the emotion: "You\'re really disappointed you can\'t have a cookie right now."',
          order: 2
        },
        {
          quizId: quiz33.id,
          optionLabel: 'C',
          optionText: 'Give them the cookie to stop the crying.',
          order: 3
        },
        {
          quizId: quiz33.id,
          optionLabel: 'D',
          optionText: 'Ignore them completely until they stop.',
          order: 4
        }
      ]
    });

    const correctOption33 = await prisma.quizOption.findFirst({
      where: { quizId: quiz33.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz33.id },
      data: { correctAnswer: correctOption33.id }
    });

    console.log('✓ Created Lesson 33 (Discipline Day 18): Teaching Emotional Regulation');

    // ============================================================================
    // Day 19: The Calm-Down Corner
    // ============================================================================

    const lesson34 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 19,
        title: 'The Calm-Down Corner',
        subtitle: 'Creating a Safe Space for Regulation',
        shortDescription: 'Learn how to set up and use a calm-down corner as a tool for emotional regulation, not punishment.',
        objectives: [
          'Understand the difference between time-out and calm-down corner',
          'Create an effective calm-down space',
          'Teach children to use it independently'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id, lesson17.id, lesson18.id, lesson19.id, lesson20.id, lesson21.id, lesson22.id, lesson23.id, lesson24.id, lesson25.id, lesson26.id, lesson27.id, lesson28.id, lesson29.id, lesson30.id, lesson31.id, lesson32.id, lesson33.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#E4E4FF',
        ellipse77Color: '#C7B3FF',
        ellipse78Color: '#9BD4DF'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson34.id,
          order: 1,
          sectionTitle: 'Time-Out vs. Calm-Down Corner',
          contentType: 'TEXT',
          bodyText: '**Time-Out** (consequence):\n- For breaking rules (hitting, not following commands)\n- Boring spot\n- Timed (1 minute per year of age)\n- Child must stay until timer ends\n\n**Calm-Down Corner** (regulation tool):\n- For big emotions that aren\'t breaking rules\n- Cozy, inviting space\n- Not timed—child returns when calm\n- Child can choose to go there\n\nThink of it as: Time-out is a consequence. Calm-down corner is a tool.'
        },
        {
          lessonId: lesson34.id,
          order: 2,
          sectionTitle: 'Setting Up a Calm-Down Corner',
          contentType: 'TEXT',
          bodyText: 'Create a cozy space with:\n- **Soft items**: Pillows, stuffed animals, blankets\n- **Sensory tools**: Stress ball, fidget toy, glitter jar\n- **Breathing visual**: Picture of deep breathing, bubble wand\n- **Books about feelings**: Simple emotion books\n\nIntroduce it when everyone is calm:\n"This is our calm-down corner. When you have big feelings, you can come here to feel better. Let\'s try it together!"\n\nPractice using it during calm times so it\'s familiar during meltdowns.'
        },
        {
          lessonId: lesson34.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'This week, create a simple calm-down corner with 3-4 items. Show your child when everyone is calm. Practice going there together: "Let\'s both take some deep breaths in the calm-down corner." Make it a positive, safe space, not a punishment spot.'
        }
      ]
    });

    const quiz34 = await prisma.quiz.create({
      data: {
        lessonId: lesson34.id,
        question: 'When should you use a calm-down corner instead of time-out?',
        correctAnswer: '',
        explanation: 'Calm-down corners are for helping children regulate big emotions that aren\'t breaking rules. Time-out is for consequences after rule-breaking. The calm-down corner is a support tool, not a punishment.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz34.id,
          optionLabel: 'A',
          optionText: 'When your child hits their sibling.',
          order: 1
        },
        {
          quizId: quiz34.id,
          optionLabel: 'B',
          optionText: 'When your child is having a meltdown but hasn\'t broken any rules.',
          order: 2
        },
        {
          quizId: quiz34.id,
          optionLabel: 'C',
          optionText: 'When your child refuses a command.',
          order: 3
        },
        {
          quizId: quiz34.id,
          optionLabel: 'D',
          optionText: 'They\'re the same thing.',
          order: 4
        }
      ]
    });

    const correctOption34 = await prisma.quizOption.findFirst({
      where: { quizId: quiz34.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz34.id },
      data: { correctAnswer: correctOption34.id }
    });

    console.log('✓ Created Lesson 34 (Discipline Day 19): The Calm-Down Corner');

    // ============================================================================
    // Day 20: Repair After Conflict
    // ============================================================================

    const lesson35 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 20,
        title: 'Repair After Conflict',
        subtitle: 'Reconnecting After Hard Moments',
        shortDescription: 'Learn how to rebuild connection with your child after discipline, conflicts, or emotional moments.',
        objectives: [
          'Understand the importance of repair',
          'Learn the repair conversation framework',
          'Rebuild trust after consequences'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id, lesson17.id, lesson18.id, lesson19.id, lesson20.id, lesson21.id, lesson22.id, lesson23.id, lesson24.id, lesson25.id, lesson26.id, lesson27.id, lesson28.id, lesson29.id, lesson30.id, lesson31.id, lesson32.id, lesson33.id, lesson34.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#FFF0E4',
        ellipse77Color: '#FFD0A6',
        ellipse78Color: '#A6D0E0'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson35.id,
          order: 1,
          sectionTitle: 'Why Repair Matters',
          contentType: 'TEXT',
          bodyText: 'After a timeout, consequence, or big conflict, the relationship can feel strained. Your child might feel:\n\n- Ashamed or embarrassed\n- Worried you\'re still mad\n- Disconnected from you\n- Uncertain about your love\n\nRepair rebuilds the connection. It shows your child: "I still love you, even when you make mistakes. We\'re okay."\n\nWithout repair, children can internalize shame and feel unloved.'
        },
        {
          lessonId: lesson35.id,
          order: 2,
          sectionTitle: 'The Repair Conversation',
          contentType: 'TEXT',
          bodyText: 'Wait until everyone is calm (15-30 minutes after the incident), then:\n\n**Step 1: Reconnect**\n"Come here, let\'s talk." (warm tone, open body language)\n\n**Step 2: Empathize**\n"That was really hard for both of us, wasn\'t it?"\n\n**Step 3: Review what happened**\n"You hit your brother, so you had to go to timeout. That\'s the rule."\n\n**Step 4: Teach the lesson**\n"Next time you\'re angry at him, what could you do instead?"\n\n**Step 5: Affirm love**\n"I love you no matter what. We all make mistakes. Let\'s try again."\n\n**Step 6: Offer physical connection**\n"Do you want a hug?"\n\nThis takes 2-3 minutes but makes a huge difference.'
        },
        {
          lessonId: lesson35.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'After the next consequence or conflict, wait until everyone is calm, then initiate repair. Use the 6-step framework. End with physical connection (hug, high-five, or just sitting close). Notice how your child\'s demeanor shifts.'
        }
      ]
    });

    const quiz35 = await prisma.quiz.create({
      data: {
        lessonId: lesson35.id,
        question: 'When is the best time to have a repair conversation after a timeout?',
        correctAnswer: '',
        explanation: 'Both parent and child need time to regulate before repair can be effective. Waiting 15-30 minutes ensures everyone is calm and able to connect meaningfully.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz35.id,
          optionLabel: 'A',
          optionText: 'Immediately after the timeout ends.',
          order: 1
        },
        {
          quizId: quiz35.id,
          optionLabel: 'B',
          optionText: 'After everyone has calmed down, about 15-30 minutes later.',
          order: 2
        },
        {
          quizId: quiz35.id,
          optionLabel: 'C',
          optionText: 'The next day.',
          order: 3
        },
        {
          quizId: quiz35.id,
          optionLabel: 'D',
          optionText: 'Never - just move on.',
          order: 4
        }
      ]
    });

    const correctOption35 = await prisma.quizOption.findFirst({
      where: { quizId: quiz35.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz35.id },
      data: { correctAnswer: correctOption35.id }
    });

    console.log('✓ Created Lesson 35 (Discipline Day 20): Repair After Conflict');

    // ============================================================================
    // Day 21: When You Lose Your Cool
    // ============================================================================

    const lesson36 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 21,
        title: 'When You Lose Your Cool',
        subtitle: 'Modeling Repair and Apology',
        shortDescription: 'Learn how to repair with your child when you yell, overreact, or lose your temper.',
        objectives: [
          'Understand that parent mistakes are teaching moments',
          'Learn to apologize authentically to children',
          'Model accountability and repair'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id, lesson17.id, lesson18.id, lesson19.id, lesson20.id, lesson21.id, lesson22.id, lesson23.id, lesson24.id, lesson25.id, lesson26.id, lesson27.id, lesson28.id, lesson29.id, lesson30.id, lesson31.id, lesson32.id, lesson33.id, lesson34.id, lesson35.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#E4E4FF',
        ellipse77Color: '#C7B3FF',
        ellipse78Color: '#9BD4DF'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson36.id,
          order: 1,
          sectionTitle: 'You Will Lose Your Cool',
          contentType: 'TEXT',
          bodyText: 'You are human. You will yell. You will overreact. You will lose your patience.\n\nThis doesn\'t make you a bad parent. What matters is what you do AFTER.\n\nWhen you repair with your child after losing your cool, you teach them:\n- Everyone makes mistakes\n- Apologies are powerful\n- Relationships can be repaired\n- It\'s safe to be imperfect\n\nYour repair is actually MORE valuable than never making mistakes.'
        },
        {
          lessonId: lesson36.id,
          order: 2,
          sectionTitle: 'How to Apologize to Your Child',
          contentType: 'TEXT',
          bodyText: 'When you\'ve yelled or overreacted:\n\n**Step 1: Calm yourself first**\nTake 5-10 minutes to regulate.\n\n**Step 2: Approach your child**\n"Can I talk to you for a minute?"\n\n**Step 3: Take ownership**\n"I yelled at you, and that was wrong. My job is to stay calm, and I didn\'t do that."\n\n**Step 4: Apologize without excuses**\n"I\'m sorry I yelled. You didn\'t deserve that." (Don\'t say "but you were driving me crazy")\n\n**Step 5: Commit to doing better**\n"Next time I feel that frustrated, I\'m going to take a breath before I talk to you."\n\n**Step 6: Ask for forgiveness**\n"Will you forgive me?"\n\n**Step 7: Reconnect**\nHug, play together, or just sit close.'
        },
        {
          lessonId: lesson36.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'Next time you lose your cool with your child, use this as a teaching moment. Once you\'re calm, apologize using the 7-step framework. Model taking responsibility without excuses. This teaches them more about relationships than perfection ever could.'
        }
      ]
    });

    const quiz36 = await prisma.quiz.create({
      data: {
        lessonId: lesson36.id,
        question: 'You yelled at your child this morning. What should you say when you apologize?',
        correctAnswer: '',
        explanation: 'A good apology takes full ownership without excuses or blaming the child. This models accountability and teaches children how to apologize authentically.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz36.id,
          optionLabel: 'A',
          optionText: '"I\'m sorry I yelled, but you weren\'t listening."',
          order: 1
        },
        {
          quizId: quiz36.id,
          optionLabel: 'B',
          optionText: '"I\'m sorry I yelled. That was wrong. You didn\'t deserve that."',
          order: 2
        },
        {
          quizId: quiz36.id,
          optionLabel: 'C',
          optionText: '"I\'m sorry, but you really pushed my buttons."',
          order: 3
        },
        {
          quizId: quiz36.id,
          optionLabel: 'D',
          optionText: 'Don\'t apologize - it undermines your authority.',
          order: 4
        }
      ]
    });

    const correctOption36 = await prisma.quizOption.findFirst({
      where: { quizId: quiz36.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz36.id },
      data: { correctAnswer: correctOption36.id }
    });

    console.log('✓ Created Lesson 36 (Discipline Day 21): When You Lose Your Cool');

    // ============================================================================
    // Day 22: Managing Your Own Triggers
    // ============================================================================

    const lesson37 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 22,
        title: 'Managing Your Own Triggers',
        subtitle: 'Parent Self-Regulation',
        shortDescription: 'Learn to identify your triggers and develop strategies to stay calm during challenging moments.',
        objectives: [
          'Identify your specific parenting triggers',
          'Learn self-regulation strategies',
          'Create a personal calm-down plan'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id, lesson17.id, lesson18.id, lesson19.id, lesson20.id, lesson21.id, lesson22.id, lesson23.id, lesson24.id, lesson25.id, lesson26.id, lesson27.id, lesson28.id, lesson29.id, lesson30.id, lesson31.id, lesson32.id, lesson33.id, lesson34.id, lesson35.id, lesson36.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#FFF0E4',
        ellipse77Color: '#FFD0A6',
        ellipse78Color: '#A6D0E0'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson37.id,
          order: 1,
          sectionTitle: 'Know Your Triggers',
          contentType: 'TEXT',
          bodyText: 'Everyone has parenting triggers - situations that make you go from 0 to 100:\n\n- Whining\n- Defiance ("No!")\n- Sibling fighting\n- Being ignored\n- Messes\n- Running late\n- Repeating yourself\n\nYour triggers often connect to your own childhood, stress level, or unmet needs.\n\nIdentifying your triggers is the first step to managing them.'
        },
        {
          lessonId: lesson37.id,
          order: 2,
          sectionTitle: 'Your Calm-Down Plan',
          contentType: 'TEXT',
          bodyText: 'When you feel triggered:\n\n**In the moment:**\n1. **Pause**: Count to 5 before responding\n2. **Breathe**: Three deep breaths\n3. **Name it**: "I\'m feeling really frustrated right now"\n4. **Create space**: "I need a minute. I\'ll be right back."\n5. **Ground yourself**: Splash cold water on face, step outside, stretch\n\n**Preventive strategies:**\n- Get enough sleep (even 30 minutes more helps)\n- Eat regular meals\n- Take 5-minute breaks throughout the day\n- Ask for help when you\'re overwhelmed\n- Lower your expectations on hard days\n\nYou can\'t regulate your child when you\'re dysregulated. Take care of yourself.'
        },
        {
          lessonId: lesson37.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'Identify your top 3 triggers. Write them down. Next to each, write one self-regulation strategy you\'ll use. When you feel triggered this week, pause, take 3 deep breaths, and use your strategy before responding.'
        }
      ]
    });

    const quiz37 = await prisma.quiz.create({
      data: {
        lessonId: lesson37.id,
        question: 'You feel yourself getting extremely frustrated with your child. What should you do FIRST?',
        correctAnswer: '',
        explanation: 'Pausing and taking deep breaths activates your parasympathetic nervous system, helping you calm down so you can respond thoughtfully instead of react impulsively.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz37.id,
          optionLabel: 'A',
          optionText: 'Immediately give them a consequence.',
          order: 1
        },
        {
          quizId: quiz37.id,
          optionLabel: 'B',
          optionText: 'Pause, take three deep breaths, and calm yourself.',
          order: 2
        },
        {
          quizId: quiz37.id,
          optionLabel: 'C',
          optionText: 'Yell to release the frustration.',
          order: 3
        },
        {
          quizId: quiz37.id,
          optionLabel: 'D',
          optionText: 'Ignore your feelings and push through.',
          order: 4
        }
      ]
    });

    const correctOption37 = await prisma.quizOption.findFirst({
      where: { quizId: quiz37.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz37.id },
      data: { correctAnswer: correctOption37.id }
    });

    console.log('✓ Created Lesson 37 (Discipline Day 22): Managing Your Own Triggers');

    // ============================================================================
    // Day 23: Co-Parenting Consistency
    // ============================================================================

    const lesson38 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 23,
        title: 'Co-Parenting Consistency',
        subtitle: 'Getting on the Same Page with Your Partner',
        shortDescription: 'Learn strategies for aligning with your co-parent on rules, consequences, and parenting approaches.',
        objectives: [
          'Understand why co-parent consistency matters',
          'Have productive parenting conversations',
          'Handle disagreements without undermining each other'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id, lesson17.id, lesson18.id, lesson19.id, lesson20.id, lesson21.id, lesson22.id, lesson23.id, lesson24.id, lesson25.id, lesson26.id, lesson27.id, lesson28.id, lesson29.id, lesson30.id, lesson31.id, lesson32.id, lesson33.id, lesson34.id, lesson35.id, lesson36.id, lesson37.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#E4E4FF',
        ellipse77Color: '#C7B3FF',
        ellipse78Color: '#9BD4DF'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson38.id,
          order: 1,
          sectionTitle: 'Why Consistency Between Parents Matters',
          contentType: 'TEXT',
          bodyText: 'When parents aren\'t aligned, children:\n\n- Learn to play parents against each other\n- Get confused about rules\n- Push boundaries more\n- Feel less secure\n\nExample: If Mom says no screen time before homework, but Dad allows it, the rule becomes meaningless.\n\nYou don\'t have to parent identically, but you need agreement on:\n- Core rules (safety, respect, routines)\n- Consequences for breaking rules\n- How to handle major behaviors (aggression, defiance)\n\nMinor differences are okay. Major contradictions undermine both of you.'
        },
        {
          lessonId: lesson38.id,
          order: 2,
          sectionTitle: 'Getting Aligned',
          contentType: 'TEXT',
          bodyText: '**Have a parenting meeting (without kids present):**\n\n1. **List your top 5 non-negotiable rules**\n   (e.g., no hitting, bedtime at 8pm, finish homework before screens)\n\n2. **Agree on consequences**\n   "If they hit, we both do timeout. No exceptions."\n\n3. **Discuss your approaches**\n   "I tend to be stricter. You tend to give more warnings. Let\'s meet in the middle."\n\n4. **Create a backup plan**\n   "If we disagree in the moment, we\'ll table it and decide together later."\n\n**Never undermine each other in front of the child:**\n❌ "Dad\'s being ridiculous. You can have the cookie."\n✓ "Let me talk to Dad. We\'ll figure this out."\n\nPresent a united front, even if you disagree privately.'
        },
        {
          lessonId: lesson38.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'This week, have a 20-minute parenting meeting with your partner. Agree on your top 5 rules and consequences. Write them down. When disagreements arise, refer back to your agreement and adjust together—not in front of the kids.'
        }
      ]
    });

    const quiz38 = await prisma.quiz.create({
      data: {
        lessonId: lesson38.id,
        question: 'Your partner gives your child a consequence you don\'t agree with. What should you do?',
        correctAnswer: '',
        explanation: 'Supporting your partner in the moment maintains a united front. You can discuss disagreements privately later and adjust your approach together, but undermining each other in front of children teaches them to manipulate and creates confusion.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz38.id,
          optionLabel: 'A',
          optionText: 'Tell your child in front of your partner that the consequence is unfair.',
          order: 1
        },
        {
          quizId: quiz38.id,
          optionLabel: 'B',
          optionText: 'Support your partner in the moment, then discuss it privately later.',
          order: 2
        },
        {
          quizId: quiz38.id,
          optionLabel: 'C',
          optionText: 'Reverse the consequence immediately.',
          order: 3
        },
        {
          quizId: quiz38.id,
          optionLabel: 'D',
          optionText: 'Argue with your partner in front of your child.',
          order: 4
        }
      ]
    });

    const correctOption38 = await prisma.quizOption.findFirst({
      where: { quizId: quiz38.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz38.id },
      data: { correctAnswer: correctOption38.id }
    });

    console.log('✓ Created Lesson 38 (Discipline Day 23): Co-Parenting Consistency');

    // ============================================================================
    // Day 24: Grandparents and Boundaries
    // ============================================================================

    const lesson39 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 24,
        title: 'Grandparents and Boundaries',
        subtitle: 'Managing Extended Family Dynamics',
        shortDescription: 'Learn how to set and maintain boundaries with grandparents and extended family while preserving relationships.',
        objectives: [
          'Set clear expectations with extended family',
          'Handle boundary violations gracefully',
          'Balance respect and parenting authority'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id, lesson17.id, lesson18.id, lesson19.id, lesson20.id, lesson21.id, lesson22.id, lesson23.id, lesson24.id, lesson25.id, lesson26.id, lesson27.id, lesson28.id, lesson29.id, lesson30.id, lesson31.id, lesson32.id, lesson33.id, lesson34.id, lesson35.id, lesson36.id, lesson37.id, lesson38.id],
        teachesCategories: ['BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#FFF0E4',
        ellipse77Color: '#FFD0A6',
        ellipse78Color: '#A6D0E0'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson39.id,
          order: 1,
          sectionTitle: 'Why Grandparents Undermine Boundaries',
          contentType: 'TEXT',
          bodyText: 'Grandparents often:\n\n- Want to spoil grandkids ("That\'s my job!")\n- Think your rules are too strict\n- Parented differently and believe their way was better\n- Don\'t see your child daily so don\'t see the consequences\n- Feel hurt when you set boundaries\n\nMost aren\'t trying to undermine you—they just have different perspectives.\n\nBut when grandparents contradict your rules, children learn:\n- Rules don\'t matter\n- Mom/Dad aren\'t really in charge\n- If I whine to Grandma, she\'ll give in\n\nYou can have a loving relationship with extended family AND maintain boundaries.'
        },
        {
          lessonId: lesson39.id,
          order: 2,
          sectionTitle: 'Setting Boundaries with Extended Family',
          contentType: 'TEXT',
          bodyText: '**Have a calm, direct conversation:**\n\n"Mom, I love that you spend time with Emma. I need your help with something. We have a rule that she doesn\'t get candy before dinner. I know you like to spoil her, and that\'s wonderful. Can you save treats for after meals? This really helps us with bedtime and behavior."\n\n**Key principles:**\n- Use "I need your help" language (not "You\'re doing it wrong")\n- Explain WHY the rule matters\n- Appreciate their relationship with your child\n- Be specific about what you\'re asking\n- Stay firm if they push back: "I understand you disagree, but this is what we\'re doing."\n\n**If they violate repeatedly:**\n- Reduce unsupervised time\n- Be present during visits\n- Calmly enforce consequences: "Since treats keep happening before dinner, we\'ll have visits at our house for now."\n\nYour children, your rules.'
        },
        {
          lessonId: lesson39.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'If a grandparent or extended family member regularly undermines your rules, have a conversation this week. Use the "I need your help" framework. Be specific, kind, and firm. If needed, adjust visit arrangements to maintain your boundaries.'
        }
      ]
    });

    const quiz39 = await prisma.quiz.create({
      data: {
        lessonId: lesson39.id,
        question: 'Your mother-in-law keeps giving your child candy right before dinner despite your requests. What should you do?',
        correctAnswer: '',
        explanation: 'When boundaries are repeatedly violated, you must adjust the situation to maintain your authority. This isn\'t punishment—it\'s protecting your parenting while preserving the relationship.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz39.id,
          optionLabel: 'A',
          optionText: 'Give up and accept that grandparents will spoil kids.',
          order: 1
        },
        {
          quizId: quiz39.id,
          optionLabel: 'B',
          optionText: 'Have another conversation, then reduce unsupervised time if it continues.',
          order: 2
        },
        {
          quizId: quiz39.id,
          optionLabel: 'C',
          optionText: 'Cut off all contact with the grandparent.',
          order: 3
        },
        {
          quizId: quiz39.id,
          optionLabel: 'D',
          optionText: 'Tell your child that Grandma is being bad.',
          order: 4
        }
      ]
    });

    const correctOption39 = await prisma.quizOption.findFirst({
      where: { quizId: quiz39.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz39.id },
      data: { correctAnswer: correctOption39.id }
    });

    console.log('✓ Created Lesson 39 (Discipline Day 24): Grandparents and Boundaries');

    // ============================================================================
    // Day 25: Celebrating Milestones
    // ============================================================================

    const lesson40 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 25,
        title: 'Celebrating Milestones',
        subtitle: 'Recognizing Your Progress as a Parent',
        shortDescription: 'Reflect on how far you\'ve come and celebrate the positive changes in your parenting and your child.',
        objectives: [
          'Recognize progress and changes',
          'Celebrate small wins',
          'Build confidence for continued growth'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id, lesson17.id, lesson18.id, lesson19.id, lesson20.id, lesson21.id, lesson22.id, lesson23.id, lesson24.id, lesson25.id, lesson26.id, lesson27.id, lesson28.id, lesson29.id, lesson30.id, lesson31.id, lesson32.id, lesson33.id, lesson34.id, lesson35.id, lesson36.id, lesson37.id, lesson38.id, lesson39.id],
        teachesCategories: ['PRAISE'],
        dragonImageUrl: null,
        backgroundColor: '#E4E4FF',
        ellipse77Color: '#C7B3FF',
        ellipse78Color: '#9BD4DF'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson40.id,
          order: 1,
          sectionTitle: 'What You\'ve Accomplished',
          contentType: 'TEXT',
          bodyText: 'Over the past 40 days, you\'ve learned:\n\n**Phase 1: CONNECT**\n✓ Special Play Time and PEN skills\n✓ How to handle chaos and tantrums during connection\n✓ The power of consistency and presence\n\n**Phase 2: DISCIPLINE**\n✓ Effective commands and consequences\n✓ Routines and visual schedules\n✓ Managing screen time, bedtime, and mornings\n✓ Emotional regulation for you and your child\n✓ Repair, co-parenting, and boundaries\n\nThis is HUGE. You\'ve built a complete toolkit for raising confident, connected, well-regulated children.'
        },
        {
          lessonId: lesson40.id,
          order: 2,
          sectionTitle: 'Signs of Progress',
          contentType: 'TEXT',
          bodyText: 'You might be noticing:\n\n**In your child:**\n- More cooperation\n- Less whining or tantrums\n- Better emotional regulation\n- Stronger connection with you\n- More independence with routines\n\n**In yourself:**\n- More confidence\n- Less yelling\n- More intentional responses\n- Better self-regulation\n- Clearer boundaries\n\n**In your relationship:**\n- More joy and laughter\n- Fewer power struggles\n- Deeper trust\n- More peaceful moments\n\nEven if the changes feel small, they\'re real. You\'re doing this.'
        },
        {
          lessonId: lesson40.id,
          order: 3,
          sectionTitle: 'Celebrate',
          contentType: 'TEXT',
          bodyText: 'Take a moment to celebrate:\n\n- Write down 3 specific changes you\'ve seen in yourself or your child\n- Share your progress with a supportive friend or partner\n- Do something kind for yourself (you\'ve earned it!)\n- Give yourself credit for showing up every day\n\nParenting is the hardest job there is. You\'re not perfect, but you\'re committed. That\'s what matters.'
        }
      ]
    });

    const quiz40 = await prisma.quiz.create({
      data: {
        lessonId: lesson40.id,
        question: 'What is the most important thing you\'ve learned from this program?',
        correctAnswer: '',
        explanation: 'Connection is the foundation that makes everything else work. Children who feel deeply connected to their parents are more cooperative, emotionally regulated, and resilient. Discipline without connection is just punishment.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz40.id,
          optionLabel: 'A',
          optionText: 'Perfect parenting is the goal.',
          order: 1
        },
        {
          quizId: quiz40.id,
          optionLabel: 'B',
          optionText: 'Connection is the foundation that makes discipline effective.',
          order: 2
        },
        {
          quizId: quiz40.id,
          optionLabel: 'C',
          optionText: 'Consequences solve all behavior problems.',
          order: 3
        },
        {
          quizId: quiz40.id,
          optionLabel: 'D',
          optionText: 'Children should obey without question.',
          order: 4
        }
      ]
    });

    const correctOption40 = await prisma.quizOption.findFirst({
      where: { quizId: quiz40.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz40.id },
      data: { correctAnswer: correctOption40.id }
    });

    console.log('✓ Created Lesson 40 (Discipline Day 25): Celebrating Milestones');

    // ============================================================================
    // Day 26: The Road Ahead
    // ============================================================================

    const lesson41 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 26,
        title: 'The Road Ahead',
        subtitle: 'Maintaining Skills and Continuing to Grow',
        shortDescription: 'Learn how to maintain your new parenting skills, handle setbacks, and continue growing as a parent.',
        objectives: [
          'Create a sustainable long-term plan',
          'Handle setbacks and regressions',
          'Know when to revisit lessons'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: [lesson15.id, lesson16.id, lesson17.id, lesson18.id, lesson19.id, lesson20.id, lesson21.id, lesson22.id, lesson23.id, lesson24.id, lesson25.id, lesson26.id, lesson27.id, lesson28.id, lesson29.id, lesson30.id, lesson31.id, lesson32.id, lesson33.id, lesson34.id, lesson35.id, lesson36.id, lesson37.id, lesson38.id, lesson39.id, lesson40.id],
        teachesCategories: ['PRAISE', 'ECHO', 'NARRATE', 'BOUNDARIES'],
        dragonImageUrl: null,
        backgroundColor: '#FFF0E4',
        ellipse77Color: '#FFD0A6',
        ellipse78Color: '#A6D0E0'
      }
    });

    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: lesson41.id,
          order: 1,
          sectionTitle: 'Maintaining Your Skills',
          contentType: 'TEXT',
          bodyText: 'Now that you\'ve learned all these skills, the real work begins: using them consistently.\n\n**Daily non-negotiables:**\n- Special Play Time (5-10 minutes)\n- Use PEN skills throughout the day\n- Follow through on consequences\n- Repair after conflicts\n\n**Weekly check-ins:**\n- How am I doing with consistency?\n- Which skills am I using most?\n- Where am I struggling?\n- What needs more practice?\n\n**Monthly refreshers:**\n- Re-read lessons that were particularly helpful\n- Adjust routines as your child grows\n- Celebrate progress\n\nParenting is a practice, not a destination.'
        },
        {
          lessonId: lesson41.id,
          order: 2,
          sectionTitle: 'Handling Setbacks',
          contentType: 'TEXT',
          bodyText: 'You will have hard days. Your child will regress. You\'ll lose your temper.\n\nThis is NORMAL. Setbacks don\'t erase progress.\n\n**When things get hard:**\n\n1. **Go back to basics**: Special Play Time + Clear boundaries\n2. **Check your own regulation**: Are you sleeping? Eating? Getting support?\n3. **Revisit specific lessons**: If bedtime becomes a battle again, re-read that lesson\n4. **Ask for help**: Talk to your partner, a friend, or a therapist\n5. **Be patient**: Behavior change takes time\n\n**Remember:**\n- You don\'t have to be perfect\n- Your child doesn\'t have to be perfect\n- Progress isn\'t linear\n- You\'re doing better than you think\n\nKeep showing up. That\'s what matters.'
        },
        {
          lessonId: lesson41.id,
          order: 3,
          sectionTitle: 'You\'ve Got This',
          contentType: 'TEXT',
          bodyText: 'You started this program because you wanted to be a better parent. And you are.\n\nYou\'ve learned evidence-based skills. You\'ve practiced them. You\'ve grown.\n\nYour child is lucky to have a parent who is committed to growth, connection, and doing hard things.\n\nOn your hardest days, remember:\n- You are enough\n- Your child loves you\n- Small changes create big impacts\n- You don\'t have to do this perfectly\n- You\'re exactly the parent your child needs\n\nKeep going. You\'ve got this.'
        }
      ]
    });

    const quiz41 = await prisma.quiz.create({
      data: {
        lessonId: lesson41.id,
        question: 'After completing this program, what should you do if your child\'s behavior regresses?',
        correctAnswer: '',
        explanation: 'Regressions are normal. Going back to the basics—consistent Special Play Time and clear boundaries—helps re-establish the foundation. This isn\'t failure; it\'s part of the ongoing practice of parenting.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz41.id,
          optionLabel: 'A',
          optionText: 'Assume the program didn\'t work and give up.',
          order: 1
        },
        {
          quizId: quiz41.id,
          optionLabel: 'B',
          optionText: 'Go back to basics: Special Play Time + Clear boundaries.',
          order: 2
        },
        {
          quizId: quiz41.id,
          optionLabel: 'C',
          optionText: 'Get stricter and add more punishments.',
          order: 3
        },
        {
          quizId: quiz41.id,
          optionLabel: 'D',
          optionText: 'Blame yourself for failing.',
          order: 4
        }
      ]
    });

    const correctOption41 = await prisma.quizOption.findFirst({
      where: { quizId: quiz41.id, optionLabel: 'B' }
    });
    await prisma.quiz.update({
      where: { id: quiz41.id },
      data: { correctAnswer: correctOption41.id }
    });

    console.log('✓ Created Lesson 41 (Discipline Day 26): The Road Ahead');

    console.log('\n🎉 ALL 41 LESSONS COMPLETE! 🎉');
    console.log('✅ Phase 1 (CONNECT): 15 lessons');
    console.log('✅ Phase 2 (DISCIPLINE): 26 lessons');
    console.log('📚 Total: 41 complete lessons with segments, quizzes, and options\n');

    // ============================================================================
    // Summary
    // ============================================================================

    const totalLessons = await prisma.lesson.count();
    const totalSegments = await prisma.lessonSegment.count();
    const totalQuizzes = await prisma.quiz.count();
    const totalQuizOptions = await prisma.quizOption.count();

    console.log('\n📊 Summary:');
    console.log(`   Lessons created: ${totalLessons}`);
    console.log(`   Segments created: ${totalSegments}`);
    console.log(`   Quizzes created: ${totalQuizzes}`);
    console.log(`   Quiz options created: ${totalQuizOptions}`);
    console.log('\n✨ Lesson seeding complete!');

  } catch (error) {
    console.error('❌ Error seeding lessons:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedLessons()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
