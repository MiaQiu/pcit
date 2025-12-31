import type { StorageAdapter } from '../adapters/storage';
import type {
  Lesson,
  LessonListResponse,
  LessonDetailResponse,
  UpdateProgressRequest,
  SubmitQuizRequest,
  SubmitQuizResponse,
  LearningStatsResponse,
  UserLessonProgress,
  LessonPhase,
} from '../types';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import type AuthService from './authService';
import { ApiError } from '../errors/ApiError';

/**
 * Custom error for lesson not found (404)
 * Used to trigger cache invalidation in the mobile app
 */
export class LessonNotFoundError extends Error {
  constructor(message: string = 'Lesson not found') {
    super(message);
    this.name = 'LessonNotFoundError';
  }
}

/**
 * Lesson Service
 * Handles bite-size learning curriculum interactions
 */
class LessonService {
  private storage: StorageAdapter;
  private apiUrl: string;
  private authService: AuthService;
  private lessonCache: Map<string, LessonDetailResponse> = new Map();

  constructor(
    storage: StorageAdapter,
    apiUrl: string,
    authService: AuthService
  ) {
    this.storage = storage;
    this.apiUrl = apiUrl;
    this.authService = authService;
  }

  /**
   * Get all lessons with user progress
   * @param phase Optional filter by phase (CONNECT or DISCIPLINE)
   */
  async getLessons(phase?: LessonPhase): Promise<LessonListResponse> {
    const queryParam = phase ? `?phase=${phase}` : '';

    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/lessons${queryParam}`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(
        error.error || 'Failed to fetch lessons',
        response.status,
        response.statusText,
        error.code
      );
    }

    return response.json();
  }

  /**
   * Get lesson detail with segments and quiz
   * @param lessonId Lesson ID
   */
  async getLessonDetail(lessonId: string): Promise<LessonDetailResponse> {
    // Check cache first
    if (this.lessonCache.has(lessonId)) {
      return this.lessonCache.get(lessonId)!;
    }

    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/lessons/${lessonId}`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      // Handle 404 specifically - lesson no longer exists
      if (response.status === 404) {
        throw new LessonNotFoundError('Lesson not found - may have been updated');
      }
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch lesson detail');
    }

    const data = await response.json();

    // Cache the response
    this.lessonCache.set(lessonId, data);

    return data;
  }

  /**
   * Get the next lesson user should complete
   * Considers prerequisites and current progress
   */
  async getNextLesson(): Promise<Lesson | null> {
    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/lessons/next`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch next lesson');
    }

    const data = await response.json();
    return data.lesson || null;
  }

  /**
   * Get lessons that teach a specific category
   * Useful for showing "Review these lessons" when module recommended
   * @param category Recommendation category (PRAISE, ECHO, NARRATION, etc.)
   */
  async getLessonsByCategory(category: string): Promise<Lesson[]> {
    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/lessons/by-category/${category}`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch lessons by category');
    }

    const data = await response.json();
    return data.lessons || [];
  }

  /**
   * Update lesson progress
   * @param lessonId Lesson ID
   * @param progress Progress update data
   */
  async updateProgress(
    lessonId: string,
    progress: UpdateProgressRequest
  ): Promise<UserLessonProgress> {
    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/lessons/${lessonId}/progress`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(progress),
      }
    );

    if (!response.ok) {
      // Handle 404 specifically - lesson no longer exists
      if (response.status === 404) {
        throw new LessonNotFoundError('Lesson not found - may have been updated');
      }
      const error = await response.json();
      throw new Error(error.error || 'Failed to update progress');
    }

    return response.json();
  }

  /**
   * Submit quiz answer
   * @param quizId Quiz ID
   * @param answer Selected answer (option ID)
   */
  async submitQuizAnswer(
    quizId: string,
    answer: string
  ): Promise<SubmitQuizResponse> {
    const request: SubmitQuizRequest = {
      selectedAnswer: answer,
    };

    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/quizzes/${quizId}/submit`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to submit quiz answer');
    }

    return response.json();
  }

  /**
   * Get user's learning statistics
   */
  async getLearningStats(): Promise<LearningStatsResponse> {
    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/user/learning-stats`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch learning stats');
    }

    return response.json();
  }

  /**
   * Mark a lesson as completed
   * Convenience method that updates progress with COMPLETED status
   * @param lessonId Lesson ID
   */
  async completeLesson(lessonId: string): Promise<UserLessonProgress> {
    return this.updateProgress(lessonId, {
      currentSegment: 4, // Assuming 4 segments total
      status: 'COMPLETED',
    });
  }

  /**
   * Resume a lesson (update last viewed time)
   * @param lessonId Lesson ID
   * @param currentSegment Current segment number
   */
  async resumeLesson(
    lessonId: string,
    currentSegment: number,
    timeSpentSeconds?: number
  ): Promise<UserLessonProgress> {
    return this.updateProgress(lessonId, {
      currentSegment,
      timeSpentSeconds,
      status: 'IN_PROGRESS',
    });
  }
}

export default LessonService;
