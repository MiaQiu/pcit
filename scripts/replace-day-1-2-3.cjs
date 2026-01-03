require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

// Generate a CUID-like ID
function generateId() {
  return crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, '').substring(0, 25);
}

/**
 * Replace Connect Day 1, 2, and 3 with new content
 * Day 1: Nora's Methodology
 * Day 2: The 3 Core Skills
 * Day 3: What NOT to Do
 */

async function replaceLessons() {
  try {
    console.log('🔄 Replacing Connect Day 1, 2, and 3 lessons...\n');

    // ========================================================================
    // DAY 1: Nora's Methodology
    // ========================================================================

    console.log('📚 Processing Day 1...');
    const currentDay1 = await prisma.lesson.findFirst({
      where: {
        phase: 'CONNECT',
        dayNumber: 1
      },
      include: {
        LessonSegment: true,
        Quiz: {
          include: {
            QuizOption: true,
            QuizResponse: true
          }
        },
        UserLessonProgress: true
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
        id: generateId(),
        phase: 'CONNECT',
        phaseNumber: 1,
        dayNumber: 1,
        title: "Nora's Methodology",
        subtitle: null,
        shortDescription: "Learn the science behind Nora's approach and start your first daily practice: Special Play Time.",
        objectives: [
          'Understand the science behind Nora\'s approach',
          'Learn why connection comes before discipline',
          'Start your first daily practice: Special Play Time'
        ],
        estimatedMinutes: 5,
        isBooster: false,
        prerequisites: [],
        teachesCategories: ['PRAISE', 'ECHO', 'NARRATION'],
        dragonImageUrl: null,
        backgroundColor: '#E4E4FF',
        ellipse77Color: '#9BD4DF',
        ellipse78Color: '#A6E0CB',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('Creating Day 1 segments...');
    await prisma.lessonSegment.createMany({
      data: [
        {
          id: generateId(),
          lessonId: day1Lesson.id,
          order: 1,
          sectionTitle: 'Welcome to Nora',
          contentType: 'TEXT',
          bodyText: "Welcome to Day 1! Today, we are laying the foundation for a happier home. You will learn:\n\nThe science behind **Nora's approach**.\n\nWhy **connection** must come before **discipline**.\n\nYour first daily practice: **Special Play Time**.",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: generateId(),
          lessonId: day1Lesson.id,
          order: 2,
          sectionTitle: 'The Science',
          contentType: 'TEXT',
          bodyText: "Nora blends decades of research from **Play Therapy**, **Triple P (Positive Parenting)**, and **Behavior Management**.\n\n**Our Goal:** To make parenting easier by building a strong connection first.\n\n**The Result:** This makes the discipline phase that comes later much smoother and more effective.",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: generateId(),
          lessonId: day1Lesson.id,
          order: 3,
          sectionTitle: 'Two Phases, One Goal',
          contentType: 'TEXT',
          bodyText: "**Phase 1: Connect.**\n\nKids need to feel seen and safe before they listen. We build this through daily **Special Play Time**.\n\n**Phase 2: Discipline.**\n\nOnce the relationship is steady, we introduce calm instructions and boundaries.\n\n**Remember:** Connection drives cooperation.",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: generateId(),
          lessonId: day1Lesson.id,
          order: 4,
          sectionTitle: 'Your Daily Practice',
          contentType: 'TEXT',
          bodyText: "Meet **Special Play Time**.\n\nThink of this as your child's **\"emotional gym.\"** It is a small daily dose of positive attention that builds trust.\n\n**The Commitment:** Just 5 minutes a day.\n\n**The Key:** Consistency is more powerful than duration.",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: generateId(),
          lessonId: day1Lesson.id,
          order: 5,
          sectionTitle: 'The Rules of Engagement',
          contentType: 'TIP',
          bodyText: "**Time:** 5 minutes daily.\n\n**Child Leads:** Your child is the \"boss.\" You follow along—no questioning, commands, or criticizing.\n\n**Right Toys:** Use imaginative toys (blocks, dolls, Play-Doh). Avoid rule-based games (board games) or solitary items (books, puzzles) that make you lead.",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: generateId(),
          lessonId: day1Lesson.id,
          order: 6,
          sectionTitle: 'Starting the Session',
          contentType: 'SCRIPT',
          bodyText: "\"It's time for our **Special Play Time**! For the next 5 minutes, you get to be the boss. You can choose any of these toys for us to play with.\"",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: generateId(),
          lessonId: day1Lesson.id,
          order: 7,
          sectionTitle: 'The Intensity',
          contentType: 'TEXT',
          bodyText: "Five minutes of practicing the **PEN skills** can feel exhausting, but this therapeutic dose is highly effective for improving your relationship.\n\nYou can choose to continue playing after five minutes, but you are still going to tell your child that **Special Time is over**.",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: generateId(),
          lessonId: day1Lesson.id,
          order: 8,
          sectionTitle: 'Releasing Pressure',
          contentType: 'TIP',
          bodyText: "Ending it officially releases you from the pressure to use PEN skills at the high intensity of Special Time.\n\n💡 **Tip:** Continuing to sprinkle in positive skills throughout the rest of the day is highly encouraged because that is where even more change can happen!",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: generateId(),
          lessonId: day1Lesson.id,
          order: 9,
          sectionTitle: 'Handling Resistance',
          contentType: 'TIP',
          bodyText: "If your child struggles with the end of the session, use countdowns to manage expectations:\n\n• \"Special Time ends in 3 minutes.\"\n• \"2 minutes...\"\n• \"1 minute...\"\n\nThis prepares them for the transition and reduces friction.",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: generateId(),
          lessonId: day1Lesson.id,
          order: 10,
          sectionTitle: 'The Closing Script',
          contentType: 'SCRIPT',
          bodyText: "\"Special Time is now over. I wanted to tell you that I really liked how you [insert specific praise about their behavior].\"",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
    });

    console.log('Creating Day 1 quiz...');
    const day1Quiz = await prisma.quiz.create({
      data: {
        id: generateId(),
        lessonId: day1Lesson.id,
        question: 'Why does Nora start with the Connect phase before teaching discipline?',
        correctAnswer: 'temp',
        explanation: 'In early childhood, relationship drives cooperation.',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    const day1OptionB = await prisma.quizOption.create({
      data: {
        id: generateId(),
        quizId: day1Quiz.id,
        optionLabel: 'B',
        optionText: 'Because a strong parent–child connection builds trust, making kids willing to listen.',
        order: 2
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          id: generateId(),
          quizId: day1Quiz.id,
          optionLabel: 'A',
          optionText: 'Because kids only behave well when they\'re happy.',
          order: 1
        },
        {
          id: generateId(),
          quizId: day1Quiz.id,
          optionLabel: 'C',
          optionText: 'Because playtime is more fun than rules.',
          order: 3
        },
        {
          id: generateId(),
          quizId: day1Quiz.id,
          optionLabel: 'D',
          optionText: 'Because young children don\'t understand boundaries.',
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
    // DAY 2: The 3 Core Skills
    // ========================================================================

    console.log('📚 Processing Day 2...');
    const currentDay2 = await prisma.lesson.findFirst({
      where: {
        phase: 'CONNECT',
        dayNumber: 2
      },
      include: {
        LessonSegment: true,
        Quiz: {
          include: {
            QuizOption: true,
            QuizResponse: true
          }
        },
        UserLessonProgress: true
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
        id: generateId(),
        phase: 'CONNECT',
        phaseNumber: 1,
        dayNumber: 2,
        title: "The 3 Core Skills",
        subtitle: null,
        shortDescription: "Master the 3 core skills (Praise, Echo, Narrate) that make Special Play Time powerful and effective.",
        objectives: [
          'Learn the PEN skills (Praise, Echo, Narrate)',
          'Understand how each skill builds connection',
          'Practice using PEN skills during Special Play Time'
        ],
        estimatedMinutes: 5,
        isBooster: false,
        prerequisites: [day1Lesson.id],
        teachesCategories: ['PRAISE', 'ECHO', 'NARRATION'],
        dragonImageUrl: null,
        backgroundColor: '#E4F0FF',
        ellipse77Color: '#A6D4E0',
        ellipse78Color: '#B4E0CB',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('Creating Day 2 segments...');
    await prisma.lessonSegment.createMany({
      data: [
        {
          id: generateId(),
          lessonId: day2Lesson.id,
          order: 1,
          sectionTitle: 'Welcome Back',
          contentType: 'TEXT',
          bodyText: "Now that you know how **Special Play Time** works, today we learn the skills that make it powerful.\n\nThese skills help your child feel understood, confident, and connected. When kids feel these things, they listen better all day long.",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: generateId(),
          lessonId: day2Lesson.id,
          order: 2,
          sectionTitle: 'Meet PEN',
          contentType: 'TEXT',
          bodyText: "The 3 Core Skills are **Praise**, **Echo**, and **Narrate** (**PEN**).\n\nThey are adapted from evidence-based research but rewritten to be simple for real parents. Think of them as the \"ingredients\" that make Special Play Time effective.\n\nThese skills strengthen:\n• **Connection** (your child feels seen and valued)\n• **Attention** (your child stays focused longer)\n• **Cooperation** (children follow instructions more easily later)",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: generateId(),
          lessonId: day2Lesson.id,
          order: 3,
          sectionTitle: 'Skill 1 - Praise',
          contentType: 'TEXT',
          bodyText: "**Tell your child exactly what they are doing well.** Specific praise builds confidence and increases positive behavior.\n\n**Example:** \"I love how gently you are playing with the blocks!\"\n\n**Example:** \"Great job sharing!\"\n\n**Why:** Builds confidence, increases positive behavior\n\n💡 **Tip:** Praise the **specific action**, not the child's personality.",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: generateId(),
          lessonId: day2Lesson.id,
          order: 4,
          sectionTitle: 'Skill 2 - Echo',
          contentType: 'EXAMPLE',
          bodyText: "**Repeat or reflect what your child says.** It shows you are listening and builds language skills.\n\n👶 **Child:** \"The car is fast!\"\n👤 **You:** \"The car is fast!\"\n\n**Why:** It makes your child feel heard—and kids who feel heard cooperate more.\n\n💡 **Tip:** Repeat or reflect what your child says.",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: generateId(),
          lessonId: day2Lesson.id,
          order: 5,
          sectionTitle: 'Skill 3 - Narrate',
          contentType: 'TEXT',
          bodyText: "**Describe what your child is doing, like a sports commentator.**\n\n**Example:** \"You're stacking the blue block on the red one.\"\n\n**Why:** It keeps your child calm, focused, and engaged. It works even if they aren't talking much yet.\n\n💡 **Tip:** Narration works even if your child isn't talking much yet.",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: generateId(),
          lessonId: day2Lesson.id,
          order: 6,
          sectionTitle: 'Sample Script',
          contentType: 'SCRIPT',
          bodyText: "Try mixing them today:\n\n👤 \"You're lining up the cars.\" **(Narrate)**\n\n👶 **Child:** \"This one is fastest!\"\n👤 **You:** \"The fastest one!\" **(Echo)**\n\n👤 \"I love how focused you are.\" **(Praise)**\n\nJust be warm and follow their lead.",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
    });

    console.log('Creating Day 2 quiz...');
    const day2Quiz = await prisma.quiz.create({
      data: {
        id: generateId(),
        lessonId: day2Lesson.id,
        question: 'What is the main purpose of the "Echo" skill?',
        correctAnswer: 'temp',
        explanation: 'Echoing makes your child feel heard—and builds trust.',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    const day2OptionB = await prisma.quizOption.create({
      data: {
        id: generateId(),
        quizId: day2Quiz.id,
        optionLabel: 'B',
        optionText: 'To show your child you\'re listening and build trust.',
        order: 2
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          id: generateId(),
          quizId: day2Quiz.id,
          optionLabel: 'A',
          optionText: 'To correct what your child says.',
          order: 1
        },
        {
          id: generateId(),
          quizId: day2Quiz.id,
          optionLabel: 'C',
          optionText: 'To give instructions.',
          order: 3
        },
        {
          id: generateId(),
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
    // DAY 3: What NOT to Do
    // ========================================================================

    console.log('📚 Processing Day 3...');
    const currentDay3 = await prisma.lesson.findFirst({
      where: {
        phase: 'CONNECT',
        dayNumber: 3
      },
      include: {
        LessonSegment: true,
        Quiz: {
          include: {
            QuizOption: true,
            QuizResponse: true
          }
        },
        UserLessonProgress: true
      }
    });

    if (currentDay3) {
      console.log(`Found existing Day 3: "${currentDay3.title}"`);
      console.log(`Deleting...`);
      await prisma.lesson.delete({
        where: { id: currentDay3.id }
      });
      console.log('✅ Deleted\n');
    } else {
      console.log('No existing Day 3 found\n');
    }

    console.log('Creating new Day 3 lesson...');
    const day3Lesson = await prisma.lesson.create({
      data: {
        id: generateId(),
        phase: 'CONNECT',
        phaseNumber: 1,
        dayNumber: 3,
        title: "What NOT to Do",
        subtitle: null,
        shortDescription: "Learn the 3 habits to avoid during Special Play Time to keep your child in the lead.",
        objectives: [
          'Understand what to avoid during Special Play Time',
          'Learn why commands, questions, and criticism disrupt connection',
          'Practice letting your child lead'
        ],
        estimatedMinutes: 5,
        isBooster: false,
        prerequisites: [day2Lesson.id],
        teachesCategories: ['PRAISE', 'ECHO', 'NARRATION'],
        dragonImageUrl: null,
        backgroundColor: '#FFE4F0',
        ellipse77Color: '#E0A6D4',
        ellipse78Color: '#CBB4E0',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('Creating Day 3 segments...');
    await prisma.lessonSegment.createMany({
      data: [
        {
          id: generateId(),
          lessonId: day3Lesson.id,
          order: 1,
          sectionTitle: 'The Don\'t Skills',
          contentType: 'TEXT',
          bodyText: "To let connection grow, we must avoid 3 common habits during **Special Play Time**:\n\n• **No Commands**\n• **No Questions**\n• **No Criticism**\n\nThese aren't \"bad,\" but they pull your child out of the lead.",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: generateId(),
          lessonId: day3Lesson.id,
          order: 2,
          sectionTitle: 'No Commands',
          contentType: 'TEXT',
          bodyText: "**Rule:** Don't tell your child what to do.\n\n**Why:** Commands shift control back to you. When kids feel controlled, their creativity shrinks.\n\n**Instead of:** \"Put the blue block here.\"\n\n**Try:** \"I see you chose the green block!\"",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: generateId(),
          lessonId: day3Lesson.id,
          order: 3,
          sectionTitle: 'No Questions',
          contentType: 'TEXT',
          bodyText: "**Rule:** Avoid asking \"What's that?\" or \"Why?\"\n\n**Why:** Questions feel like little tests. They interrupt your child's flow and make them focus on answering you rather than playing.\n\n**Instead of:** \"What are you drawing?\"\n\n**Try:** \"You're drawing lots of circles!\"",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: generateId(),
          lessonId: day3Lesson.id,
          order: 4,
          sectionTitle: 'No Criticism',
          contentType: 'TEXT',
          bodyText: "**Rule:** No pointing out mistakes or teaching.\n\n**Why:** Even gentle corrections make a child feel judged. Special Play Time is for relationship-building, not skill-building.\n\n**Instead of:** \"That's not how you hold it.\"\n\n**Try:** \"You're holding it your own way.\"",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
    });

    console.log('Creating Day 3 quiz...');
    const day3Quiz = await prisma.quiz.create({
      data: {
        id: generateId(),
        lessonId: day3Lesson.id,
        question: 'Why do we avoid questions during Special Play Time?',
        correctAnswer: 'temp',
        explanation: 'Questions interrupt your child\'s flow and make them feel like they\'re being tested.',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    const day3OptionA = await prisma.quizOption.create({
      data: {
        id: generateId(),
        quizId: day3Quiz.id,
        optionLabel: 'A',
        optionText: 'They interrupt your child\'s lead and feel like little tests.',
        order: 1
      }
    });

    await prisma.quizOption.createMany({
      data: [
        {
          id: generateId(),
          quizId: day3Quiz.id,
          optionLabel: 'B',
          optionText: 'Kids don\'t like questions.',
          order: 2
        },
        {
          id: generateId(),
          quizId: day3Quiz.id,
          optionLabel: 'C',
          optionText: 'Parents get tired of asking.',
          order: 3
        },
        {
          id: generateId(),
          quizId: day3Quiz.id,
          optionLabel: 'D',
          optionText: 'Questions are confusing for young children.',
          order: 4
        }
      ]
    });

    await prisma.quiz.update({
      where: { id: day3Quiz.id },
      data: { correctAnswer: day3OptionA.id }
    });

    console.log('✅ Day 3 complete!\n');

    // ========================================================================
    // Summary
    // ========================================================================

    console.log('✅ Successfully replaced all three lessons!\n');
    console.log('📊 Summary:');
    console.log('\nDay 1:');
    console.log(`  Title: ${day1Lesson.title}`);
    console.log(`  Segments: 10`);
    console.log(`  Quiz: 1 question with 4 options`);
    console.log('\nDay 2:');
    console.log(`  Title: ${day2Lesson.title}`);
    console.log(`  Segments: 6`);
    console.log(`  Quiz: 1 question with 4 options`);
    console.log('\nDay 3:');
    console.log(`  Title: ${day3Lesson.title}`);
    console.log(`  Segments: 4`);
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
