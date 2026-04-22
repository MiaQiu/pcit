import { apiFetch, apiFetchEnv, setToken } from './client';

// Options for calling dev or prod API
export interface ApiEnvOpts {
  baseUrl?: string;
  token?: string;
}

// ---- Types ----

export interface LessonSummary {
  id: string;
  module: string;
  dayNumber: number;
  title: string;
  subtitle: string | null;
  shortDescription: string;
  estimatedMinutes: number;
  segmentCount: number;
  hasQuiz: boolean;
  backgroundColor: string;
  updatedAt: string;
}

export interface Segment {
  id?: string;
  lessonId?: string;
  order: number;
  sectionTitle: string | null;
  contentType: string;
  bodyText: string;
  imageUrl?: string | null;
  iconType?: string | null;
  aiCheckMode?: string | null;
  idealAnswer?: string | null;
  customHtml?: string | null;
}

export interface QuizOption {
  id?: string;
  optionLabel: string;
  optionText: string;
  order: number;
}

export interface Quiz {
  id?: string;
  question: string;
  correctAnswer: string;
  explanation: string;
  options: QuizOption[];
}

export interface LessonDetail {
  id: string;
  module: string;
  dayNumber: number;
  title: string;
  subtitle: string | null;
  shortDescription: string;
  objectives: string[];
  estimatedMinutes: number;
  teachesCategories: string[];
  dragonImageUrl: string | null;
  backgroundColor: string;
  ellipse77Color: string;
  ellipse78Color: string;
  segments: Segment[];
  quiz: Quiz | null;
}

export interface ModuleSummary {
  id: string;
  key: string;
  title: string;
  shortName: string;
  displayOrder: number;
  backgroundColor: string;
  lessonCount: number;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  tag: string;
  hasPushToken: boolean;
  pushTokenUpdatedAt: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  sessionCount: number;
  developmentalVisible: boolean;
  subscriptionStatus: string;
  subscriptionPlan: string;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  trialStartDate: string | null;
  trialEndDate: string | null;
}

export interface SubscriptionUser {
  id: string;
  name: string;
  email: string;
  tag: string;
  createdAt: string;
  subscriptionStatus: string;
  subscriptionPlan: string;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  trialStartDate: string | null;
  trialEndDate: string | null;
}

export interface TrialExpiryResult {
  ok: boolean;
  found: number;
  sent: number;
  failed: number;
}

export interface UserProfile {
  lessons: Array<{
    lessonId: string;
    title: string;
    module: string | null;
    completedAt: string | null;
  }>;
  sessions: Array<{
    id: string;
    mode: string;
    status: string;
    createdAt: string;
  }>;
}

// ---- Auth ----

export async function login(password: string): Promise<string> {
  const data = await apiFetch<{ token: string }>('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  setToken(data.token);
  return data.token;
}

export async function verifyToken(): Promise<boolean> {
  try {
    await apiFetch('/api/admin/auth/verify');
    return true;
  } catch {
    return false;
  }
}

// ---- Lessons ----

export async function getLessons(module?: string): Promise<LessonSummary[]> {
  const params = module ? `?module=${module}` : '';
  const data = await apiFetch<{ lessons: LessonSummary[] }>(`/api/admin/lessons${params}`);
  return data.lessons;
}

export async function getLesson(id: string): Promise<LessonDetail> {
  const data = await apiFetch<{ lesson: LessonDetail }>(`/api/admin/lessons/${id}`);
  return data.lesson;
}

export async function createLesson(
  lesson: Partial<LessonDetail>,
  segments: Partial<Segment>[],
  quiz?: Partial<Quiz> | null
): Promise<LessonDetail> {
  const data = await apiFetch<{ lesson: LessonDetail }>('/api/admin/lessons', {
    method: 'POST',
    body: JSON.stringify({ lesson, segments, quiz }),
  });
  return data.lesson;
}

export async function updateLesson(
  id: string,
  lesson: Partial<LessonDetail>,
  segments: Partial<Segment>[],
  quiz?: Partial<Quiz> | null
): Promise<LessonDetail> {
  const data = await apiFetch<{ lesson: LessonDetail }>(`/api/admin/lessons/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ lesson, segments, quiz }),
  });
  return data.lesson;
}

export async function deleteLesson(id: string): Promise<void> {
  await apiFetch(`/api/admin/lessons/${id}`, { method: 'DELETE' });
}

// ---- Modules ----

export async function getModules(): Promise<ModuleSummary[]> {
  const data = await apiFetch<{ modules: ModuleSummary[] }>('/api/admin/modules');
  return data.modules;
}

export async function createModule(mod: {
  key: string;
  title: string;
  shortName: string;
  description?: string;
  displayOrder?: number;
  backgroundColor?: string;
}): Promise<ModuleSummary> {
  const data = await apiFetch<{ module: ModuleSummary }>('/api/admin/modules', {
    method: 'POST',
    body: JSON.stringify(mod),
  });
  return data.module;
}

export async function updateModule(
  key: string,
  mod: {
    title?: string;
    shortName?: string;
    description?: string;
    displayOrder?: number;
    backgroundColor?: string;
  }
): Promise<ModuleSummary> {
  const data = await apiFetch<{ module: ModuleSummary }>(`/api/admin/modules/${key}`, {
    method: 'PUT',
    body: JSON.stringify(mod),
  });
  return data.module;
}

// ---- Weekly Reports ----

export interface WeeklyReportSummary {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  visibility: boolean;
  headline: string | null;
  totalDeposits: number;
  sessionIds: string[];
  sessionCount: number;
  avgNoraScore: number | null;
  generatedAt: string | null;
  createdAt: string;
}

export interface WeeklyReportDetail {
  id: string;
  userId: string;
  childId: string | null;
  weekStartDate: string;
  weekEndDate: string;
  visibility: boolean;
  headline: string | null;
  totalDeposits: number;
  massageTimeMinutes: number;
  praiseCount: number;
  echoCount: number;
  narrateCount: number;
  skillCelebrationTitle: string | null;
  scenarioCards: Array<{ label: string; body: string; exampleScript: string }> | null;
  parentGrowthNarrative: string | null;
  growthMetrics: Array<{ icon: string; value: string; label: string }> | null;
  noraObservation: string | null;
  topMoments: Array<{ date: string; dayLabel: string; dateLabel: string; tag: string; sessionTitle: string; quote: string; celebration: string; audioUrl?: string }> | null;
  milestones: Array<{ status: string; category: string; title: string; actionTip: string }> | null;
  childSpotlight: string | null;
  growthSnapshots: Array<{ category: string; icon: string; childQuote: string; meaning: string }> | null;
  childProgressNote: string | null;
  focusHeading: string | null;
  focusSubtext: string | null;
  whyExplanation: string | null;
  moodSelection: string | null;
  issueRatings: Record<string, string> | null;
  depositsTrend: string | null;
  depositsChangePercent: number | null;
  trendMessage: string | null;
  sessionCount: number;
  uniqueDays: number;
  consistencyMessage: string | null;
  strongestGrowthArea: string | null;
  avgNoraScore: number | null;
  childResponseSummary: string | null;
  generatedAt: string | null;
  sessionIds: string[];
  createdAt: string;
  updatedAt: string;
}

export async function getUserWeeklyReports(userId: string, opts?: ApiEnvOpts): Promise<WeeklyReportSummary[]> {
  const data = await apiFetchEnv<{ reports: WeeklyReportSummary[] }>(
    `/api/admin/users/${userId}/weekly-reports`,
    {},
    opts
  );
  return data.reports;
}

export async function getWeeklyReport(id: string, opts?: ApiEnvOpts): Promise<WeeklyReportDetail> {
  const data = await apiFetchEnv<{ report: WeeklyReportDetail }>(
    `/api/admin/weekly-reports/${id}`,
    {},
    opts
  );
  return data.report;
}

export async function generateWeeklyReportApi(
  userId: string,
  weekStartDate?: string,
  opts?: ApiEnvOpts
): Promise<WeeklyReportDetail> {
  const data = await apiFetchEnv<{ report: WeeklyReportDetail }>(
    '/api/admin/weekly-reports/generate',
    {
      method: 'POST',
      body: JSON.stringify({ userId, weekStartDate }),
    },
    opts
  );
  return data.report;
}

export async function toggleWeeklyReportVisibility(
  reportId: string,
  visibility: boolean,
  opts?: ApiEnvOpts
): Promise<{ report: { id: string; visibility: boolean }; notificationSent: boolean }> {
  return apiFetchEnv(`/api/admin/weekly-reports/${reportId}/visibility`, {
    method: 'PUT',
    body: JSON.stringify({ visibility }),
  }, opts);
}

// ---- Keywords ----

export interface Keyword {
  id: string;
  term: string;
  definition: string;
  createdAt: string;
  updatedAt: string;
}

export async function getKeywords(search?: string): Promise<Keyword[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  const data = await apiFetch<{ keywords: Keyword[] }>(`/api/admin/keywords${params}`);
  return data.keywords;
}

export async function createKeyword(term: string, definition: string): Promise<Keyword> {
  const data = await apiFetch<{ keyword: Keyword }>('/api/admin/keywords', {
    method: 'POST',
    body: JSON.stringify({ term, definition }),
  });
  return data.keyword;
}

export async function updateKeyword(id: string, term: string, definition: string): Promise<Keyword> {
  const data = await apiFetch<{ keyword: Keyword }>(`/api/admin/keywords/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ term, definition }),
  });
  return data.keyword;
}

export async function deleteKeyword(id: string): Promise<void> {
  await apiFetch(`/api/admin/keywords/${id}`, { method: 'DELETE' });
}

// ---- Settings ----

export interface ReportVisibility {
  daily: boolean;
  weekly: boolean;
  monthly: boolean;
}

export async function getReportVisibility(): Promise<ReportVisibility> {
  return apiFetch<ReportVisibility>('/api/admin/settings/report-visibility');
}

export async function updateReportVisibility(
  visibility: ReportVisibility
): Promise<ReportVisibility> {
  return apiFetch<ReportVisibility>('/api/admin/settings/report-visibility', {
    method: 'PUT',
    body: JSON.stringify(visibility),
  });
}

// ---- Users & Notifications ----

export async function getUsers(opts?: ApiEnvOpts): Promise<UserSummary[]> {
  const data = await apiFetchEnv<{ users: UserSummary[] }>('/api/admin/users', {}, opts);
  return data.users;
}

export async function getUserProfile(userId: string, opts?: ApiEnvOpts): Promise<UserProfile> {
  return apiFetchEnv<UserProfile>(`/api/admin/users/${userId}/profile`, {}, opts);
}

export async function updateUserTag(userId: string, tag: 'user' | 'tester', opts?: ApiEnvOpts): Promise<void> {
  await apiFetchEnv(`/api/admin/users/${userId}/tag`, {
    method: 'PUT',
    body: JSON.stringify({ tag }),
  }, opts);
}

export interface NotificationResult {
  sent: number;
  failed: number;
  total: number;
  results: Array<{ userId: string; success: boolean; error?: string }>;
}

export async function toggleDevelopmentalVisibility(
  userId: string,
  visibility: boolean,
  opts?: ApiEnvOpts
): Promise<{ userId: string; developmentalVisible: boolean }> {
  return apiFetchEnv(`/api/admin/users/${userId}/developmental-visibility`, {
    method: 'PUT',
    body: JSON.stringify({ visibility }),
  }, opts);
}

export async function sendNotifications(
  userIds: string[],
  title: string,
  body: string,
  opts?: ApiEnvOpts
): Promise<NotificationResult> {
  return apiFetchEnv<NotificationResult>('/api/admin/notifications/send', {
    method: 'POST',
    body: JSON.stringify({ userIds, title, body }),
  }, opts);
}

// ---- Subscriptions ----

export async function getSubscriptions(status?: string, opts?: ApiEnvOpts): Promise<SubscriptionUser[]> {
  const params = status ? `?status=${encodeURIComponent(status)}` : '';
  const data = await apiFetchEnv<{ users: SubscriptionUser[] }>(`/api/admin/subscriptions${params}`, {}, opts);
  return data.users;
}

export async function sendTrialExpiryEmails(daysBeforeExpiry = 3, opts?: ApiEnvOpts): Promise<TrialExpiryResult> {
  return apiFetchEnv<TrialExpiryResult>('/api/admin/subscriptions/send-trial-expiry-emails', {
    method: 'POST',
    body: JSON.stringify({ daysBeforeExpiry }),
  }, opts);
}

// ---- Sessions ----

export interface SessionSummary {
  id: string;
  userId: string;
  mode: string;
  analysisStatus: string;
  analysisError: string | null;
  enrichmentStatus: string | null;
  enrichmentError: string | null;
  createdAt: string;
  hasCoachingCards: boolean;
}

export interface SessionSearchParams {
  sessionId?: string;
  userId?: string;
  from?: string;
  to?: string;
  limit?: number;
  noCards?: boolean;
}

export async function searchSessions(params: SessionSearchParams, opts?: ApiEnvOpts): Promise<SessionSummary[]> {
  const q = new URLSearchParams();
  if (params.sessionId) q.set('sessionId', params.sessionId);
  if (params.userId) q.set('userId', params.userId);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.limit) q.set('limit', String(params.limit));
  if (params.noCards) q.set('noCards', 'true');
  const data = await apiFetchEnv<{ sessions: SessionSummary[] }>(`/api/admin/sessions?${q}`, {}, opts);
  return data.sessions;
}

export interface RerunCdiCoachingResult {
  ok: boolean;
  coachingSummary: string;
  coachingCards: Array<{ title: string; content: string }>;
  tomorrowGoal: string | null;
}

export async function rerunCdiCoaching(sessionId: string, opts?: ApiEnvOpts): Promise<RerunCdiCoachingResult> {
  return apiFetchEnv<RerunCdiCoachingResult>(
    `/api/admin/sessions/${sessionId}/rerun-cdi-coaching`,
    { method: 'POST' },
    opts
  );
}

// ---- Sync to Prod ----

export interface SyncResult {
  modules: number;
  lessons: number;
  segments: number;
  quizzes: number;
  keywords: number;
}

export async function syncToProd(): Promise<SyncResult> {
  const data = await apiFetch<{ success: boolean; synced: SyncResult }>('/api/admin/sync-to-prod', {
    method: 'POST',
  });
  return data.synced;
}
