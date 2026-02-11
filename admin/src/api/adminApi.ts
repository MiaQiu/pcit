import { apiFetch, setToken } from './client';

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
  email: string;
  name: string;
  hasPushToken: boolean;
  pushTokenUpdatedAt: string | null;
  createdAt: string;
  sessionCount: number;
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

// ---- Users & Notifications ----

export async function getUsers(): Promise<UserSummary[]> {
  const data = await apiFetch<{ users: UserSummary[] }>('/api/admin/users');
  return data.users;
}

export interface NotificationResult {
  sent: number;
  failed: number;
  total: number;
  results: Array<{ userId: string; success: boolean; error?: string }>;
}

export async function sendNotifications(
  userIds: string[],
  title: string,
  body: string
): Promise<NotificationResult> {
  return apiFetch<NotificationResult>('/api/admin/notifications/send', {
    method: 'POST',
    body: JSON.stringify({ userIds, title, body }),
  });
}
