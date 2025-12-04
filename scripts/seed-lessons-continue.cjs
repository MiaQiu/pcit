const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Continue Seeding Lessons (29-41)
 * This script continues from lesson 29 (Discipline Day 14) through lesson 41 (Discipline Day 26)
 */

async function continueSeed() {
  try {
    console.log('🌱 Continuing lesson seeding from lesson 29...\n');

    // Get existing lessons to build prerequisites
    const existingLessons = await prisma.lesson.findMany({
      orderBy: [{ phaseNumber: 'asc' }, { dayNumber: 'asc' }],
      select: { id: true }
    });

    console.log(`Found ${existingLessons.length} existing lessons`);

    if (existingLessons.length < 28) {
      console.log('❌ Error: Need at least 28 lessons before continuing');
      return;
    }

    const prerequisiteIds = existingLessons.map(l => l.id);

    console.log('Creating remaining lessons...\n');

    // ============================================================================
    // DISCIPLINE PHASE - Day 14
    // ============================================================================

    const lesson29 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 14,
        title: 'Bedtime Without Battles',
        subtitle: 'Creating Peaceful Evening Routines',
        shortDescription: 'Learn how to make bedtime smooth and stress-free with clear routines and boundaries.',
        objectives: [
          'Create a consistent bedtime routine',
          'Handle bedtime resistance',
          'Use "When/Then" for evening transitions'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: prerequisiteIds,
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
          lessonId: lesson29.id,
          order: 1,
          sectionTitle: 'Why Bedtime Becomes a Battle',
          contentType: 'TEXT',
          bodyText: 'Bedtime resistance is one of the most common challenges parents face. Kids resist bedtime because they don\'t want the day to end, they want more time with you, or they\'re overtired and dysregulated.\n\nThe key to peaceful bedtimes isn\'t forcing compliance—it\'s creating a predictable, calming routine that helps your child\'s body naturally prepare for sleep.'
        },
        {
          lessonId: lesson29.id,
          order: 2,
          sectionTitle: 'The Bedtime Routine Framework',
          contentType: 'EXAMPLE',
          bodyText: '**Example routine:**\n\n7:00 PM - Bath time\n7:20 PM - Pajamas and brush teeth\n7:30 PM - Two books\n7:45 PM - Lights out\n\n**Use When/Then:** "When you put on your pajamas, then we can read two books."\n\n**Set boundaries:** "I\'m reading two books tonight. You can choose which two."\n\n**Follow through:** If your child asks for a third book, calmly say, "We read two books. That was the plan. Goodnight, I love you." Then leave.'
        },
        {
          lessonId: lesson29.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'Tonight, write down your ideal bedtime routine. Share it with your child before bed so they know what to expect. Use a visual schedule if your child is young. Consistency is everything—stick to the same routine every single night.'
        }
      ]
    });

    const quiz29 = await prisma.quiz.create({
      data: {
        lessonId: lesson29.id,
        question: 'Your child keeps asking for "one more story" after you\'ve already read two books. What should you do?',
        correctAnswer: '',
        explanation: 'Following through with the boundary you set teaches your child that bedtime rules are consistent and predictable. Giving in "just this once" trains them to keep asking.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        { quizId: quiz29.id, optionLabel: 'A', optionText: 'Give in and read one more book to avoid a tantrum.', order: 1 },
        { quizId: quiz29.id, optionLabel: 'B', optionText: 'Calmly remind them of the rule and leave the room.', order: 2 },
        { quizId: quiz29.id, optionLabel: 'C', optionText: 'Negotiate: "If you go to sleep now, I\'ll read three tomorrow."', order: 3 }
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

    // Update prerequisites for next lesson
    prerequisiteIds.push(lesson29.id);

    // ============================================================================
    // DISCIPLINE PHASE - Day 15
    // ============================================================================

    const lesson30 = await prisma.lesson.create({
      data: {
        phase: 'DISCIPLINE',
        phaseNumber: 2,
        dayNumber: 15,
        title: 'Morning Routines That Work',
        subtitle: 'Starting the Day Smoothly',
        shortDescription: 'Create stress-free mornings with clear routines and realistic expectations.',
        objectives: [
          'Build a predictable morning routine',
          'Reduce morning power struggles',
          'Use visual schedules for independence'
        ],
        estimatedMinutes: 2,
        isBooster: false,
        prerequisites: prerequisiteIds,
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
          lessonId: lesson30.id,
          order: 1,
          sectionTitle: 'Why Mornings Are Hard',
          contentType: 'TEXT',
          bodyText: 'Chaotic mornings happen when expectations aren\'t clear, the routine changes daily, or there\'s not enough time built in for transitions.\n\nKids need time to wake up, time to transition between activities, and clear expectations about what needs to happen before school. Rushing creates stress for everyone.'
        },
        {
          lessonId: lesson30.id,
          order: 2,
          sectionTitle: 'The Morning Routine Framework',
          contentType: 'EXAMPLE',
          bodyText: '**Example routine:**\n\n6:30 AM - Wake up\n6:45 AM - Get dressed\n7:00 AM - Breakfast\n7:20 AM - Brush teeth, shoes on\n7:30 AM - Leave for school\n\n**Use When/Then:** "When you get dressed, then you can have breakfast."\n\n**Set boundaries:** "We leave at 7:30. If you\'re not ready, you\'ll finish getting ready in the car."\n\n**Follow through:** If they\'re not dressed by 7:30, calmly hand them their clothes and put them in the car. Natural consequences teach faster than lectures.'
        },
        {
          lessonId: lesson30.id,
          order: 3,
          sectionTitle: 'Practice Tip',
          contentType: 'TIP',
          bodyText: 'Tonight, create a visual morning routine chart with your child. Let them help design it. Place it somewhere visible. Tomorrow morning, follow the routine without nagging—just point to the chart when needed.'
        }
      ]
    });

    const quiz30 = await prisma.quiz.create({
      data: {
        lessonId: lesson30.id,
        question: 'It\'s 7:25 AM and your child is still in pajamas. You leave for school at 7:30. What should you do?',
        correctAnswer: '',
        explanation: 'Natural consequences are powerful teachers. If your child experiences what it feels like to get dressed in the car, they\'ll be more motivated to get ready on time tomorrow.'
      }
    });

    await prisma.quizOption.createMany({
      data: [
        { quizId: quiz30.id, optionLabel: 'A', optionText: 'Yell at them to hurry up and help them get dressed.', order: 1 },
        { quizId: quiz30.id, optionLabel: 'B', optionText: 'Calmly hand them their clothes and say, "We\'re leaving in 5 minutes. You can finish in the car."', order: 2 },
        { quizId: quiz30.id, optionLabel: 'C', optionText: 'Call them late and let them stay home today.', order: 3 }
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

    // Continue with remaining lessons... (Days 16-26)
    prerequisiteIds.push(lesson30.id);

    console.log('\n🎉 Partial completion! Lessons 29-30 added.');
    console.log('Note: Still need to add lessons 31-41 (Discipline Days 16-26)\n');

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error continuing seed:', error);
    console.error('Fatal error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

continueSeed();
