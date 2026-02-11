/**
 * Seed Module Table
 * Populate the Module table with all 19 modules
 *
 * Usage: node scripts/seed-modules.cjs
 */
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const MODULES = [
  {
    key: 'FOUNDATION',
    title: 'Foundational Module',
    shortName: 'Foundation',
    description: 'Core PCIT principles and the foundation for positive parent-child interaction.',
    displayOrder: 1,
    backgroundColor: '#E4E4FF',
  },
  {
    key: 'EMOTIONS',
    title: 'Managing Big Feelings & Tantrums',
    shortName: 'Emotions',
    description: 'Understanding and managing your child\'s big emotions and tantrums.',
    displayOrder: 2,
    backgroundColor: '#FFE4E4',
  },
  {
    key: 'COOPERATION',
    title: 'Not Listening & Arguing',
    shortName: 'Cooperation',
    description: 'Strategies for when your child isn\'t listening or argues back.',
    displayOrder: 3,
    backgroundColor: '#E4FFE4',
  },
  {
    key: 'SIBLINGS',
    title: 'Navigating a New Baby',
    shortName: 'Siblings',
    description: 'Helping your child adjust to a new sibling in the family.',
    displayOrder: 4,
    backgroundColor: '#FFE4FF',
  },
  {
    key: 'RELOCATION',
    title: 'Moving & School Changes',
    shortName: 'Moving',
    description: 'Supporting your child through moves and school transitions.',
    displayOrder: 5,
    backgroundColor: '#E4FFFF',
  },
  {
    key: 'DIVORCE',
    title: 'Navigating Parental Divorce',
    shortName: 'Divorce',
    description: 'Helping your child cope with separation or divorce.',
    displayOrder: 6,
    backgroundColor: '#FFF4E4',
  },
  {
    key: 'DEVELOPMENT',
    title: 'Social & Emotional Growth',
    shortName: 'Development',
    description: 'Supporting your child\'s social and emotional development.',
    displayOrder: 7,
    backgroundColor: '#E4F4FF',
  },
  {
    key: 'PROCRASTINATION',
    title: 'Stalling & Delaying',
    shortName: 'Stalling',
    description: 'Addressing procrastination and stalling behaviors.',
    displayOrder: 8,
    backgroundColor: '#F4E4FF',
  },
  {
    key: 'PATIENCE',
    title: 'Interrupting',
    shortName: 'Patience',
    description: 'Teaching your child about patience and not interrupting.',
    displayOrder: 9,
    backgroundColor: '#E4FFE8',
  },
  {
    key: 'RESPONSIBILITY',
    title: 'Carelessness & Destruction',
    shortName: 'Responsibility',
    description: 'Handling careless or destructive behavior.',
    displayOrder: 10,
    backgroundColor: '#FFE8E4',
  },
  {
    key: 'MEALS',
    title: 'Mealtime Troubles',
    shortName: 'Meals',
    description: 'Managing mealtime behavior challenges.',
    displayOrder: 11,
    backgroundColor: '#E8FFE4',
  },
  {
    key: 'AGGRESSION',
    title: 'Aggression & Outbursts',
    shortName: 'Aggression',
    description: 'Responding to aggressive behavior and outbursts.',
    displayOrder: 12,
    backgroundColor: '#FFE4E8',
  },
  {
    key: 'CONFLICT',
    title: 'Picking Fights & Provocation',
    shortName: 'Conflict',
    description: 'Dealing with children who pick fights or provoke others.',
    displayOrder: 13,
    backgroundColor: '#E4E8FF',
  },
  {
    key: 'FOCUS',
    title: 'Overactivity & Focus',
    shortName: 'Focus',
    description: 'Helping children with overactivity and focus challenges.',
    displayOrder: 14,
    backgroundColor: '#FFF0E4',
  },
  {
    key: 'DEFIANCE',
    title: 'Disobedience & Defiance',
    shortName: 'Defiance',
    description: 'Strategies for disobedient and defiant behavior.',
    displayOrder: 15,
    backgroundColor: '#F0E4FF',
  },
  {
    key: 'SAFETY',
    title: 'Problematic Sexual Behaviors',
    shortName: 'Safety',
    description: 'Understanding and responding to problematic sexual behaviors.',
    displayOrder: 16,
    backgroundColor: '#E4FFF0',
  },
  {
    key: 'SCREENS',
    title: 'Screen Transitions & Device Conflicts',
    shortName: 'Screens',
    description: 'Managing screen time transitions and device-related conflicts.',
    displayOrder: 17,
    backgroundColor: '#FFE4F0',
  },
  {
    key: 'SEPARATION',
    title: 'Separation Anxiety & School Transitions',
    shortName: 'Separation',
    description: 'Helping children with separation anxiety and school transitions.',
    displayOrder: 18,
    backgroundColor: '#E4F0FF',
  },
  {
    key: 'SPECIAL',
    title: 'Temperament',
    shortName: 'Temperament',
    description: 'Understanding your child\'s unique temperament across 8 areas.',
    displayOrder: 19,
    backgroundColor: '#F0FFE4',
  },
];

async function seedModules() {
  console.log('Seeding Module table...\n');

  for (const mod of MODULES) {
    const existing = await prisma.module.findUnique({
      where: { key: mod.key }
    });

    if (existing) {
      await prisma.module.update({
        where: { key: mod.key },
        data: {
          title: mod.title,
          shortName: mod.shortName,
          description: mod.description,
          displayOrder: mod.displayOrder,
          backgroundColor: mod.backgroundColor,
        }
      });
      console.log(`  Updated: ${mod.key} - ${mod.title}`);
    } else {
      await prisma.module.create({
        data: {
          id: crypto.randomUUID(),
          key: mod.key,
          title: mod.title,
          shortName: mod.shortName,
          description: mod.description,
          displayOrder: mod.displayOrder,
          backgroundColor: mod.backgroundColor,
        }
      });
      console.log(`  Created: ${mod.key} - ${mod.title}`);
    }
  }

  console.log(`\nDone! ${MODULES.length} modules seeded.`);
}

seedModules()
  .catch(e => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
