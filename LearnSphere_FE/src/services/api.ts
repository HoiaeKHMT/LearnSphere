export type Role = 'student' | 'tutor' | 'admin';
export type EnrollmentType = 'open' | 'approval_required';

export type User = {
  id?: string;
  _id?: string;
  full_name: string;
  email: string;
  role: Role;
  account_status?: 'pending' | 'active' | 'blocked';
  avatar_key?: string;
  created_at?: string;
  updated_at?: string;
};

export type Course = {
  _id: string;
  title: string;
  description?: string;
  thumbnail_key?: string;
  enrollment_type?: EnrollmentType;
  created_by?: string | Pick<User, '_id' | 'full_name' | 'role'>;
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | Pick<User, '_id' | 'full_name' | 'role'> | null;
  deleted_reason?: string;
  enrollment_count?: number;
};

export type Enrollment = {
  _id: string;
  user_id: string | Pick<User, '_id' | 'full_name' | 'email' | 'role'>;
  course_id: Course | string;
  status: 'pending' | 'active';
  requested_at?: string;
  approved_at?: string | null;
};

export type Lesson = {
  _id: string;
  course_id: string;
  title: string;
  content?: string;
  video_key?: string;
  document_key?: string;
  order_index: number;
  ai_index_status?: 'not_indexed' | 'processing' | 'ready' | 'partial' | 'failed';
  ai_indexed_at?: string | null;
  ai_index_error?: string;
};

export type LessonAIIndexResult = {
  message: string;
  lesson_id: string;
  status: 'ready' | 'failed';
  indexed_at: string;
  document_indexed: boolean;
  issues: string[];
};

export type CourseProgress = {
  course_id: string;
  progress_percent: number;
  completed_lessons: number;
  total_lessons: number;
};

export type QuizDifficulty = 'basic' | 'medium' | 'advanced';

export type Quiz = {
  _id: string;
  course_id: string;
  title: string;
  description?: string;
  time_limit: number;
  difficulty: QuizDifficulty;
  createdAt?: string;
  updatedAt?: string;
};

export type QuizAnswer = {
  _id: string;
  content: string;
  is_correct?: boolean;
};

export type QuizQuestion = {
  _id: string;
  content: string;
  question_type: 'single_choice' | 'multiple_choice';
  point: number;
  answers: QuizAnswer[];
};

export type QuestionInput = {
  content: string;
  question_type: 'single_choice' | 'multiple_choice';
  point: number;
  answers: Array<{
    content: string;
    is_correct: boolean;
  }>;
};

export type AIUsage = {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
};

export type AIHistoryItem = {
  _id: string;
  course_id: string | null;
  lesson_id: string | null;
  user_message: string;
  ai_response: string;
  model_id?: string;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  stop_reason?: string;
  createdAt: string;
};

export type AIChatResponse = {
  id: string;
  reply: string;
  model_id: string;
  stop_reason?: string;
  usage: AIUsage | null;
};

export type AISummaryResponse = {
  lesson_id: string;
  summary: string;
  model_id: string;
  stop_reason?: string;
  usage: AIUsage | null;
  cached: boolean;
  generated_at?: string | null;
  ai_index_status?: Lesson['ai_index_status'];
  ai_indexed_at?: string | null;
  ai_index_error?: string;
};

export type AIGeneratedQuizResponse = {
  lesson_id: string;
  questions: QuestionInput[];
  model_id: string;
  usage: AIUsage | null;
};

export type QuizStart = {
  attempt_id: string;
  started_at: string;
  expires_at: string;
  time_limit: number;
  questions: QuizQuestion[];
};

export type PresignedDownload = {
  download_url: string;
  file_key: string;
  expires_in: number;
};

export type PresignedUpload = {
  upload_url: string;
  file_key: string;
  content_type: string;
  file_size: number;
  max_size_bytes: number;
  expires_in: number;
};

export type QuizAttemptResult = {
  attempt_id: string;
  status: 'in_progress' | 'submitted' | 'expired';
  score?: number;
  total_score?: number;
  correct_answers?: number;
  total_questions?: number;
  duration_seconds?: number;
  submitted_at?: string;
  started_at?: string;
  expires_at?: string;
  user_id?: string | Pick<User, '_id' | 'full_name' | 'email'>;
  answers?: Array<{
    question_id: string;
    question_content: string;
    selected_answers: Array<{ answer_id: string; content: string }>;
    is_correct: boolean;
    earned_point: number;
    max_point: number;
  }>;
};

export type AdminUser = User & {
  _id: string;
  account_status: 'pending' | 'active' | 'blocked';
  createdAt?: string;
  updatedAt?: string;
};

export type SystemStats = {
  generated_at: string;
  traffic: {
    total_requests: number;
    today_requests: number;
    unique_users_7d: number;
    failed_requests: number;
    error_rate_percent: number;
    average_response_ms: number;
    daily_requests: Array<{
      date: string;
      requests: number;
      failed_requests: number;
      unique_users: number;
    }>;
  };
  users: {
    total: number;
    active: number;
    pending: number;
    blocked: number;
    by_role: Record<Role, number>;
  };
  content: {
    active_courses: number;
    deleted_courses: number;
    total_lessons: number;
    total_quizzes: number;
    enrollments: { active: number; pending: number };
    quiz_attempts: { in_progress: number; submitted: number; expired: number };
  };
  storage: {
    status: 'available' | 'unavailable';
    used_bytes: number | null;
    object_count: number | null;
    capacity_bytes: number | null;
    usage_percent: number | null;
    message: string | null;
  };
};

export type NotificationItem = {
  _id: string;
  recipient_id: string;
  type: 'enrollment' | 'account' | 'system';
  title: string;
  message: string;
  link?: string;
  read_at?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CourseDiscussion = {
  _id: string;
  course_id: string;
  author_id: string | Pick<User, '_id' | 'full_name' | 'role'>;
  content: string;
  replies?: Array<{
    _id: string;
    author_id: string | Pick<User, '_id' | 'full_name' | 'role'>;
    content: string;
    created_at: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type NotificationsResponse = {
  items: NotificationItem[];
  unread_count: number;
};

type AuthResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

type RegisterResponse = {
  access_token: string | null;
  token_type: string | null;
  user: User;
  message: string;
};

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  auth?: boolean;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  retryAfterSeconds?: number;

  constructor(message: string, status: number, code?: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function getAIErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return error instanceof Error ? error.message : fallback;

  if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (error.status === 403) return 'Bạn không có quyền sử dụng AI trong khóa học hoặc bài học này.';
  if (error.code === 'AI_TIMEOUT') return 'AI xử lý tài liệu quá lâu và đã hết thời gian chờ. Vui lòng thử lại; nếu tiếp tục xảy ra, hãy giảm độ dài tài liệu.';
  if (error.code === 'AI_THROTTLED') return 'Dịch vụ AI đã hết quota hoặc đang giới hạn lưu lượng. Vui lòng thử lại sau.';
  if (error.code === 'AI_DOCUMENT_NOT_INDEXED') return 'Backend không OCR được document của bài học. Hãy xem trạng thái học liệu và kiểm tra PDF có bị lỗi hoặc đặt mật khẩu hay không.';
  if (error.code === 'AI_SUMMARY_NOT_READY') return 'Giảng viên chưa tạo bản tóm tắt cho tài liệu này.';
  if (error.code === 'AI_INDEX_IN_PROGRESS') return 'AI đang xử lý file bài học. Vui lòng đợi hoàn tất rồi thử lại.';
  if (error.code === 'AI_FILES_NOT_INDEXED') return 'Giảng viên cần tóm tắt học liệu bằng AI ít nhất một lần trước khi học viên sử dụng.';
	if (error.code === 'LESSON_DOCUMENT_REQUIRED') return 'Bài học cần có document để tạo bản tóm tắt.';
  if (error.code === 'AI_RATE_LIMITED') {
    return `Bạn đã gửi quá nhiều yêu cầu AI. Vui lòng thử lại sau ${error.retryAfterSeconds ?? 60} giây.`;
  }

  return error.message || fallback;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';
const TOKEN_KEY = 'learnsphere_access_token';
const USER_KEY = 'learnsphere_user';

export function getToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  const value = window.localStorage.getItem(USER_KEY);
  if (!value) return null;

  try {
    return JSON.parse(value) as User;
  } catch {
    return null;
  }
}

export function saveSession(auth: AuthResponse) {
  window.localStorage.setItem(TOKEN_KEY, auth.access_token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const hasBody = options.body !== undefined;

  if (hasBody && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.auth !== false) {
    const token = getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body: hasBody && !(options.body instanceof FormData) ? JSON.stringify(options.body) : (options.body as BodyInit | undefined),
  });

  const contentType = response.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (response.status === 401 && options.auth !== false) {
    clearSession();
    window.dispatchEvent(new Event('learnsphere:unauthorized'));
  }

  if (!response.ok) {
    throw new ApiError(
      data?.message ?? data?.detail ?? `Request failed with status ${response.status}`,
      response.status,
      data?.code,
      data?.retry_after_seconds,
    );
  }

  return data as T;
}

export const api = {
  login(email: string, password: string) {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      auth: false,
      body: { email, password },
    });
  },

  register(full_name: string, email: string, password: string, role: Role = 'student') {
    return request<RegisterResponse>('/auth/register', {
      method: 'POST',
      auth: false,
      body: { full_name, email, password, role },
    });
  },

  me() {
    return request<User>('/auth/me');
  },

  getCourses() {
    return request<Course[]>('/courses', { auth: false });
  },

  createCourse(body: { title: string; description?: string; enrollment_type?: EnrollmentType }) {
    return request<{ message: string; course: Course }>('/courses', {
      method: 'POST',
      body,
    });
  },

  updateCourse(courseId: string, body: { title?: string; description?: string; thumbnail_key?: string; enrollment_type?: EnrollmentType }) {
    return request<{ message: string; course: Course }>(`/courses/${courseId}`, {
      method: 'PUT',
      body,
    });
  },

  deleteCourse(courseId: string, deleted_reason?: string) {
    return request<{ message: string }>(`/courses/${courseId}`, {
      method: 'DELETE',
      body: { deleted_reason },
    });
  },

  getDeletedCourses() {
    return request<Course[]>('/courses/mine/deleted');
  },

  restoreCourse(courseId: string) {
    return request<{ message: string; course: Course }>(`/courses/${courseId}/restore`, {
      method: 'PATCH',
    });
  },

  permanentlyDeleteCourse(courseId: string) {
    return request<{
      message: string;
      course_id: string;
      deleted_s3_objects: number;
      deleted_records: Record<string, number>;
    }>(`/courses/${courseId}/permanent`, {
      method: 'DELETE',
    });
  },

  getCourseThumbnail(courseId: string) {
    return request<PresignedDownload>(`/files/course-thumbnail/${courseId}`, { auth: false });
  },

  getCourse(courseId: string) {
    return request<Course>(`/courses/${courseId}`, { auth: false });
  },

  enrollCourse(courseId: string) {
    return request<{ message: string; enrollment: Enrollment }>(`/courses/${courseId}/enroll`, {
      method: 'POST',
    });
  },

  unenrollCourse(courseId: string) {
    return request<{ message: string }>(`/courses/${courseId}/enroll`, {
      method: 'DELETE',
    });
  },

  getCourseEnrollments(courseId: string, status: 'pending' | 'active' = 'pending') {
    return request<Enrollment[]>(`/courses/${courseId}/enrollments?status=${status}`);
  },

  approveEnrollment(courseId: string, enrollmentId: string) {
    return request<{ message: string; enrollment: Enrollment }>(`/courses/${courseId}/enrollments/${enrollmentId}/approve`, {
      method: 'PATCH',
    });
  },

  rejectEnrollment(courseId: string, enrollmentId: string) {
    return request<{ message: string }>(`/courses/${courseId}/enrollments/${enrollmentId}`, {
      method: 'DELETE',
    });
  },

  getMyCourses() {
    return request<Enrollment[]>('/users/me/courses');
  },

  getLessons(courseId: string) {
    return request<Lesson[]>(`/courses/${courseId}/lessons`);
  },

  createLesson(courseId: string, body: { title: string; content?: string; video_key?: string; document_key?: string; order_index: number }) {
    return request<{ message: string; lesson: Lesson }>(`/courses/${courseId}/lessons`, {
      method: 'POST',
      body,
    });
  },

  getLesson(lessonId: string) {
    return request<Lesson>(`/lessons/${lessonId}`);
  },

  updateLesson(lessonId: string, body: { title?: string; content?: string; video_key?: string; document_key?: string; order_index?: number }) {
    return request<{ message: string; lesson: Lesson }>(`/lessons/${lessonId}`, {
      method: 'PUT',
      body,
    });
  },

  indexLessonForAI(lessonId: string) {
    return request<LessonAIIndexResult>(`/lessons/${lessonId}/ai-index`, {
      method: 'POST',
    });
  },

  deleteLesson(lessonId: string) {
    return request<{ message: string }>(`/lessons/${lessonId}`, {
      method: 'DELETE',
    });
  },

  completeLesson(lessonId: string) {
    return request<{ message: string }>(`/lessons/${lessonId}/complete`, {
      method: 'POST',
    });
  },

  getCourseProgress(courseId: string) {
    return request<CourseProgress>(`/courses/${courseId}/progress`);
  },

  chatWithAI(body: { message: string; course_id?: string; lesson_id?: string }) {
    return request<AIChatResponse>('/ai/chat', {
      method: 'POST',
      body,
    });
  },

  summarizeLesson(lessonId: string, forceRegenerate = false) {
    return request<AISummaryResponse>(`/ai/summarize-lesson/${lessonId}`, {
      method: 'POST',
      body: { force_regenerate: forceRegenerate },
    });
  },

  generateQuizWithAI(body: { lesson_id: string; number_of_questions: number }) {
    return request<AIGeneratedQuizResponse>('/ai/generate-quiz', {
      method: 'POST',
      body,
    });
  },

  getAIHistory(filters: { course_id?: string; lesson_id?: string; limit?: number } = {}) {
    const params = new URLSearchParams();
    if (filters.course_id) params.set('course_id', filters.course_id);
    if (filters.lesson_id) params.set('lesson_id', filters.lesson_id);
    if (filters.limit) params.set('limit', String(filters.limit));
    const query = params.toString();
    return request<{ items: AIHistoryItem[] }>(`/ai/history${query ? `?${query}` : ''}`);
  },

  deleteAIHistory(filters: { course_id?: string; lesson_id?: string } = {}) {
    const params = new URLSearchParams();
    if (filters.course_id) params.set('course_id', filters.course_id);
    if (filters.lesson_id) params.set('lesson_id', filters.lesson_id);
    const query = params.toString();
    return request<{ message: string; deleted_count: number }>(`/ai/history${query ? `?${query}` : ''}`, {
      method: 'DELETE',
    });
  },

  getCourseQuizzes(courseId: string) {
    return request<Quiz[]>(`/courses/${courseId}/quizzes`);
  },

  getCourseDiscussions(courseId: string) {
    return request<CourseDiscussion[]>(`/courses/${courseId}/discussions`);
  },

  createCourseDiscussion(courseId: string, content: string) {
    return request<{ message: string; discussion: CourseDiscussion }>(`/courses/${courseId}/discussions`, {
      method: 'POST',
      body: { content },
    });
  },

  createCourseDiscussionReply(courseId: string, discussionId: string, content: string) {
    return request<{ message: string; discussion: CourseDiscussion }>(`/courses/${courseId}/discussions/${discussionId}/replies`, {
      method: 'POST',
      body: { content },
    });
  },

  createQuiz(courseId: string, body: { title: string; description?: string; time_limit: number; difficulty: QuizDifficulty }) {
    return request<{ message: string; quiz: Quiz }>(`/courses/${courseId}/quizzes`, {
      method: 'POST',
      body,
    });
  },

  updateQuiz(quizId: string, body: { title?: string; description?: string; time_limit?: number; difficulty?: QuizDifficulty }) {
    return request<{ message: string; quiz: Quiz }>(`/quizzes/${quizId}`, {
      method: 'PUT',
      body,
    });
  },

  deleteQuiz(quizId: string) {
    return request<{ message: string }>(`/quizzes/${quizId}`, {
      method: 'DELETE',
    });
  },

  getQuizQuestions(quizId: string) {
    return request<QuizQuestion[]>(`/quizzes/${quizId}/questions`);
  },

  createQuizQuestion(quizId: string, body: QuestionInput) {
    return request<{ message: string; question: QuizQuestion }>(`/quizzes/${quizId}/questions`, {
      method: 'POST',
      body,
    });
  },

  updateQuizQuestion(quizId: string, questionId: string, body: Partial<QuestionInput>) {
    return request<{ message: string; question: QuizQuestion }>(`/quizzes/${quizId}/questions/${questionId}`, {
      method: 'PUT',
      body,
    });
  },

  deleteQuizQuestion(quizId: string, questionId: string) {
    return request<{ message: string }>(`/quizzes/${quizId}/questions/${questionId}`, {
      method: 'DELETE',
    });
  },

  startQuiz(quizId: string) {
    return request<QuizStart>(`/quizzes/${quizId}/start`, {
      method: 'POST',
    });
  },

  submitQuiz(attemptId: string, answers: Array<{ question_id: string; selected_answer_ids: string[] }>) {
    return request<QuizAttemptResult>(`/quiz-attempts/${attemptId}/submit`, {
      method: 'POST',
      body: { answers },
    });
  },

  getQuizAttempts(quizId: string) {
    return request<QuizAttemptResult[]>(`/quizzes/${quizId}/attempts`);
  },

  getAttemptById(attemptId: string) {
    return request<QuizAttemptResult>(`/quiz-attempts/${attemptId}`);
  },

  createPresignedUpload(body: { course_id: string; file_name: string; content_type: string; file_size: number; folder: 'thumbnails' | 'lessons/videos' | 'lessons/documents' }) {
    return request<PresignedUpload>('/files/presigned-upload', {
      method: 'POST',
      body,
    });
  },

  createPresignedDownload(lessonId: string, targetType: 'video' | 'document') {
    return request<PresignedDownload>(`/files/presigned-download?lesson_id=${lessonId}&target_type=${targetType}`);
  },

  uploadFileToS3(uploadUrl: string, file: File, onProgress?: (percent: number) => void) {
    return new Promise<boolean>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      };

      xhr.onerror = () => {
        reject(new Error('Không thể kết nối tới S3. Hãy kiểm tra CORS của bucket và kết nối mạng.'));
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          resolve(true);
          return;
        }

        const s3Code = xhr.responseText.match(/<Code>([^<]+)<\/Code>/)?.[1];
        const s3Message = xhr.responseText.match(/<Message>([^<]+)<\/Message>/)?.[1];
        const detail = [s3Code, s3Message].filter(Boolean).join(': ');
        reject(new Error(
          `Upload file lên S3 thất bại (${xhr.status}${detail ? ` - ${detail}` : ''}). ` +
          'Hãy xin URL mới và kiểm tra AWS credentials, IAM PutObject và bucket CORS.',
        ));
      };

      xhr.send(file);
    });
  },

  forgotPassword(email: string) {
    return request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      auth: false,
      body: { email },
    });
  },

  resetPassword(token: string, password: string) {
    return request<{ message: string }>(`/auth/reset-password/${token}`, {
      method: 'PATCH',
      auth: false,
      body: { password },
    });
  },

  getUsers(filters: { role?: Role; account_status?: 'pending' | 'active' | 'blocked' } = {}) {
    const params = new URLSearchParams();
    if (filters.role) params.set('role', filters.role);
    if (filters.account_status) params.set('account_status', filters.account_status);
    const query = params.toString();
    return request<AdminUser[]>(`/users${query ? `?${query}` : ''}`);
  },

  updateProfile(body: { full_name?: string; avatar_key?: string | null }) {
    return request<{ message: string; user: User }>('/users/me', {
      method: 'PATCH',
      body,
    });
  },

  createProfileAvatarUpload(file: File) {
    return request<PresignedUpload>('/files/profile-avatar/presigned-upload', {
      method: 'POST',
      body: {
        file_name: file.name,
        content_type: file.type,
        file_size: file.size,
      },
    });
  },

  getProfileAvatar() {
    return request<PresignedDownload>('/files/profile-avatar');
  },

  getSystemStats() {
    return request<SystemStats>('/stats');
  },

  getNotifications(limit = 20) {
    return request<NotificationsResponse>(`/notifications?limit=${limit}`);
  },

  markNotificationAsRead(notificationId: string) {
    return request<NotificationItem>(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
  },

  markAllNotificationsAsRead() {
    return request<{ message: string }>('/notifications/read-all', {
      method: 'PATCH',
    });
  },

  updateAccountStatus(userId: string, account_status: 'active' | 'blocked') {
    return request<{ message: string; user: AdminUser }>(`/users/${userId}/status`, {
      method: 'PATCH',
      body: { account_status },
    });
  },

  updateTutorStatus(userId: string, account_status: 'active' | 'blocked') {
    return this.updateAccountStatus(userId, account_status);
  },
};
