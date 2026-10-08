import { apiFetch, apiFetchEnv, apiFetchRaw, setToken } from './client';

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
  wrongExplanation?: string;
  quizPosition?: number | null;
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
  contentV2: string | null;
  audioUrl: string | null;
  wordTimings: WordTiming[] | null;
  durationSeconds: number | null;
  backgroundColor: string;
  ellipse77Color: string;
  ellipse78Color: string;
  shareTitle: string | null;
  shareSubtitle: string | null;
  segments: Segment[];
  quiz: Quiz | null;
}

export interface ModuleSummary {
  id: string;
  key: string;
  title: string;
  shortName: string;
  description: string;
  displayOrder: number;
  backgroundColor: string;
  lessonCount: number;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  tag: string;
  hasPushToken: boolean;
  pushTokenUpdatedAt: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  sessionCount: number;
  developmentalVisible: boolean;
  isFreeAccount: boolean;
  subscriptionStatus: string;
  subscriptionPlan: string;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  trialStartDate: string | null;
  trialEndDate: string | null;
  childBirthday: string | null;
  issue: string | null;
  wacbTotalScore: number | null;
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
  isFreeAccount: boolean;
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
  demoVideos: Array<{
    demoVideoId: string;
    title: string;
    viewedAt: string | null;
  }>;
  sessions: Array<{
    id: string;
    mode: string;
    status: string;
    overallScore: number | null;
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

export async function verifyToken(): Promise<{ valid: boolean; role: 'admin' | 'therapist' }> {
  try {
    const data = await apiFetch<{ valid: boolean; role: 'admin' | 'therapist' }>('/api/admin/auth/verify');
    return data;
  } catch {
    return { valid: false, role: 'admin' };
  }
}

export async function therapistLogin(email: string, password: string): Promise<string> {
  const data = await apiFetch<{ token: string }>('/api/admin/auth/therapist-login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data.token;
}

export interface TherapistSessionStatus {
  analysisStatus: string;
  analysisError: string | null;
  session: { id: string; mode: string; createdAt: string; codingReviewedAt: string | null };
  utterances: ReviewUtterance[];
}

export async function uploadTherapistSession(
  file: File,
  mode: 'CDI' | 'PDI',
  durationSeconds: number
): Promise<{ sessionId: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mode', mode);
  formData.append('durationSeconds', String(durationSeconds));

  const token = (await import('./client')).getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/admin/therapist/upload', { method: 'POST', headers, body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export async function getTherapistSession(sessionId: string): Promise<TherapistSessionStatus> {
  return apiFetch<TherapistSessionStatus>(`/api/admin/therapist/sessions/${sessionId}`);
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

export interface ContentV2Translation {
  contentV2: string | null;
  audioUrl: string | null;
  wordTimings: WordTiming[] | null;
  durationSeconds: number | null;
  reviewed: boolean;
}

// Like getLesson, but also loads the given locale's existing Content V2
// translation (if any) alongside the always-English base lesson fields.
// Used by the Content V2 editor's locale switcher.
export async function getLessonWithTranslation(
  id: string,
  locale?: string
): Promise<{ lesson: LessonDetail; contentV2Translation: ContentV2Translation | null }> {
  const params = locale && locale !== 'en' ? `?locale=${locale}` : '';
  return apiFetch(`/api/admin/lessons/${id}${params}`);
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

export async function uploadLessonImage(id: string, file: File): Promise<{ dragonImageUrl: string }> {
  const token = (await import('./client')).getToken();
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(`/api/admin/lessons/${id}/image`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export async function updateLessonContentV2(
  id: string,
  updates: {
    contentV2?: string;
    audioUrl?: string | null;
    wordTimings?: WordTiming[] | null;
    durationSeconds?: number | null;
    title?: string;
    subtitle?: string | null;
  },
  locale?: string
): Promise<{
  title?: string;
  subtitle?: string | null;
  contentV2: string | null;
  audioUrl: string | null;
  wordTimings: WordTiming[] | null;
  durationSeconds: number | null;
}> {
  return apiFetch(`/api/admin/lessons/${id}/content-v2`, {
    method: 'PATCH',
    body: JSON.stringify(locale && locale !== 'en' ? { ...updates, locale } : updates),
  });
}

export interface WordTiming {
  text: string;
  start: number;
  end: number;
}

export interface UploadLessonAudioResult {
  audioUrl: string;
  transcriptText: string | null;
  wordTimings: WordTiming[] | null;
  durationSeconds: number | null;
  transcriptionError: string | null;
}

export async function uploadLessonAudio(id: string, file: File, locale?: string): Promise<UploadLessonAudioResult> {
  const token = (await import('./client')).getToken();
  const form = new FormData();
  form.append('audio', file);
  const params = locale && locale !== 'en' ? `?locale=${locale}` : '';
  const res = await fetch(`/api/admin/lessons/${id}/audio${params}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export interface UploadLessonContentImageResult {
  key: string;
  marker: string;
  url: string;
}

export async function uploadLessonContentImage(id: string, file: File): Promise<UploadLessonContentImageResult> {
  const token = (await import('./client')).getToken();
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(`/api/admin/lessons/${id}/content-image`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export interface UploadLessonContentVideoResult {
  key: string;
  marker: string;
  url: string;
}

export async function uploadLessonContentVideo(id: string, file: File): Promise<UploadLessonContentVideoResult> {
  const token = (await import('./client')).getToken();
  const form = new FormData();
  form.append('video', file);
  const res = await fetch(`/api/admin/lessons/${id}/content-video`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }
  return res.json();
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

// ---- Home Cards ----

export type HomeCardType = 'CONTENT' | 'QUOTE';
export type HomeCardFontSize = 'SMALL' | 'MEDIUM' | 'LARGE';
export type HomeCardComponentType = 'TEXT' | 'IMAGE' | 'OPEN_DETAILS' | 'USER_INPUT';
export type HomeCardGender = 'BOY' | 'GIRL' | 'OTHER';

export interface HomeCardBadge {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface HomeCardComponent {
  id: string;
  type: HomeCardComponentType;
  order: number;
  text: string | null;
  imageUrl: string | null;
  linkedCardId: string | null;
  ctaLabel: string | null;
  inputLabel: string | null;
  inputPlaceholder: string | null;
  // USER_INPUT only: also surface this input inline on the home card, not
  // just the detail page. Stored server-side in the reused `text` column (no
  // schema change) — see validateHomeCardComponents.
  showOnCard?: boolean;
}

// Sent to POST/PUT /api/admin/home-cards as part of `components` — `id`
// omitted for a new block, present to update an existing one in place.
export interface HomeCardComponentInput {
  id?: string;
  type: HomeCardComponentType;
  text?: string;
  linkedCardId?: string;
  ctaLabel?: string;
  inputLabel?: string;
  inputPlaceholder?: string;
  showOnCard?: boolean;
}

export interface HomeCard {
  id: string;
  cardType: HomeCardType;
  badgeId: string;
  badgeText: string;
  badgeColor: string;
  message: string;
  messageFontSize: HomeCardFontSize;
  messageBold: boolean;
  messageItalic: boolean;
  attribution: string | null;
  imageUrl: string | null;
  detailTitle: string | null;
  components: HomeCardComponent[];
  isActive: boolean;
  displayOrder: number;
  likeCount: number;
  viewCount: number;
  shareCount: number;
  targetTags: string[];
  minAgeMonths: number | null;
  maxAgeMonths: number | null;
  targetGender: HomeCardGender | null;
  createdAt: string;
  updatedAt: string;
}

export interface HomeCardInput {
  cardType: HomeCardType;
  badgeId: string;
  message: string;
  messageFontSize?: HomeCardFontSize;
  messageBold?: boolean;
  messageItalic?: boolean;
  attribution?: string;
  detailTitle?: string;
  components?: HomeCardComponentInput[];
  isActive?: boolean;
  displayOrder?: number;
  targetTags?: string[];
  minAgeMonths?: number | null;
  maxAgeMonths?: number | null;
  targetGender?: HomeCardGender | null;
}

export async function getHomeCardBadges(): Promise<HomeCardBadge[]> {
  const data = await apiFetch<{ badges: HomeCardBadge[] }>('/api/admin/home-card-badges');
  return data.badges;
}

export async function createHomeCardBadge(name: string, color: string): Promise<HomeCardBadge> {
  const data = await apiFetch<{ badge: HomeCardBadge }>('/api/admin/home-card-badges', {
    method: 'POST',
    body: JSON.stringify({ name, color }),
  });
  return data.badge;
}

export async function getHomeCards(opts?: ApiEnvOpts): Promise<HomeCard[]> {
  const data = await apiFetchEnv<{ homeCards: HomeCard[] }>('/api/admin/home-cards', {}, opts);
  return data.homeCards;
}

export async function createHomeCard(input: HomeCardInput): Promise<HomeCard> {
  const data = await apiFetch<{ homeCard: HomeCard }>('/api/admin/home-cards', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.homeCard;
}

export async function updateHomeCard(id: string, input: Partial<HomeCardInput>): Promise<HomeCard> {
  const data = await apiFetch<{ homeCard: HomeCard }>(`/api/admin/home-cards/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return data.homeCard;
}

export interface HomeCardEngagementUser {
  userId: string;
  name: string | null;
  email: string | null;
}

export interface HomeCardEngagement {
  likes: (HomeCardEngagementUser & { likedAt: string })[];
  shares: (HomeCardEngagementUser & { shareCount: number; lastSharedAt: string })[];
}

export async function getHomeCardEngagement(id: string, opts?: ApiEnvOpts): Promise<HomeCardEngagement> {
  return apiFetchEnv<HomeCardEngagement>(`/api/admin/home-cards/${id}/engagement`, {}, opts);
}

export async function deleteHomeCard(id: string): Promise<void> {
  await apiFetch(`/api/admin/home-cards/${id}`, { method: 'DELETE' });
}

export async function uploadHomeCardImage(id: string, file: File): Promise<HomeCard> {
  const token = (await import('./client')).getToken();
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(`/api/admin/home-cards/${id}/image`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }
  const data = await res.json();
  return data.homeCard;
}

export async function removeHomeCardImage(id: string): Promise<HomeCard> {
  const data = await apiFetch<{ homeCard: HomeCard }>(`/api/admin/home-cards/${id}/image`, {
    method: 'DELETE',
  });
  return data.homeCard;
}

export async function uploadHomeCardComponentImage(cardId: string, componentId: string, file: File): Promise<HomeCardComponent> {
  const token = (await import('./client')).getToken();
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(`/api/admin/home-cards/${cardId}/components/${componentId}/image`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }
  const data = await res.json();
  return data.component;
}

// ---- Demo Videos ----

export type DemoVideoLocale = 'zh-CN' | 'zh-TW';

export interface DemoVideoTranslation {
  demoVideoId: string;
  locale: DemoVideoLocale;
  title: string | null;
  description: string | null;
  additionalText: string | null;
  videoUrl: string | null; // resolved presigned URL when set
  autoTranslated: boolean;
  reviewed: boolean;
  translatedAt: string;
}

export interface DemoVideo {
  id: string;
  title: string;
  description: string | null;
  additionalText: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  lessonId: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  translations?: DemoVideoTranslation[];
}

export interface DemoVideoInput {
  title: string;
  description?: string;
  additionalText?: string;
  lessonId?: string | null;
  isActive?: boolean;
  displayOrder?: number;
}

export async function getDemoVideos(): Promise<DemoVideo[]> {
  const data = await apiFetch<{ demoVideos: DemoVideo[] }>('/api/admin/demo-videos');
  return data.demoVideos;
}

export async function createDemoVideo(input: DemoVideoInput): Promise<DemoVideo> {
  const data = await apiFetch<{ demoVideo: DemoVideo }>('/api/admin/demo-videos', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.demoVideo;
}

export async function updateDemoVideo(id: string, input: Partial<DemoVideoInput>): Promise<DemoVideo> {
  const data = await apiFetch<{ demoVideo: DemoVideo }>(`/api/admin/demo-videos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return data.demoVideo;
}

export async function deleteDemoVideo(id: string): Promise<void> {
  await apiFetch(`/api/admin/demo-videos/${id}`, { method: 'DELETE' });
}

export async function uploadDemoVideoFile(id: string, file: File): Promise<DemoVideo> {
  const token = (await import('./client')).getToken();
  const form = new FormData();
  form.append('video', file);
  const res = await fetch(`/api/admin/demo-videos/${id}/video`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }
  const data = await res.json();
  return data.demoVideo;
}

export async function uploadDemoVideoThumbnailFile(id: string, file: File): Promise<DemoVideo> {
  const token = (await import('./client')).getToken();
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(`/api/admin/demo-videos/${id}/thumbnail`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }
  const data = await res.json();
  return data.demoVideo;
}

// ---- Demo video translations ----

export interface DemoVideoTranslationInput {
  title?: string;
  description?: string;
  additionalText?: string;
  reviewed?: boolean;
}

export async function saveDemoVideoTranslation(
  id: string,
  locale: DemoVideoLocale,
  input: DemoVideoTranslationInput
): Promise<DemoVideoTranslation> {
  const data = await apiFetch<{ translation: DemoVideoTranslation }>(
    `/api/admin/demo-videos/${id}/translations/${locale}`,
    { method: 'PUT', body: JSON.stringify(input) }
  );
  return data.translation;
}

export async function autoTranslateDemoVideo(
  id: string,
  locale: DemoVideoLocale
): Promise<DemoVideoTranslation> {
  const data = await apiFetch<{ translation: DemoVideoTranslation }>(
    `/api/admin/demo-videos/${id}/translations/${locale}/auto`,
    { method: 'POST' }
  );
  return data.translation;
}

export async function deleteDemoVideoTranslation(id: string, locale: DemoVideoLocale): Promise<void> {
  await apiFetch(`/api/admin/demo-videos/${id}/translations/${locale}`, { method: 'DELETE' });
}

export async function uploadDemoVideoTranslationFile(
  id: string,
  locale: DemoVideoLocale,
  file: File
): Promise<DemoVideoTranslation> {
  const token = (await import('./client')).getToken();
  const form = new FormData();
  form.append('video', file);
  const res = await fetch(`/api/admin/demo-videos/${id}/translations/${locale}/video`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }
  const data = await res.json();
  return data.translation;
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

export interface BrandingImages {
  learnCoverUrl: string | null;
  lessonViewerUrl: string | null;
  learnTitle: string | null;
  learnSubtitle: string | null;
}

export type BrandingImageSlot = 'learn-cover' | 'lesson-viewer';

export async function getBrandingImages(locale?: string): Promise<BrandingImages> {
  const params = locale && locale !== 'en' ? `?locale=${locale}` : '';
  return apiFetch<BrandingImages>(`/api/admin/settings/branding-images${params}`);
}

export async function uploadBrandingImage(slot: BrandingImageSlot, file: File): Promise<BrandingImages> {
  const token = (await import('./client')).getToken();
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(`/api/admin/settings/branding-images/${slot}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export async function updateLearnHeader(title: string, subtitle: string, locale?: string): Promise<BrandingImages> {
  return apiFetch<BrandingImages>('/api/admin/settings/learn-header', {
    method: 'PUT',
    body: JSON.stringify({ title, subtitle, locale: locale || 'en' }),
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

export async function toggleFreeAccount(
  userId: string,
  isFreeAccount: boolean,
  opts?: ApiEnvOpts
): Promise<{ userId: string; isFreeAccount: boolean }> {
  return apiFetchEnv(`/api/admin/users/${userId}/free-account`, {
    method: 'PUT',
    body: JSON.stringify({ isFreeAccount }),
  }, opts);
}

export interface WhitelistEntry {
  id: string;
  email: string;
  createdAt: string;
}

export async function getFreeAccountWhitelist(opts?: ApiEnvOpts): Promise<WhitelistEntry[]> {
  const data = await apiFetchEnv<{ entries: WhitelistEntry[] }>('/api/admin/free-account-whitelist', {}, opts);
  return data.entries;
}

export async function addToFreeAccountWhitelist(
  email: string,
  opts?: ApiEnvOpts
): Promise<{ entry: WhitelistEntry; userGranted: boolean }> {
  return apiFetchEnv('/api/admin/free-account-whitelist', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }, opts);
}

export async function removeFromFreeAccountWhitelist(id: string, opts?: ApiEnvOpts): Promise<void> {
  await apiFetchEnv(`/api/admin/free-account-whitelist/${id}`, { method: 'DELETE' }, opts);
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

export interface RCSyncResult {
  ok: boolean;
  synced: number;
  failed: number;
  skipped: number;
}

export async function syncSubscriptionsFromRC(opts?: ApiEnvOpts): Promise<RCSyncResult> {
  return apiFetchEnv<RCSyncResult>('/api/admin/subscriptions/sync-from-rc', { method: 'POST' }, opts);
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

// ---- Session Report (mirrors the mobile app's ReportScreen_v3 / ReportDetailScreen data) ----

export interface SessionReportSkill {
  label: string;
  progress: number;
}

export interface SessionReportAvoidArea {
  label: string;
  count: number;
}

export interface SessionReportTranscriptLine {
  speaker: string;
  text: string;
  start: number | null;
  end: number | null;
  role: string | null;
  tag: string | null;
  pcitTag: string | null;
  feedback: string | null;
}

export interface SessionReportCoachCornerExample {
  quote: string;
  benefit: string;
}

export interface SessionReportCoachCornerDidWell {
  theme: string;
  howItHelps: string;
  examples: SessionReportCoachCornerExample[];
}

export interface SessionReportCoachCornerGrowthFocus {
  heading: string;
  newSkillIntro: string | null;
  gap: string;
  benchmark: string;
  strategy: string;
}

export interface SessionReportWordBankCategory {
  name: string;
  examples: string[];
}

export interface SessionReportWordBankGoal {
  goal: string;
  categories: SessionReportWordBankCategory[];
}

export interface SessionReportCoachCorner {
  didWell: SessionReportCoachCornerDidWell;
  growthFocus: SessionReportCoachCornerGrowthFocus;
  wordBank: SessionReportWordBankGoal[];
}

export interface SessionReportLearningMoment {
  title: string;
  explanation: string;
  quote: string | null;
  suggestedRewrite: string | null;
}

export interface SessionReportLearningMoments {
  summary: string | null;
  points: SessionReportLearningMoment[];
}

export interface SessionReportGoalDirective {
  focusSkill: string;
  currentNumber: number | null;
  targetNumber: number | string | null;
  goalType: string | null;
  actionPrompt: string | null;
}

// First-session-only report (generateFirstSessionInsights) — replaces the
// standard "About the child" / Top Moment / Coach's Corner cards on the
// user's chronologically first completed session. See isFirstSession below.
export interface SessionReportStrength {
  name: string | null;
  explanation: string | null;
}

export interface SessionReportSkillUnderneath {
  name: string | null;
  definition: string | null;
}

export interface SessionReportFirstSessionInsights {
  whatWeLearned: {
    strengths: SessionReportStrength[];
    challenge: string | null;
  };
  skillsUnderneath: {
    openingSentence: string | null;
    skills: SessionReportSkillUnderneath[];
  };
  howWePracticeTogether: {
    sentences: string[];
  };
}

// Full session report payload — same shape /api/recordings/:id/analysis returns
// to the mobile app. Fields not needed by the admin view are left untyped here.
export interface SessionReport {
  id: string;
  mode: string;
  durationSeconds: number;
  createdAt: string;
  noraScore: number;
  skills: SessionReportSkill[];
  areasToAvoid: SessionReportAvoidArea[];
  topMoment: string | null;
  topMomentCelebration: string | null;
  coachCorner: SessionReportCoachCorner | null;
  skillCoaching: string | null;
  learningMoments: SessionReportLearningMoments | null;
  crisisMoment: { title?: string; description?: string; coaching?: string } | null;
  audioUrl: string | null;
  tomorrowGoal: string | null;
  tomorrowGoalDirective: SessionReportGoalDirective | null;
  transcript: SessionReportTranscriptLine[];
  aboutChild: Array<{ Title?: string; Description?: string; Details?: string }> | null;
  isFirstSession: boolean;
  firstSessionInsights: SessionReportFirstSessionInsights | null;
}

export type SessionReportResult =
  | { status: 'completed'; report: SessionReport }
  | { status: 'processing'; message: string }
  | { status: 'failed'; message: string }
  | { status: 'not_found' };

export async function getSessionReport(sessionId: string, opts?: ApiEnvOpts): Promise<SessionReportResult> {
  const res = await apiFetchRaw(`/api/admin/sessions/${sessionId}/analysis`, {}, opts);
  const body = await res.json().catch(() => ({}));
  if (res.status === 404) return { status: 'not_found' };
  if (res.status === 202) return { status: 'processing', message: body.message || 'Analysis in progress' };
  if (res.status === 500 && body.status === 'failed') {
    return { status: 'failed', message: body.message || body.error || 'Analysis failed' };
  }
  if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`);
  return { status: 'completed', report: body };
}

// ---- Coding Review ----

export interface CodingReviewSession {
  id: string;
  mode: string;
  createdAt: string;
  codingReviewedAt: string | null;
  language: string | null;
  accuracy: number | null;
  userName: string | null;
  userEmail: string | null;
}

export interface UtteranceCoding {
  code: string | null;
  feedback: string | null;
  reference: string | null;
  assumption: string | null;
}

export interface ReviewUtterance {
  id: string;
  order: number;
  speaker: string;
  role: string | null;
  text: string;
  adminComment: string | null;
  coding: UtteranceCoding | null;
}

export interface CodingReviewDetail {
  session: CodingReviewSession;
  utterances: ReviewUtterance[];
}

export async function getCodingReviewSessions(opts?: ApiEnvOpts): Promise<CodingReviewSession[]> {
  const data = await apiFetchEnv<{ sessions: CodingReviewSession[] }>('/api/admin/coding-review', {}, opts);
  return data.sessions;
}

export async function getCodingReviewDetail(sessionId: string, opts?: ApiEnvOpts): Promise<CodingReviewDetail> {
  return apiFetchEnv<CodingReviewDetail>(`/api/admin/coding-review/${sessionId}`, {}, opts);
}

export async function saveUtteranceComment(
  sessionId: string,
  utteranceId: string,
  comment: string,
  opts?: ApiEnvOpts
): Promise<void> {
  await apiFetchEnv(`/api/admin/coding-review/${sessionId}/comment/${utteranceId}`, {
    method: 'PUT',
    body: JSON.stringify({ comment }),
  }, opts);
}

export async function submitCodingReview(sessionId: string, opts?: ApiEnvOpts): Promise<{ codingReviewedAt: string }> {
  return apiFetchEnv(`/api/admin/coding-review/${sessionId}/submit`, { method: 'POST' }, opts);
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

// ---- Partner Management ----

export interface PartnerDiscount {
  percentOff?: number;
  amountOff?: number;   // in cents
  currency?: string;    // required if amountOff set, default 'sgd'
  duration: 'once' | 'repeating' | 'forever';
  durationMonths?: number;
  stripeCouponId?: string; // auto-populated by server
}

export interface PartnerDiscounts {
  monthly: PartnerDiscount | null;
  yearly: PartnerDiscount | null;
}

// Custom copy for the web signup screens (landing, create account, success). null = default copy.
export interface PartnerLandingText {
  headline: string | null;
  subtext: string | null;
  ctaText: string | null;
  accountTitle: string | null;
  accountSubtitle: string | null;
  successTitle: string | null;
  successSubtitle: string | null;
}

// Campaign rules linked from the create-account consent checkbox. null = no rules.
export interface CampaignRules {
  title: string | null;
  content: string;
}

export interface PartnerLanding extends PartnerLandingText {
  imageKey: string | null; // raw S3 key; set via upload/remove endpoints
}

export type PartnerKind = 'PARTNER' | 'CAMPAIGN';

// A message variant of a campaign link (/p/<slug>/<key>). Blank landing fields fall back
// to the campaign's own landing copy, then to the app defaults.
export interface CampaignMessage {
  id: string;
  key: string;    // URL segment, immutable
  name: string;   // internal label
  landing: PartnerLanding | null;
  active: boolean;
  createdAt: string;
  landingImageUrl: string | null; // presigned preview of landing.imageKey
}

export interface PartnerConfig {
  trialDays: number;
  plans: ('monthly' | 'yearly')[];
  discounts: PartnerDiscounts;
  welcomeMessage: string | null;
  maxRedemptions: number | null;
  displayName?: string | null;     // public name on the subscribe page
  skipSubscription?: boolean;      // skip /subscribe in web signup
  accountLast?: boolean;           // web signup asks for the account at the end of onboarding
  landing?: PartnerLanding | null;
  campaignRules?: CampaignRules | null; // consent-checkbox rules (campaigns only)
}

export interface Partner {
  id: string;
  slug: string;
  name: string;
  kind: PartnerKind;
  status: 'ACTIVE' | 'PAUSED' | 'EXPIRED';
  config: PartnerConfig;
  messages: CampaignMessage[];
  expiresAt: string | null;
  redemptions: number;
  visits: number;
  landingImageUrl: string | null; // presigned preview of config.landing.imageKey
  qrCodeUrl: string | null;
  signupUrl: string; // same URL the QR code encodes (server's SIGNUP_APP_URL)
  userCount: number;
  discountLabels: { monthly: string | null; yearly: string | null };
  createdAt: string;
}

export interface PartnerCreatePayload {
  slug: string;
  name: string;
  kind?: PartnerKind;
  displayName?: string | null;
  skipSubscription?: boolean;
  accountLast?: boolean;
  // imageKey is honored on create only (to reuse a duplicated campaign's image).
  landing?: (PartnerLandingText & { imageKey?: string | null }) | null;
  campaignRules?: CampaignRules | null;
  trialDays?: number;
  plans?: ('monthly' | 'yearly')[];
  discounts?: {
    monthly?: Omit<PartnerDiscount, 'stripeCouponId'> | null;
    yearly?: Omit<PartnerDiscount, 'stripeCouponId'> | null;
  };
  // On update: omit = leave unchanged, null = clear.
  welcomeMessage?: string | null;
  maxRedemptions?: number | null;
  expiresAt?: string | null;
}

export async function getPartners(opts?: ApiEnvOpts): Promise<Partner[]> {
  return apiFetchEnv('/api/admin/partners', {}, opts);
}

export async function getPartner(id: string, opts?: ApiEnvOpts): Promise<Partner> {
  return apiFetchEnv(`/api/admin/partners/${id}`, {}, opts);
}

export async function createPartner(payload: PartnerCreatePayload, opts?: ApiEnvOpts): Promise<Partner> {
  return apiFetchEnv('/api/admin/partners', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, opts);
}

export async function updatePartner(
  id: string,
  payload: Partial<PartnerCreatePayload & { status: string }>,
  opts?: ApiEnvOpts
): Promise<Partner> {
  return apiFetchEnv(`/api/admin/partners/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, opts);
}

export async function deactivatePartner(id: string, opts?: ApiEnvOpts): Promise<void> {
  await apiFetchEnv(`/api/admin/partners/${id}`, { method: 'DELETE' }, opts);
}

export async function regeneratePartnerQrCode(id: string, opts?: ApiEnvOpts): Promise<Partner> {
  return apiFetchEnv(`/api/admin/partners/${id}/qr-code`, { method: 'POST' }, opts);
}

// Multipart upload — apiFetchEnv forces a JSON content type, so build the request here.
// `path` is the landing-image endpoint, relative to /api/admin/partners/.
async function partnerImageRequest(path: string, method: 'POST' | 'DELETE', file: File | null, opts?: ApiEnvOpts): Promise<Partner> {
  const token = opts?.token ?? (await import('./client')).getToken();
  let body: FormData | undefined;
  if (file) {
    body = new FormData();
    body.append('image', file);
  }
  const res = await fetch(`${opts?.baseUrl ?? ''}/api/admin/partners/${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export function uploadPartnerLandingImage(id: string, file: File, opts?: ApiEnvOpts): Promise<Partner> {
  return partnerImageRequest(`${id}/landing-image`, 'POST', file, opts);
}

export function removePartnerLandingImage(id: string, opts?: ApiEnvOpts): Promise<Partner> {
  return partnerImageRequest(`${id}/landing-image`, 'DELETE', null, opts);
}

// ---- Campaign messages, link builder, stats ----
// Message mutations return the whole updated Partner (with its messages).

export interface CampaignMessagePayload {
  key?: string;   // create only
  name?: string;
  // imageKey is honored on create only (to reuse a duplicated message's image).
  landing?: (PartnerLandingText & { imageKey?: string | null }) | null;
  active?: boolean;
}

export async function createCampaignMessage(partnerId: string, payload: CampaignMessagePayload, opts?: ApiEnvOpts): Promise<Partner> {
  return apiFetchEnv(`/api/admin/partners/${partnerId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, opts);
}

export async function updateCampaignMessage(
  partnerId: string, messageId: string, payload: CampaignMessagePayload, opts?: ApiEnvOpts
): Promise<Partner> {
  return apiFetchEnv(`/api/admin/partners/${partnerId}/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, opts);
}

export function uploadCampaignMessageImage(partnerId: string, messageId: string, file: File, opts?: ApiEnvOpts): Promise<Partner> {
  return partnerImageRequest(`${partnerId}/messages/${messageId}/landing-image`, 'POST', file, opts);
}

export function removeCampaignMessageImage(partnerId: string, messageId: string, opts?: ApiEnvOpts): Promise<Partner> {
  return partnerImageRequest(`${partnerId}/messages/${messageId}/landing-image`, 'DELETE', null, opts);
}

export interface CampaignLink {
  url: string;
  source: string | null; // normalised ?src= value
  qrDataUrl: string;     // PNG data URL
}

export async function getCampaignLink(
  partnerId: string, messageKey: string | null, source: string | null, opts?: ApiEnvOpts
): Promise<CampaignLink> {
  const params = new URLSearchParams();
  if (messageKey) params.set('m', messageKey);
  if (source) params.set('src', source);
  return apiFetchEnv(`/api/admin/partners/${partnerId}/link?${params}`, {}, opts);
}

// One row per (message, channel); '' = default message / no ?src=.
export interface CampaignStatsRow {
  messageKey: string;
  source: string;
  visits: number;
  started: number; // account-last links: visitors who started onboarding (signup drafts)
  signups: number;
}

export interface CampaignStats {
  totalVisits: number; // Partner.visits, incl. visits from before per-message tracking
  rows: CampaignStatsRow[];
}

export async function getCampaignStats(partnerId: string, opts?: ApiEnvOpts): Promise<CampaignStats> {
  return apiFetchEnv(`/api/admin/partners/${partnerId}/stats`, {}, opts);
}

// Account-last links: anonymous signup drafts, started vs. converted (account created).
export interface DraftTally {
  key: string | number; // birth year / concern key / WACB band
  started: number;
  converted: number;
}

export interface SignupDraftSummary {
  started: number;
  converted: number;
  dropOff: { step: string; count: number }[]; // unconverted drafts by last screen opened
  birthYears: DraftTally[];
  concerns: DraftTally[];
  wacbBands: DraftTally[]; // stable / mild / medium / high / not completed
}

export async function getSignupDraftSummary(partnerId: string, opts?: ApiEnvOpts): Promise<SignupDraftSummary> {
  return apiFetchEnv(`/api/admin/partners/${partnerId}/drafts/summary`, {}, opts);
}

export interface PartnerUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  subscriptionStatus: string;
  subscriptionPlan: string;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  trialStartDate: string | null;
  trialEndDate: string | null;
  signupSource: string | null; // ?src= channel
  messageKey: string | null;   // campaign message variant
}

export async function getPartnerUsers(id: string, opts?: ApiEnvOpts): Promise<PartnerUser[]> {
  const data = await apiFetchEnv<{ users: PartnerUser[] }>(`/api/admin/partners/${id}/users`, {}, opts);
  return data.users;
}
