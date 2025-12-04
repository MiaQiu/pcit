require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Batch 1: Seed lessons 29-35 (Discipline Days 14-20)
 * This is a focused batch to avoid database timeout issues
 */

async function seedBatch1() {
  try {
    console.log('🌱 Batch 1: Seeding lessons 29-35 (Discipline Days 14-20)...\n');

    // Load existing lessons to build prerequisite chain
    const existingLessons = await prisma.lesson.findMany({
      orderBy: [{ phaseNumber: 'asc' }, { dayNumber: 'asc' }],
      select: { id: true, phase: true, dayNumber: true, title: true }
    });

    console.log(`Found ${existingLessons.length} existing lessons`);

    if (existingLessons.length < 28) {
      console.log('❌ Error: Need at least 28 lessons before running this batch');
      console.log('Run the main seed script first to create lessons 1-28');
      await prisma.$disconnect();
      return;
    }

    // Check if batch already completed
    if (existingLessons.length >= 35) {
      console.log('✅ Batch 1 already completed (lessons 29-35 exist)');
      await prisma.$disconnect();
      return;
    }

    // Build prerequisite mapping - lessons 15-28 will be used as prereqs
    const lessonMap = {};
    existingLessons.forEach((lesson, index) => {
      lessonMap[`lesson${index + 1}`] = lesson;
    });

    // Extract specific lessons needed for prerequisites
    const lesson15 = lessonMap.lesson15;
    const lesson16 = lessonMap.lesson16;
    const lesson17 = lessonMap.lesson17;
    const lesson18 = lessonMap.lesson18;
    const lesson19 = lessonMap.lesson19;
    const lesson20 = lessonMap.lesson20;
    const lesson21 = lessonMap.lesson21;
    const lesson22 = lessonMap.lesson22;
    const lesson23 = lessonMap.lesson23;
    const lesson24 = lessonMap.lesson24;
    const lesson25 = lessonMap.lesson25;
    const lesson26 = lessonMap.lesson26;
    const lesson27 = lessonMap.lesson27;
    const lesson28 = lessonMap.lesson28;

    console.log('Creating lessons 29-35...\n');

    // ============================================================================
    // LESSON 29 - Discipline Day 14: Bedtime Without Battles
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
        { quizId: quiz29.id, optionLabel: 'A', optionText: 'Give them a hug and let them stay up 10 more minutes.', order: 1 },
        { quizId: quiz29.id, optionLabel: 'B', optionText: 'Silently walk them back to bed without talking.', order: 2 },
        { quizId: quiz29.id, optionLabel: 'C', optionText: 'Yell at them to stay in bed.', order: 3 },
        { quizId: quiz29.id, optionLabel: 'D', optionText: 'Explain why they need sleep for the 5th time.', order: 4 }
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
    // LESSON 30 - Discipline Day 15: Morning Routines That Work
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
        { quizId: quiz30.id, optionLabel: 'A', optionText: 'Force them into clothes while they scream.', order: 1 },
        { quizId: quiz30.id, optionLabel: 'B', optionText: 'Calmly say "We\'re leaving now. You can get dressed at school" and bring the clothes.', order: 2 },
        { quizId: quiz30.id, optionLabel: 'C', optionText: 'Let them stay home from school.', order: 3 },
        { quizId: quiz30.id, optionLabel: 'D', optionText: 'Yell at them about being irresponsible.', order: 4 }
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

    console.log('\n🎉 Batch 1 partially complete! Created lessons 29-30.');
    console.log('Note: This batch is designed to be extended to include lessons 31-35.\n');
    console.log('Current status: 30/41 lessons (73% complete)');

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error in Batch 1:', error);
    console.error('Fatal error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

seedBatch1();
