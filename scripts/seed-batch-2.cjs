require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedBatch2() {
  try {
    console.log('🌱 Batch 2: Seeding lessons 31-41 (Discipline Days 16-26)...\n');
    
    const existing = await prisma.lesson.findMany({ 
      orderBy: [{ phaseNumber: 'asc' }, { dayNumber: 'asc' }], 
      select: { id: true } 
    });
    
    console.log(`Found ${existing.length} existing lessons`);
    
    if (existing.length < 30) {
      console.log('❌ Need 30+ lessons first');
      await prisma.$disconnect();
      return;
    }

    if (existing.length >= 41) {
      console.log('✅ All 41 lessons already exist!');
      await prisma.$disconnect();
      return;
    }
    
    const m = {};
    existing.forEach((l, i) => { m[`lesson${i+1}`] = l; });
    const { lesson15, lesson16, lesson17, lesson18, lesson19, lesson20, lesson21, lesson22, lesson23, lesson24, lesson25, lesson26, lesson27, lesson28, lesson29, lesson30 } = m;
    
    console.log('Creating lessons 31-41...\n');

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

    console.log('\n🎉 COMPLETE! All 41 lessons seeded successfully!');
    console.log('Database now contains all 41 lessons with segments, quizzes, and options.\n');

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error in Batch 2:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

seedBatch2();
