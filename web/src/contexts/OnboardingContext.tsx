import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface WacbAnswers {
  parentingStressLevel?: number;
  q1Dawdle?: number;
  q2MealBehavior?: number;
  q3Disobey?: number;
  q4Angry?: number;
  q5Scream?: number;
  q6Destroy?: number;
  q7ProvokeFights?: number;
  q8Interrupt?: number;
  q9Attention?: number;
}

export interface OnboardingData {
  // auth
  email: string;
  password: string;
  accessToken: string | null;
  // profile
  name: string;
  relationshipToChild: string | null;
  childName: string;
  childGender: string | null;
  childBirthday: Date | null;
  issue: string[];
  issueOther: string;
  // wacb
  wacb: WacbAnswers;
}

interface OnboardingContextValue {
  data: OnboardingData;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  setAccessToken: (token: string | null) => void;
  setName: (name: string) => void;
  setRelationshipToChild: (rel: string | null) => void;
  setChildName: (name: string) => void;
  setChildGender: (gender: string | null) => void;
  setChildBirthday: (date: Date | null) => void;
  setIssue: (issues: string[]) => void;
  setIssueOther: (other: string) => void;
  setWacbAnswer: (key: keyof WacbAnswers, value: number) => void;
}

const defaultData: OnboardingData = {
  email: '',
  password: '',
  accessToken: localStorage.getItem('accessToken'),
  name: '',
  relationshipToChild: null,
  childName: '',
  childGender: null,
  childBirthday: null,
  issue: [],
  issueOther: '',
  wacb: {},
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<OnboardingData>(defaultData);

  // Persist accessToken to localStorage whenever it changes
  useEffect(() => {
    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
    } else {
      localStorage.removeItem('accessToken');
    }
  }, [data.accessToken]);

  const setEmail = useCallback((email: string) => setData(d => ({ ...d, email })), []);
  const setPassword = useCallback((password: string) => setData(d => ({ ...d, password })), []);
  const setAccessToken = useCallback((accessToken: string | null) => setData(d => ({ ...d, accessToken })), []);
  const setName = useCallback((name: string) => setData(d => ({ ...d, name })), []);
  const setRelationshipToChild = useCallback((relationshipToChild: string | null) => setData(d => ({ ...d, relationshipToChild })), []);
  const setChildName = useCallback((childName: string) => setData(d => ({ ...d, childName })), []);
  const setChildGender = useCallback((childGender: string | null) => setData(d => ({ ...d, childGender })), []);
  const setChildBirthday = useCallback((childBirthday: Date | null) => setData(d => ({ ...d, childBirthday })), []);
  const setIssue = useCallback((issue: string[]) => setData(d => ({ ...d, issue })), []);
  const setIssueOther = useCallback((issueOther: string) => setData(d => ({ ...d, issueOther })), []);
  const setWacbAnswer = useCallback((key: keyof WacbAnswers, value: number) => {
    setData(d => ({ ...d, wacb: { ...d.wacb, [key]: value } }));
  }, []);

  return (
    <OnboardingContext.Provider value={{
      data,
      setEmail,
      setPassword,
      setAccessToken,
      setName,
      setRelationshipToChild,
      setChildName,
      setChildGender,
      setChildBirthday,
      setIssue,
      setIssueOther,
      setWacbAnswer,
    }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}

// WACB scoring
const VALUE_TO_POINTS: Record<number, number> = { 1: 0, 2: 2, 3: 4, 4: 6, 5: 7 };

export function computeWacbScore(wacb: WacbAnswers): number {
  return Object.values(wacb).reduce((sum, val) => {
    if (val === undefined) return sum;
    return sum + (VALUE_TO_POINTS[val] ?? 0);
  }, 0);
}

export type BehaviorCategory = 'stable' | 'mild' | 'medium' | 'high';

export function getBehaviorCategory(score: number): BehaviorCategory {
  if (score <= 25) return 'stable';
  if (score <= 35) return 'mild';
  if (score <= 45) return 'medium';
  return 'high';
}

export interface BehaviorProfile {
  category: BehaviorCategory;
  label: string;
  color: string;
  bgColor: string;
  whatItMeans: string;
  startingPlan: string;
  whatToExpect: string;
}

export function getBehaviorProfile(category: BehaviorCategory): BehaviorProfile {
  switch (category) {
    case 'stable':
      return {
        category,
        label: 'On Track',
        color: '#16A34A',
        bgColor: '#DCFCE7',
        whatItMeans: "Your child's behavior is generally well-regulated and age-appropriate. They show good self-control and emotional resilience for their developmental stage.",
        startingPlan: "We'll focus on strengthening your connection through play, building on the positive foundation you've already established, and giving you tools to maintain this healthy development.",
        whatToExpect: "You'll see continued growth in your child's confidence, communication, and social skills. Our daily 5-minute play sessions will deepen your bond and keep development on track.",
      };
    case 'mild':
      return {
        category,
        label: 'Needs Some Support',
        color: '#CA8A04',
        bgColor: '#FEF9C3',
        whatItMeans: "Your child shows some behavioral challenges that are common and very manageable. With the right guidance, these patterns can shift quickly.",
        startingPlan: "We'll introduce structured play techniques that give your child healthy ways to express emotions, and coach you on responding in ways that reduce challenging behaviors.",
        whatToExpect: "Most families see noticeable improvement within 2–4 weeks. Consistent 5-minute daily play sessions make a significant difference in emotional regulation.",
      };
    case 'medium':
      return {
        category,
        label: 'Needs More Support',
        color: '#EA580C',
        bgColor: '#FFEDD5',
        whatItMeans: "Your child is experiencing some behavioral difficulties that would benefit from consistent, targeted support. This is more common than you might think.",
        startingPlan: "We'll prioritize techniques from Child-Parent Relationship Therapy (CPRT) to help your child feel more secure, which naturally reduces behavioral challenges over time.",
        whatToExpect: "With regular practice, you'll start to see meaningful changes in 3–6 weeks. Our AI coaching will help you identify patterns and give you precise, actionable guidance.",
      };
    case 'high':
      return {
        category,
        label: 'Needs Extra Support',
        color: '#DC2626',
        bgColor: '#FEE2E2',
        whatItMeans: "Your child is showing significant behavioral challenges. This is a signal that they need more support, and so do you — and that's exactly what Nora is here for.",
        startingPlan: "We'll start with foundational connection-building exercises and work up to evidence-based behavioral strategies. You'll get daily coaching tailored to your specific situation.",
        whatToExpect: "Change takes time, but you'll start feeling more confident and less overwhelmed within the first week. Consistent engagement with Nora leads to measurable improvement in most families within 4–8 weeks.",
      };
  }
}
