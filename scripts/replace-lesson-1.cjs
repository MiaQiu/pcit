require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Replace Connect Day 1 with new "Nora's Methodology + Your First Skill: Special Play Time" lesson
 */

async function replaceLesson1() {
  try {
    console.log('🔄 Replacing Connect Day 1 lesson...\n');

    // Find the current first lesson
    const currentLesson = await prisma.lesson.findFirst({
      where: {
        phase: 'CONNECT',
        dayNumber: 1
      },
      include: {
        segments: true,
        quiz: {
          include: {
            options: true,
            responses: true
          }
        },
        userProgress: true
      }
    });

    if (currentLesson) {
      console.log(`Found existing lesson: "${currentLesson.title}"`);
      console.log(`ID: ${currentLesson.id}`);
      console.log(`Segments: ${currentLesson.segments.length}`);
      console.log(`Quiz: ${currentLesson.quiz ? 'Yes' : 'No'}`);
      console.log(`User progress records: ${currentLesson.userProgress.length}\n`);

      // Delete the lesson (cascading deletes will remove segments, quiz, etc.)
      console.log('Deleting existing lesson and related data...');
      await prisma.lesson.delete({
        where: { id: currentLesson.id }
      });
      console.log('✅ Deleted\n');
    } else {
      console.log('No existing Connect Day 1 lesson found\n');
    }

    // Create the new lesson
    console.log('Creating new Connect Day 1 lesson...');
    const newLesson = await prisma.lesson.create({
      data: {
        phase: 'CONNECT',
        phaseNumber: 1,
        dayNumber: 1,
        title: "Nora's Methodology + Your First Skill: Special Play Time",
        subtitle: null,
        shortDescription: "The foundation behind Nora's approach and your first daily practice.",
        objectives: [
          'Understand the Nora Method',
          'Learn Special Play Time rules',
          'Practice scripts'
        ],
        estimatedMinutes: 5,
        isBooster: false,
        prerequisites: [],
        teachesCategories: ['PRAISE', 'ECHO', 'NARRATION'], // PEN skills
        dragonImageUrl: null,
        backgroundColor: '#E4E4FF',
        ellipse77Color: '#9BD4DF',
        ellipse78Color: '#A6E0CB'
      }
    });

    console.log(`✅ Created lesson: ${newLesson.id}\n`);

    // Create lesson segments
    console.log('Creating lesson segments...');
    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: newLesson.id,
          order: 1,
          sectionTitle: 'Welcome to your first day with Nora!',
          contentType: 'TEXT',
          bodyText: "Today, you'll learn:\n\n* The foundation behind Nora's approach.\n* Why connection always comes before discipline.\n* Your very first daily practice: Special Play Time."
        },
        {
          lessonId: newLesson.id,
          order: 2,
          sectionTitle: "Nora's Approach in a Nutshell",
          contentType: 'TEXT',
          bodyText: 'Nora blends decades of research from:\n\n* **Play Therapy:** Connection through play.\n* **Triple P:** Positive, strength-focused parenting.\n* **Behavior Management Training:** Calm, clear guidance.\n\nOur goal: Make parenting easier by building connections first, then teaching discipline that actually works.'
        },
        {
          lessonId: newLesson.id,
          order: 3,
          sectionTitle: 'Two Phases, One Goal: A Happier Home',
          contentType: 'TEXT',
          bodyText: '**Phase 1: Connect**\nBefore kids listen, they need to feel understood, safe, seen, and connected. We build this through 5 minutes of daily Special Play Time—your foundation for better cooperation.\n\n**Phase 2: Discipline**\nOnce the relationship is strong and steady, Nora teaches you how to give instructions kids follow, set boundaries without yelling, and respond calmly to challenging moments.\n\nConnection first makes discipline smoother and more effective.'
        },
        {
          lessonId: newLesson.id,
          order: 4,
          sectionTitle: 'Your First Practice: Special Play Time',
          contentType: 'TEXT',
          bodyText: "This is your \"homework\" for Phase 1. It's simple, powerful, and takes just 5 minutes a day. Think of it as your child's emotional gym—a small daily dose of positive attention that builds trust and cooperation."
        },
        {
          lessonId: newLesson.id,
          order: 5,
          sectionTitle: 'The 3 Rules of Special Play Time',
          contentType: 'TIP',
          bodyText: '1. **Time:** 5 minutes every day. Consistency is more important than length.\n\n2. **Child Leads, Parent Follows:** Your child is the "boss." They choose the activity, guide the play, and you follow along—no questioning, commands, or criticizing.\n\n3. **Choose the Right Toys:** Choose toys that encourage imagination and natural interaction (blocks, cars, dolls, Play-Doh). Avoid toys that tempt you to lead (board games, books, puzzles).'
        },
        {
          lessonId: newLesson.id,
          order: 6,
          sectionTitle: 'Sample Script to Start Special Play Time',
          contentType: 'SCRIPT',
          bodyText: "\"It's time for our Special Play Time! For the next 5 minutes, you get to be the boss. You can choose any of these toys for us to play with—blocks, cars, or dolls.\""
        },
        {
          lessonId: newLesson.id,
          order: 7,
          sectionTitle: 'Ending Special Time After Five Minutes of Play',
          contentType: 'TIP',
          bodyText: "Five minutes of practicing the PEN skills can feel exhausting, but this therapeutic dose is highly effective.\n\n**Handling the End:**\nIf your child has a hard time stopping, give a heads-up:\n\"Special Time will be over in three minutes.\"\n\"Special Time will be over in two minutes.\"\n\"Special Time will be over in one more minute.\"\n\n**The End Script:**\n\"Special Time is now over. I wanted to tell you that I really liked how you (insert labeled praises about your child's behavior during Special Time).\""
        }
      ]
    });

    console.log(`✅ Created 7 segments\n`);

    // Create quiz (temporary correctAnswer, will update after creating options)
    console.log('Creating quiz...');
    const quiz = await prisma.quiz.create({
      data: {
        lessonId: newLesson.id,
        question: 'Why does Nora start with the Connect phase before teaching discipline? Choose the BEST answer:',
        correctAnswer: 'temp', // Will be updated after options are created
        explanation: 'B is the correct answer. In early childhood, relationship drives cooperation'
      }
    });

    console.log(`✅ Created quiz: ${quiz.id}\n`);

    // Create quiz options
    console.log('Creating quiz options...');
    const optionB = await prisma.quizOption.create({
      data: {
        quizId: quiz.id,
        optionLabel: 'B',
        optionText: 'Because a strong parent–child connection builds trust, which makes kids more willing to listen and follow instructions.',
        order: 2
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: quiz.id,
          optionLabel: 'A',
          optionText: "Because kids only behave well when they're happy all the time.",
          order: 1
        },
        {
          quizId: quiz.id,
          optionLabel: 'C',
          optionText: 'Because playtime is more fun than learning rules.',
          order: 3
        },
        {
          quizId: quiz.id,
          optionLabel: 'D',
          optionText: "Because young children don't understand boundaries yet.",
          order: 4
        }
      ]
    });

    // Update quiz with correct answer ID
    await prisma.quiz.update({
      where: { id: quiz.id },
      data: { correctAnswer: optionB.id }
    });

    console.log(`✅ Created 4 quiz options and set correct answer\n`);

    console.log('✅ Successfully replaced Connect Day 1 lesson!\n');
    console.log('Summary:');
    console.log(`- Title: ${newLesson.title}`);
    console.log(`- Segments: 7`);
    console.log(`- Quiz: 1 question with 4 options`);
    console.log(`- Estimated time: ${newLesson.estimatedMinutes} minutes`);

  } catch (error) {
    console.error('❌ Error replacing lesson:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

replaceLesson1()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
