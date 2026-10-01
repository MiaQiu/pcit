export const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const data = await res.json();
      message = data.message || data.error || message;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

// Auth endpoints
export interface AuthResponse {
  accessToken: string;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

export function signup(
  email: string,
  password: string,
  extra: {
    name?: string;
    phone?: string;
    childName?: string;
    childBirthYear?: number;
    childBirthday?: string;
    childConditions?: string[];
    issue?: string;
    partnerSlug?: string;
    referralCode?: string;
  } = {}
) {
  return request<AuthResponse>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, ...extra }),
  });
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
  // Public display name for the subscribe page; null for a campaign without one.
  name: string | null;
  kind?: 'PARTNER' | 'CAMPAIGN';
  skipSubscription?: boolean; // campaign option: skip /subscribe, go straight to /success
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

export function validatePartner(slug: string) {
  return request<PartnerInfo>(`/api/partner/validate/${encodeURIComponent(slug)}`);
}

export function referrerName(code: string) {
  return request<{ firstName: string }>(`/api/referral/referrer-name/${encodeURIComponent(code)}`);
}

export function login(email: string, password: string) {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function forgotPassword(email: string) {
  return request<{ message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export interface CompleteOnboardingPayload {
  name: string;
  relationshipToChild: string;
  childName: string;
  childGender: string;
  childBirthday: string; // ISO date string
  issue: string[];
}

export function completeOnboarding(payload: CompleteOnboardingPayload, token: string) {
  return request<{ success: boolean }>('/api/auth/complete-onboarding', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, token);
}

export interface WacbPayload {
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

export function submitWacbSurvey(payload: WacbPayload, token: string) {
  return request<{ success: boolean }>('/api/wacb-survey', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
}

export interface StripePrices {
  monthly: { amount: number; currency: string; formatted: string; priceId: string } | null;
  yearly: { amount: number; currency: string; formatted: string; priceId: string } | null;
  savingsPercent: number;
  yearlyPerMonth: string | null;
}

export function fetchPrices(): Promise<StripePrices> {
  return request<StripePrices>('/api/stripe/prices');
}

export interface CheckoutPayload {
  plan: 'monthly' | 'yearly';
  successUrl: string;
  cancelUrl: string;
}

export function createCheckoutSession(payload: CheckoutPayload, token?: string | null) {
  return request<{ url: string }>('/api/stripe/create-checkout-session', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
}
