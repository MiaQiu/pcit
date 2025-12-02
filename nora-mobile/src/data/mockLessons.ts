/**
 * Mock Lesson Data
 * Saved for testing and development purposes
 * Can be used when backend is unavailable
 */

import { LessonDetailResponse } from '@nora/core';
import { LessonCardProps } from '../components/LessonCard';
import { DRAGON_PURPLE } from '../constants/assets';

/**
 * Mock lessons for HomeScreen
 */
export const MOCK_HOME_LESSONS: LessonCardProps[] = [
  {
    id: '1',
    phase: 'PHASE',
    phaseName: 'Connect',
    title: 'Read your first 2-minute Lesson',
    subtitle: 'Start your journey',
    description: 'Lessons are short 2 min reads about how important connection is during playtime.',
    dragonImageUrl: DRAGON_PURPLE,
    backgroundColor: '#E4E4FF',
    ellipse77Color: '#9BD4DF', // Bottom ellipse - cyan
    ellipse78Color: '#A6E0CB', // Top ellipse - light green
    isLocked: false,
  },
  {
    id: '2',
    phase: 'PHASE',
    phaseName: 'Discipline',
    title: 'Read your first 2-minute Lesson',
    subtitle: 'Start your journey',
    description: 'Lessons are short 2 min reads about how important connection is during playtime.',
    dragonImageUrl: DRAGON_PURPLE,
    backgroundColor: '#FFE4C0',
    ellipse77Color: '#FFB380', // Bottom ellipse - orange
    ellipse78Color: '#A6E0CB', // Top ellipse - light green
    isLocked: true,
  },
];

/**
 * Mock lesson detail for LessonViewerScreen
 * @param lessonId - The lesson ID
 */
export const getMockLessonDetail = (lessonId: string): LessonDetailResponse => {
  return {
    lesson: {
      id: lessonId,
      phase: 'CONNECT',
      phaseNumber: 1,
      dayNumber: 1,
      title: 'The Power of Praise',
      subtitle: 'Why praise matters',
      shortDescription: 'Learn how praise shapes behavior',
      objectives: ['Understand the power of praise', 'Learn different types of praise'],
      estimatedMinutes: 2,
      isBooster: false,
      prerequisites: [],
      teachesCategories: ['PRAISE'],
      dragonImageUrl: 'https://example.com/dragon.png',
      backgroundColor: '#E4E4FF',
      ellipse77Color: '#9BD4DF',
      ellipse78Color: '#A6E0CB',
      segments: [
        {
          id: '1',
          lessonId,
          order: 1,
          sectionTitle: 'Introduction',
          contentType: 'TEXT',
          bodyText: 'When you praise your child for positive behaviors, you\'re not just making them feel good—you\'re teaching them what to do more of.\n\nSpecific praise like "I love how you shared your toy!" is more effective than general praise like "Good job!" because it shows your child exactly what they did right.\n\nThink of praise as fuel for their confidence and motivation to keep trying.',
        },
        {
          id: '2',
          lessonId,
          order: 2,
          sectionTitle: 'Types of Praise',
          contentType: 'EXAMPLE',
          bodyText: 'Labeled Praise: "I love how you put your toys away!"\nUnlabeled Praise: "Good job!"\n\nLabeled praise is more effective because it tells your child exactly what they did right.',
        },
        {
          id: '3',
          lessonId,
          order: 3,
          sectionTitle: 'Practice Tips',
          contentType: 'TIP',
          bodyText: 'Start with simple observations:\n• "You\'re sitting so nicely!"\n• "Great job sharing!"\n• "I love your gentle hands!"\n\nPractice during play time when behavior is positive.',
        },
      ],
      quiz: {
        id: 'quiz-1',
        lessonId,
        question: 'Which is a "Super-Praise"?',
        correctAnswer: 'option-2',
        explanation: 'It\'s specific, describes the behaviour, and shows positive attention.',
        options: [
          {
            id: 'option-1',
            optionLabel: 'A',
            optionText: 'You\'re so smart!',
            order: 1,
          },
          {
            id: 'option-2',
            optionLabel: 'B',
            optionText: 'You\'re using so many colors in that drawing!',
            order: 2,
          },
          {
            id: 'option-3',
            optionLabel: 'C',
            optionText: 'Good job!',
            order: 3,
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    userProgress: {
      id: 'progress-1',
      userId: 'user-1',
      lessonId,
      status: 'IN_PROGRESS',
      currentSegment: 1,
      totalSegments: 3,
      startedAt: new Date(),
      lastViewedAt: new Date(),
      timeSpentSeconds: 0,
    },
  };
};

/**
 * Mock streak data
 */
export const MOCK_STREAK_DATA = {
  streak: 6,
  completedDays: [true, true, true, true, true, true, false],
  dragonImageUrl: 'https://www.figma.com/api/mcp/asset/fb9ddced-cfdb-4414-a8e4-d1dcfb1b40d7',
};
