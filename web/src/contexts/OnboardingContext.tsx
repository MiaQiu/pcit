import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface WacbAnswers {
  parentingStressLevel?: number;
  q1Dawdle?: number;
  q2Disobey?: number;
  q3Tantrum?: number;
  q4Defiance?: number;
  q5FocusDemand?: number;
  q6Restless?: number;
  q7TaskCompletion?: number;
  q8Destroy?: number;
  q9Aggression?: number;
  q10LieSteal?: number;
}

export interface PlanDiscountInfo {
  label: string;
  percentOff: number | null;
  amountOff: number | null; // cents
}

// Custom copy for the signup screens (landing, create account, success). Any field may be
// null, meaning "use the default copy".
export interface SignupLanding {
  headline: string | null;
  subtext: string | null;
  ctaText: string | null;
  imageUrl: string | null; // presigned, ~1h — fall back to the default image on load error
  accountTitle: string | null;
  accountSubtitle: string | null;
  successTitle: string | null;
  successSubtitle: string | null;
}

export interface PartnerInfo {
  slug: string;
  // Public display name for the subscribe page; null for a campaign without one.
  name: string | null;
  kind?: 'PARTNER' | 'CAMPAIGN';
  // Campaign attribution: message variant (/p/:slug/:messageKey) and channel (?src=).
  messageKey?: string | null;
  source?: string | null;
  skipSubscription?: boolean; // campaign option: skip /subscribe, go straight to /success
  accountLast?: boolean; // ask for the account at the end of onboarding instead of the start
  landing?: SignupLanding | null;
  // Campaign rules behind the create-account consent checkbox (campaigns only).
  campaignRules?: { title: string | null; content: string } | null;
  welcomeMessage: string | null;
  trialDays: number;
  plans: ('monthly' | 'yearly')[];
  discounts: {
    monthly: PlanDiscountInfo | null;
    yearly: PlanDiscountInfo | null;
  };
}

export interface OnboardingData {
  // auth
  email: string;
  password: string;
  accessToken: string | null;
  // partner (set when user arrived via /p/:slug)
  partnerInfo: PartnerInfo | null;
  // referral (set when user arrived via /join/:code) — partnerInfo also holds
  // the referral trial config; these carry the attribution code + who invited.
  referralCode: string | null;
  referrerName: string | null;
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
  // anonymous server-side progress record (account-last links only)
  signupDraftId: string | null;
}

interface OnboardingContextValue {
  data: OnboardingData;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  setAccessToken: (token: string | null) => void;
  setPartnerInfo: (info: PartnerInfo | null) => void;
  setReferral: (code: string | null, referrerName?: string | null) => void;
  setName: (name: string) => void;
  setRelationshipToChild: (rel: string | null) => void;
  setChildName: (name: string) => void;
  setChildGender: (gender: string | null) => void;
  setChildBirthday: (date: Date | null) => void;
  setIssue: (issues: string[]) => void;
  setIssueOther: (other: string) => void;
  setWacbAnswer: (key: keyof WacbAnswers, value: number) => void;
  setSignupDraftId: (id: string | null) => void;
  clearAnswers: () => void;
}

function loadPartnerInfo(): PartnerInfo | null {
  try {
    const raw = localStorage.getItem('partnerInfo');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Onboarding answers are kept in sessionStorage (this tab only) so a refresh doesn't lose
// them — with the account at the end of the flow (account-last links), nothing reaches the
// server until signup. Cleared after an account-last signup/login.
const ANSWERS_KEY = 'onboardingAnswers';
type Answers = Pick<OnboardingData,
  'name' | 'relationshipToChild' | 'childName' | 'childGender' | 'childBirthday' |
  'issue' | 'issueOther' | 'wacb' | 'signupDraftId'>;

const emptyAnswers: Answers = {
  name: '',
  relationshipToChild: null,
  childName: '',
  childGender: null,
  childBirthday: null,
  issue: [],
  issueOther: '',
  wacb: {},
  signupDraftId: null,
};

function loadAnswers(): Answers {
  try {
    const raw = sessionStorage.getItem(ANSWERS_KEY);
    if (!raw) return emptyAnswers;
    const saved = JSON.parse(raw);
    return {
      ...emptyAnswers,
      ...saved,
      childBirthday: saved.childBirthday ? new Date(saved.childBirthday) : null,
    };
  } catch {
    return emptyAnswers;
  }
}

const defaultData: OnboardingData = {
  email: '',
  password: '',
  accessToken: localStorage.getItem('accessToken'),
  partnerInfo: loadPartnerInfo(),
  referralCode: localStorage.getItem('referralCode'),
  referrerName: localStorage.getItem('referrerName'),
  ...loadAnswers(),
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<OnboardingData>(defaultData);

  useEffect(() => {
    if (data.accessToken) localStorage.setItem('accessToken', data.accessToken);
    else localStorage.removeItem('accessToken');
  }, [data.accessToken]);

  useEffect(() => {
    if (data.partnerInfo) localStorage.setItem('partnerInfo', JSON.stringify(data.partnerInfo));
    else localStorage.removeItem('partnerInfo');
  }, [data.partnerInfo]);

  useEffect(() => {
    if (data.referralCode) localStorage.setItem('referralCode', data.referralCode);
    else localStorage.removeItem('referralCode');
  }, [data.referralCode]);

  useEffect(() => {
    if (data.referrerName) localStorage.setItem('referrerName', data.referrerName);
    else localStorage.removeItem('referrerName');
  }, [data.referrerName]);

  useEffect(() => {
    const answers: Answers = {
      name: data.name,
      relationshipToChild: data.relationshipToChild,
      childName: data.childName,
      childGender: data.childGender,
      childBirthday: data.childBirthday,
      issue: data.issue,
      issueOther: data.issueOther,
      wacb: data.wacb,
      signupDraftId: data.signupDraftId,
    };
    try {
      sessionStorage.setItem(ANSWERS_KEY, JSON.stringify(answers)); // Date → ISO string
    } catch {
      // Storage unavailable (private mode, quota) — answers just won't survive a refresh.
    }
  }, [data.name, data.relationshipToChild, data.childName, data.childGender, data.childBirthday,
      data.issue, data.issueOther, data.wacb, data.signupDraftId]);

  const setEmail = useCallback((email: string) => setData(d => ({ ...d, email })), []);
  const setPassword = useCallback((password: string) => setData(d => ({ ...d, password })), []);
  const setAccessToken = useCallback((accessToken: string | null) => setData(d => ({ ...d, accessToken })), []);
  const setPartnerInfo = useCallback((partnerInfo: PartnerInfo | null) => setData(d => ({ ...d, partnerInfo })), []);
  const setReferral = useCallback(
    (referralCode: string | null, referrerName: string | null = null) =>
      setData(d => ({ ...d, referralCode, referrerName })),
    []
  );
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
  const setSignupDraftId = useCallback((signupDraftId: string | null) => setData(d => ({ ...d, signupDraftId })), []);
  const clearAnswers = useCallback(() => setData(d => ({ ...d, ...emptyAnswers })), []);

  return (
    <OnboardingContext.Provider value={{
      data,
      setEmail,
      setPassword,
      setAccessToken,
      setPartnerInfo,
      setReferral,
      setName,
      setRelationshipToChild,
      setChildName,
      setChildGender,
      setChildBirthday,
      setIssue,
      setIssueOther,
      setWacbAnswer,
      setSignupDraftId,
      clearAnswers,
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

// Partner/campaign links with accountLast on ask for the account at the end of onboarding
// (before /subscribe) instead of the start. Referral links also set partnerInfo, so they're
// excluded explicitly. See doc/implementation/account-last-signup.md.
export function accountLast(d: OnboardingData): boolean {
  return !!d.partnerInfo?.accountLast && !d.referralCode;
}

// Where the onboarding screens hand off to (Intro3 "Skip for Now", PlaySession5 "Continue").
export function afterOnboardingPath(d: OnboardingData): string {
  return accountLast(d) && !d.accessToken ? '/create-account' : '/subscribe';
}

// Like the mobile app, "Other" is sent as the parent's own text in place of 'other'.
export function resolvedIssues(d: OnboardingData): string[] {
  return d.issue.includes('other')
    ? d.issue.filter(v => v !== 'other').concat(d.issueOther.trim()).filter(Boolean)
    : d.issue;
}

// WACB scoring
const VALUE_TO_POINTS: Record<number, number> = { 1: 0, 2: 2, 3: 4, 4: 6, 5: 7 };

const SNAPSHOT_ITEMS = [
  'q1Dawdle', 'q2Disobey', 'q3Tantrum', 'q4Defiance', 'q5FocusDemand',
  'q6Restless', 'q7TaskCompletion', 'q8Destroy', 'q9Aggression', 'q10LieSteal',
] as const;

export function isWacbComplete(wacb: WacbAnswers): boolean {
  return SNAPSHOT_ITEMS.every(key => wacb[key] !== undefined);
}

// Sums only the 10 survey items (0–70) — parentingStressLevel is not part of the score.
export function computeWacbScore(wacb: WacbAnswers): number {
  return SNAPSHOT_ITEMS.reduce((sum, key) => {
    const val = wacb[key];
    if (val === undefined) return sum;
    return sum + (VALUE_TO_POINTS[val] ?? 0);
  }, 0);
}

export type BehaviorCategory = 'stable' | 'mild' | 'medium' | 'high';

export function getBehaviorCategory(score: number): BehaviorCategory {
  if (score <= 28) return 'stable';
  if (score <= 39) return 'mild';
  if (score <= 50) return 'medium';
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

// Copy mirrors the mobile app (nora-mobile/src/i18n/locales/en.json →
// onboarding.childBehaviorProfile.categories). Keep the two in sync.
export function getBehaviorProfile(category: BehaviorCategory): BehaviorProfile {
  switch (category) {
    case 'stable':
      return {
        category,
        label: 'On Track',
        color: '#16A34A',
        bgColor: '#DCFCE7',
        whatItMeans: "Your child is generally managing emotions, attention, and behavior in an age-appropriate way.",
        startingPlan: "Spend 5 minutes a day in Emotional Massage — a simple child-led play where you follow your child's lead and stay fully present.\n\nA small moment that strengthens connection and supports positive behavior.",
        whatToExpect: "You may begin to notice subtle shifts within a few weeks.\nOver time, you'll also learn how to support emotions and set gentle boundaries.",
      };
    case 'mild':
      return {
        category,
        label: 'Needs Some Support',
        color: '#CA8A04',
        bgColor: '#FEF9C3',
        whatItMeans: "Your child may sometimes struggle with listening, managing emotions, or staying focused in daily situations.\nSmall challenges are common at this age. With the right support, they can improve quickly.",
        startingPlan: "Spend 5 minutes a day in Emotional Massage — a simple child-led play where you follow your child's lead and strengthen your connection — and helps reduce behavior struggles over time.",
        whatToExpect: "Many families notice changes within 2–3 weeks.\nFrom there, we'll guide you through emotions and boundaries.",
      };
    case 'medium':
      return {
        category,
        label: 'Needs More Support',
        color: '#EA580C',
        bgColor: '#FFEDD5',
        whatItMeans: "Your child may frequently have difficulty with emotions, focus, or cooperation during everyday moments.\nSome moments may feel more challenging right now. With consistent support, meaningful progress is very possible.",
        startingPlan: "Begin with 5 minutes a day of Emotional Massage — following your child's lead in a calm, focused way.\n\nConnection is where change begins — and supports better behavior over time.",
        whatToExpect: "With consistency, progress often starts within a few weeks.\nYou'll be guided through emotions, boundaries, and everyday situations.",
      };
    case 'high':
      return {
        category,
        label: 'Needs Extra Support',
        color: '#DC2626',
        bgColor: '#FEE2E2',
        whatItMeans: "Your child may be having difficulty managing emotions or staying focused in daily situations.\nYou're not alone — many families go through this. With the right support, positive change can happen.",
        startingPlan: "Begin with 5 minutes a day of Emotional Massage — gently following your child's lead and staying present with them.\n\nThis creates a safe foundation for change and supports behavior over time.",
        whatToExpect: "Small changes can begin within a few weeks.\nWe'll guide you closely through emotions, boundaries, and daily challenges.",
      };
  }
}
