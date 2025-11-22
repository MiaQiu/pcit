import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Flame, Calendar, TrendingUp, Award } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import learningService from '../services/learningService';
import sessionService from '../services/sessionService';
import streakService from '../services/streakService';

const HomeScreen = ({ selectedDeck }) => {
  const { user } = useAuth();
  const [deckStarted, setDeckStarted] = useState(false);
  const [currentDeck, setCurrentDeck] = useState(selectedDeck || 1); // Which deck (1-15)
  const [currentCardInDeck, setCurrentCardInDeck] = useState(0); // Which card in the deck (0-3)
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [unlockedDecks, setUnlockedDecks] = useState(1); // How many decks are unlocked
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [latestCDISession, setLatestCDISession] = useState(null);
  const [latestPDISession, setLatestPDISession] = useState(null);
  const [cdiProgress, setCdiProgress] = useState(null);
  const [pdiProgress, setPdiProgress] = useState(null);

  // PCIT Learning Deck Content - 15 Decks with 4 Cards Each
  const learningDeck = [
    // DECK 1: Introduction of PCIT (Phase I)
    {
      title: "What is PCIT?",
      deck: 1,
      deckTitle: "Introduction of PCIT",
      phase: "Introduction",
      focus: "Strategy & Principle",
      content: "PCIT is an evidence-based treatment for disruptive behaviors in children (ages 2-7). The goal is to improve your relationship and your child's behavior.",
      tip: "Remember: This program is designed to help both you and your child grow together."
    },
    {
      title: "The Two Phases",
      deck: 1,
      deckTitle: "Introduction of PCIT",
      phase: "Introduction",
      focus: "PCIT Structure",
      content: "Phase 1: CDI (Child-Directed Interaction) - This is the Relationship Phase. You must master this first. Phase 2: PDI (Parent-Directed Interaction) - This is the Discipline Phase.",
      tip: "Build the relationship first, then add discipline - this is the key to PCIT success."
    },
    {
      title: "How to Influence Behavior",
      deck: 1,
      deckTitle: "Introduction of PCIT",
      phase: "Introduction",
      focus: "Core Behavior Principle",
      content: "Rule: Behaviors that are rewarded happen more often. Behaviors that are ignored happen less often. Rewards include praise, smiles, reading together, and stickers.",
      tip: "Focus on rewarding the behaviors you want to see more of!"
    },
    {
      title: "Why I Must Change",
      deck: 1,
      deckTitle: "Introduction of PCIT",
      phase: "Introduction",
      focus: "Anchor & Reflection",
      content: "I am the most important ingredient to my child's success. The 'Phase Myth' is false - behavior problems continue without help.",
      tip: "Action: Identify one parenting technique you are willing to adjust today."
    },

    // DECK 2: Introduction of CDI (Phase II)
    {
      title: "CDI: The Relationship Goal",
      deck: 2,
      deckTitle: "Introduction of CDI",
      phase: "CDI",
      focus: "Strategy & Principle",
      content: "Goal: Enhance positive interactions and reduce negative attention-seeking behaviors. You learn to pay attention to positive behaviors.",
      tip: "CDI is about building connection through positive attention."
    },
    {
      title: "The 5 'Do's",
      deck: 2,
      deckTitle: "Introduction of CDI",
      phase: "CDI",
      focus: "The PRIDE Skills",
      content: "P.R.I.D.E. is the key to CDI. Use these skills during 'Special Time' and throughout the day.",
      tip: "PRIDE = Praise, Reflect, Imitate, Describe, Enjoy"
    },
    {
      title: "Why CDI Works",
      deck: 2,
      deckTitle: "Introduction of CDI",
      phase: "CDI",
      focus: "Behavioral Impact",
      content: "When you attend to positive behavior, the child wants to please you more often. This changes the negative dynamic.",
      tip: "Positive attention creates a positive cycle in your relationship."
    },
    {
      title: "The CDI Mindset",
      deck: 2,
      deckTitle: "Introduction of CDI",
      phase: "CDI",
      focus: "Anchor & Reflection",
      content: "I am building a relationship that makes my child want to please me.",
      tip: "Action: Focus on noticing and mentally naming one PRIDE skill your child displays today."
    },

    // DECK 3: Praise (P)
    {
      title: "Praise: Labeled is Power",
      deck: 3,
      deckTitle: "Praise",
      phase: "CDI",
      focus: "Strategy & Principle",
      content: "Labeled Praise means being specific. It tells the child exactly what to do again.",
      tip: "Be specific with your praise - it's more powerful than general praise."
    },
    {
      title: "The Script & The Fix",
      deck: 3,
      deckTitle: "Praise",
      phase: "CDI",
      focus: "Specific Script & Mistake",
      content: "The Script: 'I like the way you drew that circle!' The Fix: Stop saying 'Good job!' - it's too vague to influence future behavior.",
      tip: "Replace vague praise with specific, labeled praise."
    },
    {
      title: "The Praise Multiplier",
      deck: 3,
      deckTitle: "Praise",
      phase: "CDI",
      focus: "Active Tool & Practice",
      content: "Use an enthusiastic, warm tone (Enjoyment). Pair praise with smiles (Social Reward).",
      tip: "Task: Use 5 Labeled Praises before dinner."
    },
    {
      title: "Anchor: My Daily Goal",
      deck: 3,
      deckTitle: "Praise",
      phase: "CDI",
      focus: "Daily Anchor & Reflection",
      content: "My praise is my power to increase good behavior.",
      tip: "Action: Set a reminder now to use 5 Labeled Praises before your next challenging time (e.g., transitions)."
    },

    // DECK 4: Reflecting (R)
    {
      title: "Reflecting: Show You're Listening",
      deck: 4,
      deckTitle: "Reflecting",
      phase: "CDI",
      focus: "Strategy & Principle",
      content: "Repeat or paraphrase what your child says. This shows you are truly listening.",
      tip: "Reflection is the most powerful way to show you hear your child."
    },
    {
      title: "The Script & The Benefit",
      deck: 4,
      deckTitle: "Reflecting",
      phase: "CDI",
      focus: "Specific Script & Benefit",
      content: "Child: 'I drive the car.' Your Script: 'You are driving the red car fast!' Benefit: It helps language development.",
      tip: "Add details when you reflect to expand language skills."
    },
    {
      title: "The Reflection Rule",
      deck: 4,
      deckTitle: "Reflecting",
      phase: "CDI",
      focus: "Active Tool & Practice",
      content: "Don't just nod. Use at least 3-4 words.",
      tip: "Action: Find 3 times today to reflect on a specific thing your child said or talked about."
    },
    {
      title: "Anchor: Listen Deeply",
      deck: 4,
      deckTitle: "Reflecting",
      phase: "CDI",
      focus: "Daily Anchor & Reflection",
      content: "I am listening and validating my child's world.",
      tip: "Action: When your child is talking, intentionally stop whatever you are doing and reflect their words back."
    },

    // DECK 5: Imitating (I)
    {
      title: "Imitating: The Approval Action",
      deck: 5,
      deckTitle: "Imitating",
      phase: "CDI",
      focus: "Strategy & Principle",
      content: "Do what your child is doing (Imitate). This shows approval of their play.",
      tip: "Imitation is a powerful non-verbal way to say 'I approve.'"
    },
    {
      title: "The Action & The Teaching",
      deck: 5,
      deckTitle: "Imitating",
      phase: "CDI",
      focus: "Specific Action & Benefit",
      content: "If they build a tower, you build a tower. Benefit: It teaches them how to play cooperatively.",
      tip: "Copy their actions to teach turn-taking and cooperation."
    },
    {
      title: "The Imitation Commitment",
      deck: 5,
      deckTitle: "Imitating",
      phase: "CDI",
      focus: "Active Tool & Practice",
      content: "Don't just watch passively.",
      tip: "Tool: Find a moment today to join their play and mirror their exact actions (e.g., draw the same lines)."
    },
    {
      title: "Anchor: Play Cooperatively",
      deck: 5,
      deckTitle: "Imitating",
      phase: "CDI",
      focus: "Daily Anchor & Reflection",
      content: "I am showing approval with my actions, not just words.",
      tip: "Reflection: How did my child react when I imitated them?"
    },

    // DECK 6: Describing (D)
    {
      title: "Describing: Be a Sportscaster",
      deck: 6,
      deckTitle: "Describing",
      phase: "CDI",
      focus: "Strategy & Principle",
      content: "Act like a sportscaster. Describe what the child is doing without asking questions.",
      tip: "Narrate their play like a sports announcer narrates a game."
    },
    {
      title: "The Script & The Teaching",
      deck: 6,
      deckTitle: "Describing",
      phase: "CDI",
      focus: "Specific Script & Benefit",
      content: "Your Script: 'You are putting the blue block on top.' Benefit: This holds the child's attention and teaches concepts.",
      tip: "Description increases attention span and teaches new vocabulary."
    },
    {
      title: "The Description Challenge",
      deck: 6,
      deckTitle: "Describing",
      phase: "CDI",
      focus: "Active Tool & Practice",
      content: "Avoid asking 'What are you doing?'",
      tip: "Action: Practice describing for 2 minutes straight, using only 'You are...' statements."
    },
    {
      title: "Anchor: The Attention Holder",
      deck: 6,
      deckTitle: "Describing",
      phase: "CDI",
      focus: "Daily Anchor & Reflection",
      content: "My words are holding their attention and teaching them without testing.",
      tip: "Describe, don't test - this keeps play flowing naturally."
    },

    // DECK 7: Enjoyment (E)
    {
      title: "Enjoyment: The Delivery",
      deck: 7,
      deckTitle: "Enjoyment",
      phase: "CDI",
      focus: "Strategy & Principle",
      content: "Show enthusiasm! Smile, use a warm tone. This enhances every other PRIDE skill.",
      tip: "Your positive energy is contagious - it makes play more rewarding."
    },
    {
      title: "Praise + Enjoyment",
      deck: 7,
      deckTitle: "Enjoyment",
      phase: "CDI",
      focus: "Integration Action",
      content: "Pair your Labeled Praise with a big smile and an enthusiastic voice. Example: 'Wow, I love how you shared that toy!'",
      tip: "Combine PRIDE skills for maximum impact."
    },
    {
      title: "The Non-Verbal Tool",
      deck: 7,
      deckTitle: "Enjoyment",
      phase: "CDI",
      focus: "Active Tool & Practice",
      content: "Find a moment to show enjoyment without words (e.g., a huge, warm smile or a happy nod).",
      tip: "Sometimes a smile says more than words."
    },
    {
      title: "Anchor: Positivity Focus",
      deck: 7,
      deckTitle: "Enjoyment",
      phase: "CDI",
      focus: "Daily Anchor & Reflection",
      content: "I am showing my child that being with me is positive and fun.",
      tip: "Action: Reflect on how your tone changed the interaction today."
    },

    // DECK 8: Avoid Command
    {
      title: "CDI Don't: Commands",
      deck: 8,
      deckTitle: "Avoid Command",
      phase: "CDI",
      focus: "Strategy & Principle",
      content: "Avoid Commands! Do not tell the child what to do during Special Time.",
      tip: "Let the child lead during CDI - save commands for PDI."
    },
    {
      title: "The Script & The Result",
      deck: 8,
      deckTitle: "Avoid Command",
      phase: "CDI",
      focus: "Specific Script & Conflict",
      content: "Don't say 'Put that there.' Reason: Commands can lead to conflict. In CDI, the child leads.",
      tip: "Commands during Special Time interrupt the child's leadership."
    },
    {
      title: "The Command Filter",
      deck: 8,
      deckTitle: "Avoid Command",
      phase: "CDI",
      focus: "Active Tool & Practice",
      content: "When you think of a command, filter it through a PRIDE skill instead.",
      tip: "Action: Replace one command with a Description today."
    },
    {
      title: "Anchor: Child-Led Play",
      deck: 8,
      deckTitle: "Avoid Command",
      phase: "CDI",
      focus: "Daily Anchor & Reflection",
      content: "I am stepping back to let my child lead the play.",
      tip: "Action: If you accidentally command, quickly correct yourself with a Reflection."
    },

    // DECK 9: Avoid Questions
    {
      title: "CDI Don't: Questions",
      deck: 9,
      deckTitle: "Avoid Questions",
      phase: "CDI",
      focus: "Strategy & Principle",
      content: "Avoid Questions! They interrupt the child's play flow.",
      tip: "Questions often feel like tests - avoid them during Special Time."
    },
    {
      title: "The Script & The Purpose",
      deck: 9,
      deckTitle: "Avoid Questions",
      phase: "CDI",
      focus: "Specific Script & Filter",
      content: "Don't ask 'What color is that?' Questions are often hidden commands testing the child.",
      tip: "Replace questions with descriptions to keep play flowing."
    },
    {
      title: "The Description Swap",
      deck: 9,
      deckTitle: "Avoid Questions",
      phase: "CDI",
      focus: "Active Tool & Practice",
      content: "Replace all questions with a Description. Example: Instead of asking, 'Is that a cat?', say, 'That looks like a cat!'",
      tip: "Turn every question into a statement."
    },
    {
      title: "Anchor: Observation Focus",
      deck: 9,
      deckTitle: "Avoid Questions",
      phase: "CDI",
      focus: "Daily Anchor & Reflection",
      content: "I am observing and describing, not testing.",
      tip: "Action: Ask zero questions for 10 minutes today."
    },

    // DECK 10: Avoid Criticism
    {
      title: "CDI Don't: Criticism",
      deck: 10,
      deckTitle: "Avoid Criticism",
      phase: "CDI",
      focus: "Strategy & Principle",
      content: "Avoid Criticism! Words like 'No,' 'Don't,' 'Stop,' or 'That's wrong' lower self-esteem.",
      tip: "Criticism during play damages the relationship you're building."
    },
    {
      title: "The Script & The Alternative",
      deck: 10,
      deckTitle: "Avoid Criticism",
      phase: "CDI",
      focus: "Specific Script & Impact",
      content: "Replace 'Stop hitting the table!' with a Description: 'You are tapping the table.' Then, praise another behavior.",
      tip: "Describe the behavior neutrally, then redirect with praise."
    },
    {
      title: "The Negative Filter",
      deck: 10,
      deckTitle: "Avoid Criticism",
      phase: "CDI",
      focus: "Active Tool & Practice",
      content: "Count how many times you say 'No' today.",
      tip: "Goal: Reduce that number tomorrow by using Praise instead."
    },
    {
      title: "Anchor: Positive Interaction",
      deck: 10,
      deckTitle: "Avoid Criticism",
      phase: "CDI",
      focus: "Daily Anchor & Reflection",
      content: "I am making the interaction positive and supporting their self-esteem.",
      tip: "Focus on what your child is doing right, not wrong."
    },

    // DECK 11: Introduction of PDI (Phase III)
    {
      title: "PDI: The Discipline Goal",
      deck: 11,
      deckTitle: "Introduction of PDI",
      phase: "PDI",
      focus: "Strategy & Principle",
      content: "PDI teaches a specific discipline sequence to handle disobedience. You learn effective discipline techniques.",
      tip: "PDI builds on the strong relationship you created in CDI."
    },
    {
      title: "When to Start PDI",
      deck: 11,
      deckTitle: "Introduction of PDI",
      phase: "PDI",
      focus: "The PDI Prerequisite",
      content: "Do NOT start PDI until you are comfortable with CDI. The relationship must be strong first.",
      tip: "Master CDI before moving to PDI - this is critical for success."
    },
    {
      title: "Overview of the Sequence",
      deck: 11,
      deckTitle: "Introduction of PDI",
      phase: "PDI",
      focus: "The PDI Protocol",
      content: "PDI teaches a specific sequence of Command -> Warning -> Time Out. Consistency is key.",
      tip: "Follow the sequence every time - consistency creates predictability."
    },
    {
      title: "Anchor: Sturdy Leadership",
      deck: 11,
      deckTitle: "Introduction of PDI",
      phase: "PDI",
      focus: "Anchor & Reflection",
      content: "I am moving from relationship building to setting firm boundaries.",
      tip: "Action: Read the 'Giving Effective Commands' section now."
    },

    // DECK 12: Effective Command
    {
      title: "Command: Direct and Positive",
      deck: 12,
      deckTitle: "Effective Command",
      phase: "PDI",
      focus: "Strategy & Principle",
      content: "Direct: Say 'Please hand me the block' (Command) rather than 'Will you...' (Question). Positive: Say what to do, not what not to do.",
      tip: "Make commands clear and positive - tell them what TO do."
    },
    {
      title: "Specific and Tone",
      deck: 12,
      deckTitle: "Effective Command",
      phase: "PDI",
      focus: "Specific Script & Fix",
      content: "Be clear: 'Put your shoes in the box.' Use a Normal Tone (calm and firm). Do not yell.",
      tip: "A calm, firm tone is more effective than yelling."
    },
    {
      title: "One-at-a-Time Rule",
      deck: 12,
      deckTitle: "Effective Command",
      phase: "PDI",
      focus: "Active Tool & Practice",
      content: "Don't string commands together. Give one at a time. Ensure the command is Developmentally Appropriate.",
      tip: "One command at a time sets your child up for success."
    },
    {
      title: "Anchor: Clarity First",
      deck: 12,
      deckTitle: "Effective Command",
      phase: "PDI",
      focus: "Anchor & Reflection",
      content: "My clarity sets my child up for success and obedience.",
      tip: "Action: Today, focus on using only one, positive, specific command at a time."
    },

    // DECK 13: The Command Sequence
    {
      title: "Step 1: The Command",
      deck: 13,
      deckTitle: "The Command Sequence",
      phase: "PDI",
      focus: "Strategy & Principle",
      content: "Give a direct, effective command. Wait 5 seconds silently. Do NOT talk or prompt during this 5-second wait.",
      tip: "The 5-second wait gives your child time to process and obey."
    },
    {
      title: "Step 2: The Reaction (Obey)",
      deck: 13,
      deckTitle: "The Command Sequence",
      phase: "PDI",
      focus: "Specific Script (Obedience)",
      content: "If Child Obeys: Give a Labeled Praise immediately. Script: 'Thank you for listening to mommy right away!'",
      tip: "Always praise obedience immediately - this reinforces listening."
    },
    {
      title: "Step 2: The Reaction (Disobey)",
      deck: 13,
      deckTitle: "The Command Sequence",
      phase: "PDI",
      focus: "Specific Action (Disobedience)",
      content: "If Child Disobeys: Proceed to the Chair Warning. You must follow through immediately.",
      tip: "Consistency means following through every time - no exceptions."
    },
    {
      title: "Anchor: The 5-Second Pause",
      deck: 13,
      deckTitle: "The Command Sequence",
      phase: "PDI",
      focus: "Anchor & Reflection",
      content: "I am calm and consistent in my 5-second waiting period.",
      tip: "Action: Practice the 5-second silence drill in your head today."
    },

    // DECK 14: Advanced Application 1 (Troubleshooting)
    {
      title: "Troubleshooting Escapes",
      deck: 14,
      deckTitle: "Advanced Application 1",
      phase: "PDI",
      focus: "Strategy & Principle",
      content: "If the child gets off the chair before time is up, put them back on the chair. The timer restarts.",
      tip: "Be prepared to restart the timer - consistency is everything."
    },
    {
      title: "The Restart Script",
      deck: 14,
      deckTitle: "Advanced Application 1",
      phase: "PDI",
      focus: "Specific Script (Escapes)",
      content: "Script: 'You got off the chair before I said you could, so your time-out starts over again.'",
      tip: "Use the same script every time for consistency."
    },
    {
      title: "Structuring the Environment",
      deck: 14,
      deckTitle: "Advanced Application 1",
      phase: "PDI",
      focus: "Active Tool & Action",
      content: "Set up clear House Rules. Keep PDI practice consistent (Routine).",
      tip: "Clear rules and consistent routines help children succeed."
    },
    {
      title: "Anchor: Consistency is Key",
      deck: 14,
      deckTitle: "Advanced Application 1",
      phase: "PDI",
      focus: "Anchor & Reflection",
      content: "Consistency in my actions creates predictability for my child.",
      tip: "Action: Review your House Rules today and ensure they are positive."
    },

    // DECK 15: Advanced Application 2
    {
      title: "Managing Behavior in Public",
      deck: 15,
      deckTitle: "Advanced Application 2",
      phase: "PDI",
      focus: "Strategy & Principle",
      content: "Prepare the child by stating the rules and the reward for good behavior before leaving.",
      tip: "Prevention is the best strategy for public settings."
    },
    {
      title: "Praise & Plan",
      deck: 15,
      deckTitle: "Advanced Application 2",
      phase: "PDI",
      focus: "Specific Action (Public)",
      content: "Praise the child in public for things like staying close or using inside voices. Plan: Know where your public time-out spot will be (e.g., in the car).",
      tip: "Always have a plan for time-out before entering public spaces."
    },
    {
      title: "Are You Ready to Graduate?",
      deck: 15,
      deckTitle: "Advanced Application 2",
      phase: "PDI",
      focus: "Graduation Check",
      content: "Check 1: Do you use PRIDE skills naturally throughout the day? Check 2: Does your child obey commands quickly?",
      tip: "Graduation means the skills have become second nature."
    },
    {
      title: "Anchor: Maintenance",
      deck: 15,
      deckTitle: "Advanced Application 2",
      phase: "PDI",
      focus: "Anchor & Reflection",
      content: "Our relationship feels stronger and less stressful. PCIT is complete.",
      tip: "Commit to continuing daily Special Time for skill maintenance."
    }
  ];

  // Get only the cards for the current deck
  const currentDeckCards = learningDeck.filter(card => card.deck === currentDeck);
  const currentDeckCard = currentDeckCards[currentCardInDeck];

  // Calculate which card within the current deck (1-4)
  const cardInDeck = currentCardInDeck + 1;

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentCardInDeck < currentDeckCards.length - 1) {
      setCurrentCardInDeck(currentCardInDeck + 1);
    }
    if (isRightSwipe && currentCardInDeck > 0) {
      setCurrentCardInDeck(currentCardInDeck - 1);
    }
  };

  const goToPrevCard = () => {
    if (currentCardInDeck > 0) {
      setCurrentCardInDeck(currentCardInDeck - 1);
    }
  };

  const goToNextCard = () => {
    if (currentCardInDeck < currentDeckCards.length - 1) {
      setCurrentCardInDeck(currentCardInDeck + 1);
    }
  };

  const completeDeck = async () => {
    try {
      // Unlock next deck if not already unlocked
      const newUnlockedDecks = currentDeck >= unlockedDecks && currentDeck < 15 ? currentDeck + 1 : unlockedDecks;
      const newCurrentDeck = currentDeck < 15 ? currentDeck + 1 : currentDeck;

      // Update in database
      await learningService.updateProgress(newCurrentDeck, newUnlockedDecks);

      // Update local state
      setUnlockedDecks(newUnlockedDecks);
      if (currentDeck < 15) {
        setCurrentDeck(newCurrentDeck);
        setCurrentCardInDeck(0);
        setDeckStarted(false);
      }
    } catch (error) {
      console.error('Failed to complete deck:', error);
      // Still update local state even if API fails
      if (currentDeck >= unlockedDecks && currentDeck < 15) {
        setUnlockedDecks(currentDeck + 1);
      }
      if (currentDeck < 15) {
        setCurrentDeck(currentDeck + 1);
        setCurrentCardInDeck(0);
        setDeckStarted(false);
      }
    }
  };

  // Calculate CDI mastery progress
  const calculateCDIProgress = (tagCounts) => {
    if (!tagCounts) return null;

    const criteria = {
      praise: { current: tagCounts.praise || 0, target: 10 },
      reflect: { current: tagCounts.reflect || 0, target: 10 },
      describe: { current: tagCounts.describe || 0, target: 10 },
      avoid: { current: tagCounts.totalAvoid || 0, target: 3 }
    };

    const praiseProgress = Math.min((criteria.praise.current / criteria.praise.target) * 100, 100);
    const reflectProgress = Math.min((criteria.reflect.current / criteria.reflect.target) * 100, 100);
    const describeProgress = Math.min((criteria.describe.current / criteria.describe.target) * 100, 100);
    // For avoid, it's inverted - lower is better
    const avoidProgress = criteria.avoid.current <= criteria.avoid.target ? 100 : Math.max(100 - ((criteria.avoid.current - criteria.avoid.target) * 20), 0);

    const overallProgress = (praiseProgress + reflectProgress + describeProgress + avoidProgress) / 4;

    return {
      criteria,
      overallProgress: Math.round(overallProgress),
      praiseProgress: Math.round(praiseProgress),
      reflectProgress: Math.round(reflectProgress),
      describeProgress: Math.round(describeProgress),
      avoidProgress: Math.round(avoidProgress)
    };
  };

  // Calculate PDI mastery progress
  const calculatePDIProgress = (tagCounts) => {
    if (!tagCounts) return null;

    const criteria = {
      directCommand: { current: tagCounts.direct_command || 0, target: 10 },
      labeledPraise: { current: tagCounts.labeled_praise || 0, target: 5 },
      effectivePercent: { current: tagCounts.effectivePercent || 0, target: 75 }
    };

    const directProgress = Math.min((criteria.directCommand.current / criteria.directCommand.target) * 100, 100);
    const praiseProgress = Math.min((criteria.labeledPraise.current / criteria.labeledPraise.target) * 100, 100);
    const effectiveProgress = Math.min((criteria.effectivePercent.current / criteria.effectivePercent.target) * 100, 100);

    const overallProgress = (directProgress + praiseProgress + effectiveProgress) / 3;

    return {
      criteria,
      overallProgress: Math.round(overallProgress),
      directProgress: Math.round(directProgress),
      praiseProgress: Math.round(praiseProgress),
      effectiveProgress: Math.round(effectiveProgress)
    };
  };

  // Load progress, sessions, and streak from database on mount
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const progress = await learningService.getProgress();
        // Only set from database if no selectedDeck was passed
        if (!selectedDeck) {
          setCurrentDeck(progress.currentDeck);
        }
        setUnlockedDecks(progress.unlockedDecks);
      } catch (error) {
        console.error('Failed to load progress:', error);
        // Keep default values (deck 1, unlocked 1) if API fails
      }
    };

    const loadSessions = async () => {
      try {
        const data = await sessionService.getSessions({ limit: 100 });
        setTotalSessions(data.total || 0);

        // Find latest CDI and PDI sessions
        const cdiSessions = data.sessions?.filter(s => s.mode === 'CDI') || [];
        const pdiSessions = data.sessions?.filter(s => s.mode === 'PDI') || [];

        if (cdiSessions.length > 0) {
          setLatestCDISession(cdiSessions[0]);
          setCdiProgress(calculateCDIProgress(cdiSessions[0].tagCounts));
        }

        if (pdiSessions.length > 0) {
          setLatestPDISession(pdiSessions[0]);
          setPdiProgress(calculatePDIProgress(pdiSessions[0].tagCounts));
        }
      } catch (error) {
        console.error('Failed to load sessions:', error);
      }
    };

    const loadStreak = async () => {
      try {
        const streakData = await streakService.getStreak();
        setStreak(streakData.currentStreak || 0);
        setLongestStreak(streakData.longestStreak || 0);
      } catch (error) {
        console.error('Failed to load streak:', error);
      }
    };

    loadProgress();
    loadSessions();
    loadStreak();
  }, [selectedDeck]);

  // Update current deck when selectedDeck changes
  useEffect(() => {
    if (selectedDeck) {
      setCurrentDeck(selectedDeck);
      setCurrentCardInDeck(0);
      setDeckStarted(true); // Automatically start the deck
    }
  }, [selectedDeck]);

  // Auto-unlock next deck when viewing last card
  useEffect(() => {
    const unlockNextDeck = async () => {
      if (currentCardInDeck === currentDeckCards.length - 1 && currentDeck >= unlockedDecks && currentDeck < 15) {
        try {
          // User has reached the last card of the deck, unlock next deck
          const newUnlockedDecks = currentDeck + 1;
          await learningService.updateProgress(currentDeck, newUnlockedDecks);
          setUnlockedDecks(newUnlockedDecks);
        } catch (error) {
          console.error('Failed to unlock next deck:', error);
          // Still update local state if API fails
          setUnlockedDecks(currentDeck + 1);
        }
      }
    };

    unlockNextDeck();
  }, [currentCardInDeck, currentDeck, unlockedDecks, currentDeckCards.length]);

  return (
    <div className="min-h-screen bg-purple-50 pb-24">
      <div className="px-6 pt-8">
        {/* Welcome Header with Streak */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Welcome back, {user?.name?.split(' ')[0] || 'Parent'}!
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>

            {/* Streak Badge */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  streak > 0 ? 'bg-gradient-to-br from-orange-400 to-red-500' : 'bg-gray-200'
                }`}>
                  {streak > 0 ? (
                    <Flame className="w-8 h-8 text-white" />
                  ) : (
                    <Calendar className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full px-2 py-0.5 shadow-md border-2 border-orange-400">
                  <span className="text-xs font-bold text-gray-800">{streak}</span>
                </div>
              </div>
              <p className="text-xs font-semibold text-gray-600 mt-1">
                {streak === 0 ? 'Start streak' : streak === 1 ? 'day' : 'days'}
              </p>
            </div>
          </div>

          {/* Streak Message */}
          {streak > 0 && (
            <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl p-3 mt-3">
              <p className="text-sm font-medium text-orange-800">
                {streak === 1
                  ? "Great start! Come back tomorrow to build your streak 🎯"
                  : streak < 7
                  ? `Amazing! You're on a ${streak}-day streak! Keep it going 🔥`
                  : `Incredible! ${streak} days strong! You're building lasting habits ⭐`
                }
              </p>
            </div>
          )}
        </div>

        {/* Today's Deck Header */}
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Today's Deck
          </h2>
        </div>

        {/* Learning Card */}
        {!deckStarted ? (
          // Preview State - Show title and Start button
          <div className="relative bg-gradient-to-br from-green-50 to-green-100 rounded-3xl shadow-lg overflow-hidden mb-6 p-6">
            {/* Deck Badge */}
            <div className="absolute top-4 right-4 bg-white rounded-full px-3 py-1 shadow-sm">
              <span className="text-xs font-bold text-green-600">
                DECK {currentDeckCard.deck}/15 • CARD {cardInDeck}/4
              </span>
            </div>

            <div className="pt-4">
              {/* Deck Title */}
              <div className="mb-2">
                <span className="inline-block bg-green-600 text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide">
                  {currentDeckCard.phase}
                </span>
              </div>
              <h3 className="text-3xl font-bold text-gray-800 mb-1">
                {currentDeckCard.deckTitle}
              </h3>
              <p className="text-lg text-gray-600 mb-3">
                {currentDeckCard.title}
              </p>

              {/* Progress Dots Preview */}
              <div className="flex items-center gap-2 mb-6">
                {currentDeckCards.map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 rounded-full ${
                      index === currentCardInDeck ? 'w-8 bg-green-600' : 'w-2 bg-green-300'
                    }`}
                  />
                ))}
              </div>

              {/* Start Button */}
              <button
                onClick={() => setDeckStarted(true)}
                className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-4 px-10 rounded-full shadow-md transition-all transform hover:scale-105 flex items-center gap-2"
              >
                Start Deck
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        ) : (
          // Full Deck State - Show swipeable cards with simple design
          <div
            className="relative mb-6"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* Top Section - Phase and Deck Title */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  LEARN
                </span>
                <span className="text-xs font-bold text-green-600">
                  DECK {currentDeckCard.deck}/15 • CARD {cardInDeck}/4
                </span>
              </div>
              <h3 className="text-xl font-bold text-gray-800">
                {currentDeckCard.deckTitle}
              </h3>
            </div>

            {/* Simple White Card with fixed height */}
            <div className="bg-white rounded-3xl shadow-lg p-8 mb-6 min-h-[420px] flex flex-col">
              {/* Card Title */}
              <h2 className="text-3xl font-bold text-gray-900 mb-6 leading-tight">
                {currentDeckCard.title}
              </h2>

              {/* Card Content - Scrollable if needed */}
              <div className="flex-1 overflow-y-auto mb-6">
                <p className="text-gray-700 text-lg leading-relaxed mb-5">
                  {currentDeckCard.content}
                </p>
                <p className="text-gray-600 text-base leading-relaxed italic">
                  {currentDeckCard.tip}
                </p>
              </div>

              {/* Progress Dots */}
              <div className="flex justify-center items-center gap-2 pt-4 border-t border-gray-100">
                {currentDeckCards.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentCardInDeck(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === currentCardInDeck
                        ? 'w-8 bg-green-600'
                        : 'w-2 bg-gray-300'
                    }`}
                    aria-label={`Go to card ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Navigation Section */}
            <div className="flex justify-between items-center mb-4">
              <button
                onClick={goToPrevCard}
                disabled={currentCardInDeck === 0}
                className={`p-3 rounded-full transition-all ${
                  currentCardInDeck === 0
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-green-600 hover:bg-green-100'
                }`}
                aria-label="Previous card"
              >
                <ChevronLeft size={28} />
              </button>

              {/* Center Button */}
              {currentCardInDeck === currentDeckCards.length - 1 && currentDeck < 15 ? (
                <button
                  onClick={completeDeck}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-full shadow-md transition-all"
                >
                  Complete Deck
                </button>
              ) : currentCardInDeck === currentDeckCards.length - 1 && currentDeck === 15 ? (
                <button
                  onClick={() => setDeckStarted(false)}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-full shadow-md transition-all"
                >
                  Finish
                </button>
              ) : (
                <button
                  onClick={() => setDeckStarted(false)}
                  className="text-gray-500 hover:text-gray-700 font-medium py-3 px-6 transition-all"
                >
                  Close
                </button>
              )}

              <button
                onClick={goToNextCard}
                disabled={currentCardInDeck === currentDeckCards.length - 1}
                className={`p-3 rounded-full transition-all ${
                  currentCardInDeck === currentDeckCards.length - 1
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-green-600 hover:bg-green-100'
                }`}
                aria-label="Next card"
              >
                <ChevronRight size={28} />
              </button>
            </div>

            {/* Previous Card Button */}
            <button
              onClick={() => setDeckStarted(false)}
              className="w-full py-4 text-sm font-semibold text-gray-500 uppercase tracking-wide"
            >
              Close Deck
            </button>
          </div>
        )}

        {/* CDI Mastery Progress */}
        {cdiProgress && (
          <div className="mb-6">
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-md font-bold text-gray-800">CDI Mastery Progress</h3>
                    <p className="text-xs text-gray-500">Your latest CDI session</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">{cdiProgress.overallProgress}%</div>
                  <p className="text-xs text-gray-500">Overall</p>
                </div>
              </div>

              {/* Overall Progress Bar */}
              <div className="mb-4">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      cdiProgress.overallProgress >= 100 ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-green-500'
                    }`}
                    style={{ width: `${cdiProgress.overallProgress}%` }}
                  ></div>
                </div>
              </div>

              {/* Individual Skills */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">Labeled Praise</span>
                    <span className="font-medium">
                      {cdiProgress.criteria.praise.current}/{cdiProgress.criteria.praise.target}
                      {cdiProgress.criteria.praise.current >= cdiProgress.criteria.praise.target && ' ✓'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-400 h-2 rounded-full transition-all"
                      style={{ width: `${cdiProgress.praiseProgress}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">Reflection</span>
                    <span className="font-medium">
                      {cdiProgress.criteria.reflect.current}/{cdiProgress.criteria.reflect.target}
                      {cdiProgress.criteria.reflect.current >= cdiProgress.criteria.reflect.target && ' ✓'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-400 h-2 rounded-full transition-all"
                      style={{ width: `${cdiProgress.reflectProgress}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">Description</span>
                    <span className="font-medium">
                      {cdiProgress.criteria.describe.current}/{cdiProgress.criteria.describe.target}
                      {cdiProgress.criteria.describe.current >= cdiProgress.criteria.describe.target && ' ✓'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-400 h-2 rounded-full transition-all"
                      style={{ width: `${cdiProgress.describeProgress}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">Avoid Skills</span>
                    <span className="font-medium">
                      {cdiProgress.criteria.avoid.current}/{cdiProgress.criteria.avoid.target} or less
                      {cdiProgress.criteria.avoid.current <= cdiProgress.criteria.avoid.target && ' ✓'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-orange-400 h-2 rounded-full transition-all"
                      style={{ width: `${cdiProgress.avoidProgress}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Mastery Message */}
              {cdiProgress.overallProgress >= 100 ? (
                <div className="mt-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 rounded-lg p-3 flex items-center gap-2">
                  <Award className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <p className="text-sm font-medium text-green-800">
                    Congratulations! You've achieved CDI mastery! Ready for PDI? 🎉
                  </p>
                </div>
              ) : (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    Keep practicing! You're {100 - cdiProgress.overallProgress}% away from CDI mastery.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PDI Mastery Progress */}
        {pdiProgress && (
          <div className="mb-6">
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-md font-bold text-gray-800">PDI Mastery Progress</h3>
                    <p className="text-xs text-gray-500">Your latest PDI session</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-purple-600">{pdiProgress.overallProgress}%</div>
                  <p className="text-xs text-gray-500">Overall</p>
                </div>
              </div>

              {/* Overall Progress Bar */}
              <div className="mb-4">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      pdiProgress.overallProgress >= 100 ? 'bg-gradient-to-r from-purple-500 to-indigo-600' : 'bg-purple-500'
                    }`}
                    style={{ width: `${pdiProgress.overallProgress}%` }}
                  ></div>
                </div>
              </div>

              {/* Individual Skills */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">Direct Commands</span>
                    <span className="font-medium">
                      {pdiProgress.criteria.directCommand.current}/{pdiProgress.criteria.directCommand.target}
                      {pdiProgress.criteria.directCommand.current >= pdiProgress.criteria.directCommand.target && ' ✓'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-400 h-2 rounded-full transition-all"
                      style={{ width: `${pdiProgress.directProgress}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">Labeled Praise</span>
                    <span className="font-medium">
                      {pdiProgress.criteria.labeledPraise.current}/{pdiProgress.criteria.labeledPraise.target}
                      {pdiProgress.criteria.labeledPraise.current >= pdiProgress.criteria.labeledPraise.target && ' ✓'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-400 h-2 rounded-full transition-all"
                      style={{ width: `${pdiProgress.praiseProgress}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">Effective Commands</span>
                    <span className="font-medium">
                      {pdiProgress.criteria.effectivePercent.current}%/{pdiProgress.criteria.effectivePercent.target}%
                      {pdiProgress.criteria.effectivePercent.current >= pdiProgress.criteria.effectivePercent.target && ' ✓'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-400 h-2 rounded-full transition-all"
                      style={{ width: `${pdiProgress.effectiveProgress}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Mastery Message */}
              {pdiProgress.overallProgress >= 100 ? (
                <div className="mt-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-300 rounded-lg p-3 flex items-center gap-2">
                  <Award className="w-5 h-5 text-purple-600 flex-shrink-0" />
                  <p className="text-sm font-medium text-purple-800">
                    Amazing! You've achieved PDI mastery! 🎉
                  </p>
                </div>
              ) : (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    Keep practicing! You're {100 - pdiProgress.overallProgress}% away from PDI mastery.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* More For You Section */}
        {/* <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            More For You
          </h2>
        </div> */}

        {/* Quick Tips Cards */}
        {/* <div className="space-y-3">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h4 className="font-bold text-gray-800 mb-2">📊 Track Your Progress</h4>
            <p className="text-sm text-gray-600">
              Record a 5-minute play session today to see how many PRIDE skills you're using!
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h4 className="font-bold text-gray-800 mb-2">🎯 Weekly Goal</h4>
            <p className="text-sm text-gray-600">
              Aim for a 3:1 ratio of positive attention (praise, descriptions) to corrections.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h4 className="font-bold text-gray-800 mb-2">⭐ CDI Best Practice</h4>
            <p className="text-sm text-gray-600">
              During Child-Directed Interaction, let your child lead the play. Follow their interests!
            </p>
          </div>
        </div> */}
      </div>
    </div>
  );
};

export default HomeScreen;
