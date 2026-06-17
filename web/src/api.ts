const isProd = window.location.hostname === 'hinora.co';
export const API_BASE = isProd
  ? 'https://wpwpawhz29.ap-southeast-1.awsapprunner.com'
  : 'http://localhost:3001';

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
    childName?: string;
    childBirthYear?: number;
    childBirthday?: string;
    childConditions?: string[];
    issue?: string;
  } = {}
) {
  return request<AuthResponse>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, ...extra }),
  });
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
  q1Dawdle?: number;
  q2MealBehavior?: number;
  q3RefuseRules?: number;
  q4Temper?: number;
  q5ScreamingFit?: number;
  q6BreakThings?: number;
  q7Arguments?: number;
  q8Interrupt?: number;
  q9Focus?: number;
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
