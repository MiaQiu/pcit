require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Replace Connect Day 1 and Day 2 with new content
 * Day 1: Nora's Methodology + Your First Skill
 * Day 2: The 3 Core Skills (PEN)
 */

async function replaceLessons() {
  try {
    console.log('🔄 Replacing Connect Day 1 and Day 2 lessons...\n');

    // ========================================================================
    // DAY 1: Nora's Methodology + Your First Skill
    // ========================================================================

    console.log('📚 Processing Day 1...');
    const currentDay1 = await prisma.lesson.findFirst({
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

    if (currentDay1) {
      console.log(`Found existing Day 1: "${currentDay1.title}"`);
      console.log(`Deleting...`);
      await prisma.lesson.delete({
        where: { id: currentDay1.id }
      });
      console.log('✅ Deleted\n');
    } else {
      console.log('No existing Day 1 found\n');
    }

    console.log('Creating new Day 1 lesson...');
    const day1Lesson = await prisma.lesson.create({
      data: {
        phase: 'CONNECT',
        phaseNumber: 1,
        dayNumber: 1,
        title: "Nora's Methodology + Your First Skill",
        subtitle: null,
        shortDescription: "The foundation behind Nora's approach and your first daily practice: Special Play Time.",
        objectives: [
          'Understand the Nora Method',
          'Learn Special Play Time rules',
          'Practice starting scripts'
        ],
        estimatedMinutes: 5,
        isBooster: false,
        prerequisites: [],
        teachesCategories: ['PRAISE', 'ECHO', 'NARRATION'],
        dragonImageUrl: null,
        backgroundColor: '#E4E4FF',
        ellipse77Color: '#9BD4DF',
        ellipse78Color: '#A6E0CB'
      }
    });

    console.log('Creating Day 1 segments...');
    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: day1Lesson.id,
          order: 1,
          sectionTitle: 'Welcome to Day 1',
          contentType: 'TEXT',
          bodyText: "Welcome to your first day!\n\nToday, you'll learn the foundation behind **Nora's approach** and your very first daily practice: **Special Play Time**.\n\nOur goal is to make parenting easier by building **connections first**, then teaching discipline that actually works."
        },
        {
          lessonId: day1Lesson.id,
          order: 2,
          sectionTitle: "Nora's Approach",
          contentType: 'TEXT',
          bodyText: "Nora blends research from:\n• **Play Therapy** (connection)\n• **Triple P** (positive parenting)\n• **Behavior Management** (calm guidance)\n\nWe focus on **two phases**:\n\n**Phase 1 - Connect:** Build safety and understanding\n\n**Phase 2 - Discipline:** Teach boundaries once the relationship is strong"
        },
        {
          lessonId: day1Lesson.id,
          order: 3,
          sectionTitle: 'Your First Practice: Special Play Time',
          contentType: 'TEXT',
          bodyText: 'Your "homework" is **simple but powerful**:\n\n**Spend just 5 minutes a day in Special Play Time.**\n\nThink of it as your child\'s **emotional gym**—a small daily dose of positive attention that builds the trust required for cooperation.'
        },
        {
          lessonId: day1Lesson.id,
          order: 4,
          sectionTitle: 'The 3 Rules',
          contentType: 'TIP',
          bodyText: '**Time:** 5 minutes daily. Consistency beats length.\n\n**Child Leads:** They are the "boss." No questioning or commanding.\n\n**Right Toys:** Use imagination toys (blocks, cars, dolls). Avoid rule-based games (board games) or books that tempt you to lead.'
        },
        {
          lessonId: day1Lesson.id,
          order: 5,
          sectionTitle: 'Sample Script',
          contentType: 'SCRIPT',
          bodyText: '"It\'s time for our Special Play Time! For the next 5 minutes, you get to be the boss. You can choose any of these toys for us to play with—blocks, cars, or dolls."'
        },
        {
          lessonId: day1Lesson.id,
          order: 6,
          sectionTitle: 'Ending Special Time',
          contentType: 'TIP',
          bodyText: '**After five minutes, you must end the session** to release the pressure of using high-intensity skills.\n\nIf your child struggles with ending, give warnings:\n• "Special Time will be over in two minutes"\n• "One minute"'
        },
        {
          lessonId: day1Lesson.id,
          order: 7,
          sectionTitle: 'The End Script',
          contentType: 'SCRIPT',
          bodyText: '"Special Time is now over. I wanted to tell you that I really liked how you [insert labeled praise about behavior]." This transitions them back to normal time positively.'
        }
      ]
    });

    console.log('Creating Day 1 quiz...');
    const day1Quiz = await prisma.quiz.create({
      data: {
        lessonId: day1Lesson.id,
        question: 'Why does Nora start with the Connect phase before teaching discipline?',
        correctAnswer: 'temp',
        explanation: 'In early childhood, a secure relationship is the primary driver of cooperation and willingness to listen.'
      }
    });

    const day1OptionB = await prisma.quizOption.create({
      data: {
        quizId: day1Quiz.id,
        optionLabel: 'B',
        optionText: 'Because a strong parent–child connection builds trust, which makes kids more willing to listen and follow instructions.',
        order: 2
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: day1Quiz.id,
          optionLabel: 'A',
          optionText: "Because kids only behave well when they're happy all the time.",
          order: 1
        },
        {
          quizId: day1Quiz.id,
          optionLabel: 'C',
          optionText: 'Because playtime is more fun than learning rules.',
          order: 3
        },
        {
          quizId: day1Quiz.id,
          optionLabel: 'D',
          optionText: "Because young children don't understand boundaries yet.",
          order: 4
        }
      ]
    });

    await prisma.quiz.update({
      where: { id: day1Quiz.id },
      data: { correctAnswer: day1OptionB.id }
    });

    console.log('✅ Day 1 complete!\n');

    // ========================================================================
    // DAY 2: The 3 Core Skills (PEN)
    // ========================================================================

    console.log('📚 Processing Day 2...');
    const currentDay2 = await prisma.lesson.findFirst({
      where: {
        phase: 'CONNECT',
        dayNumber: 2
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

    if (currentDay2) {
      console.log(`Found existing Day 2: "${currentDay2.title}"`);
      console.log(`Deleting...`);
      await prisma.lesson.delete({
        where: { id: currentDay2.id }
      });
      console.log('✅ Deleted\n');
    } else {
      console.log('No existing Day 2 found\n');
    }

    console.log('Creating new Day 2 lesson...');
    const day2Lesson = await prisma.lesson.create({
      data: {
        phase: 'CONNECT',
        phaseNumber: 1,
        dayNumber: 2,
        title: "The 3 Core Skills (PEN)",
        subtitle: null,
        shortDescription: "Learn Praise, Echo, and Narrate—the 3 skills that make Special Play Time powerful.",
        objectives: [
          'Learn the PEN skills',
          'Practice Praise, Echo, and Narrate',
          'Understand how each skill builds connection'
        ],
        estimatedMinutes: 5,
        isBooster: false,
        prerequisites: [day1Lesson.id],
        teachesCategories: ['PRAISE', 'ECHO', 'NARRATION'],
        dragonImageUrl: null,
        backgroundColor: '#E4F0FF',
        ellipse77Color: '#A6D4E0',
        ellipse78Color: '#B4E0CB'
      }
    });

    console.log('Creating Day 2 segments...');
    await prisma.lessonSegment.createMany({
      data: [
        {
          lessonId: day2Lesson.id,
          order: 1,
          sectionTitle: 'The PEN Skills',
          contentType: 'TEXT',
          bodyText: "Today you learn the **3 skills** that make Special Play Time powerful:\n\n**P**raise, **E**cho, and **N**arrate **(PEN)**\n\nThese skills help your child feel:\n• **Understood**\n• **Confident**\n• **Connected**\n\nWhen kids feel these things, they listen better outside of playtime too."
        },
        {
          lessonId: day2Lesson.id,
          order: 2,
          sectionTitle: 'Skill 1 - Praise (P)',
          contentType: 'TEXT',
          bodyText: '**Tell your child exactly what they are doing well.**\n\nThis builds confidence and increases positive behavior.\n\n**Examples:**\n• "I love how gently you\'re playing"\n• "Great job sharing the blocks"\n\n**💡 Tip:** Praise the **specific action**, not just the personality.'
        },
        {
          lessonId: day2Lesson.id,
          order: 3,
          sectionTitle: 'Skill 2 - Echo (E)',
          contentType: 'EXAMPLE',
          bodyText: '**Repeat or reflect what your child says.**\n\nThis acts as a **verbal hug**.\n\n**Example 1:**\n👶 **Child:** "The car is fast!"\n👤 **You:** "The car is fast!"\n\n**Example 2:**\n👶 **Child:** "I\'m making a tower."\n👤 **You:** "You\'re making a tower!"\n\n**💡 Tip:** This makes your child feel truly heard.'
        },
        {
          lessonId: day2Lesson.id,
          order: 4,
          sectionTitle: 'Skill 3 - Narrate (N)',
          contentType: 'TEXT',
          bodyText: '**Describe what your child is doing, like a sports commentator.**\n\n**Examples:**\n• "You\'re stacking the blue block on the red one"\n• "You\'re feeding the baby doll"\n\n**💡 Tip:** This keeps the child **calm and focused**, even if they aren\'t talking much yet.'
        },
        {
          lessonId: day2Lesson.id,
          order: 5,
          sectionTitle: 'Sample Script',
          contentType: 'SCRIPT',
          bodyText: '**Try a mix:**\n\n👤 "You\'re lining up all the cars." **(Narrate)**\n\n👶 **Child:** "This one is the fastest!"\n👤 **You:** "The fastest one!" **(Echo)**\n\n👤 "I love how focused you are." **(Praise)**\n\n**Remember:** You don\'t need perfect sentences—just be **warm and present**.'
        }
      ]
    });

    console.log('Creating Day 2 quiz...');
    const day2Quiz = await prisma.quiz.create({
      data: {
        lessonId: day2Lesson.id,
        question: 'What is the main purpose of the "Echo" skill?',
        correctAnswer: 'temp',
        explanation: 'Echoing validates the child\'s thoughts, making them feel heard and building trust.'
      }
    });

    const day2OptionB = await prisma.quizOption.create({
      data: {
        quizId: day2Quiz.id,
        optionLabel: 'B',
        optionText: 'To show your child you\'re listening and build their language skills.',
        order: 2
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          quizId: day2Quiz.id,
          optionLabel: 'A',
          optionText: 'To correct what your child says.',
          order: 1
        },
        {
          quizId: day2Quiz.id,
          optionLabel: 'C',
          optionText: 'To give instructions.',
          order: 3
        },
        {
          quizId: day2Quiz.id,
          optionLabel: 'D',
          optionText: 'To speed up playtime.',
          order: 4
        }
      ]
    });

    await prisma.quiz.update({
      where: { id: day2Quiz.id },
      data: { correctAnswer: day2OptionB.id }
    });

    console.log('✅ Day 2 complete!\n');

    // ========================================================================
    // Summary
    // ========================================================================

    console.log('✅ Successfully replaced both lessons!\n');
    console.log('📊 Summary:');
    console.log('\nDay 1:');
    console.log(`  Title: ${day1Lesson.title}`);
    console.log(`  Segments: 7`);
    console.log(`  Quiz: 1 question with 4 options`);
    console.log('\nDay 2:');
    console.log(`  Title: ${day2Lesson.title}`);
    console.log(`  Segments: 5`);
    console.log(`  Quiz: 1 question with 4 options`);

  } catch (error) {
    console.error('❌ Error replacing lessons:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

replaceLessons()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
