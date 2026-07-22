import { useEffect, useState } from 'react';
import { AppHeader } from '../components/AppHeader';
import { AppToast } from '../components/AppToast';
import { RoleSidebar } from '../components/RoleSidebar';
import { SphereAIButton } from '../components/SphereAIButton';
import { api, getStoredUser, type Course, type Quiz, type QuizAttemptResult, type QuizDifficulty, type QuizQuestion } from '../services/api';

const avatarSrc =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCZTzrqinlRFUY1sswmWehy8W9-29UTDjuk86zxLTpDBEFl9w08RLopb5YVU57I-aa19Wl9VrS0edpsQR8xNt48XxF1X06NouIMiuMjCWVN7cjl4ww1TiG2Pzg010a9XNX4VZzhTP0WiiWisWlLR1VOTkgHhhqDiv0wk-TTOJlMwCEETJlt1QJFPrKE6ZFQUNlNCvSgAloR1vE9Ne5LK0MsLRjk_Gb2QyISPjX-_TGececa2Y5py_eOfw';

function getRoleLabel(role?: string) {
  if (role === 'admin') return 'Quản trị viên';
  if (role === 'tutor') return 'Giảng viên';
  if (role === 'student') return 'Học viên';
  return 'Khách';
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

type QuizStatusFilter = 'all' | 'completed' | 'not_started';
type DifficultyFilter = 'all' | 'basic' | 'medium' | 'advanced';

function getQuizDifficulty(quiz: Quiz): QuizDifficulty {
  return quiz.difficulty ?? 'basic';
}

function getDifficultyLabel(difficulty: QuizDifficulty) {
  if (difficulty === 'advanced') return 'Nâng cao';
  if (difficulty === 'medium') return 'Trung bình';
  return 'Cơ bản';
}

function wasUpdatedRecently(updatedAt?: string) {
  if (!updatedAt) return false;
  const updatedTime = Date.parse(updatedAt);
  if (!Number.isFinite(updatedTime)) return false;
  const age = Date.now() - updatedTime;
  return age >= 0 && age <= 7 * 24 * 60 * 60 * 1000;
}

export function QuizPage() {
  const params = new URLSearchParams(window.location.search);
  const courseId = params.get('course_id');
  const initialQuizId = params.get('quiz_id');
  const user = getStoredUser();
  
  const [myCourses, setMyCourses] = useState<{ _id: string; title: string }[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState(courseId ?? '');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState(initialQuizId ?? '');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string[]>>({});
  const [attemptId, setAttemptId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [submittedResult, setSubmittedResult] = useState<QuizAttemptResult | null>(null);
  const [attemptsHistory, setAttemptsHistory] = useState<QuizAttemptResult[]>([]);
  const [attemptsByQuizId, setAttemptsByQuizId] = useState<Record<string, QuizAttemptResult[]>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [quizStatusFilter, setQuizStatusFilter] = useState<QuizStatusFilter>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');

  const [hasStarted, setHasStarted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  async function refreshQuizAttempts(items = quizzes) {
    if (user?.role !== 'student' || !items.length) {
      setAttemptsByQuizId({});
      return;
    }

    const entries = await Promise.all(
      items.map(async (quiz) => {
        try {
          const history = await api.getQuizAttempts(quiz._id);
          return [quiz._id, history] as const;
        } catch {
          return [quiz._id, []] as const;
        }
      }),
    );
    setAttemptsByQuizId(Object.fromEntries(entries));
  }

  // Load user's courses if no courseId specified in URL
  useEffect(() => {
    if (user?.role === 'student') {
      api.getMyCourses()
        .then((enrollments) => {
          const activeCourses = enrollments
            .filter((e) => e.status === 'active' && typeof e.course_id === 'object' && e.course_id !== null)
            .map((e) => {
              const c = e.course_id as Course;
              return { _id: c._id, title: c.title };
            });
          setMyCourses(activeCourses);

          if (!selectedCourseId && activeCourses[0]) {
            setSelectedCourseId(activeCourses[0]._id);
          }
        })
        .catch(() => {});
    } else {
      api.getCourses()
        .then((items) => {
          setMyCourses(items.map((c) => ({ _id: c._id, title: c.title })));
          if (!selectedCourseId && items[0]) {
            setSelectedCourseId(items[0]._id);
          }
        })
        .catch(() => {});
    }
  }, [user?.role]);

  // Load quizzes in selected course
  useEffect(() => {
    if (!selectedCourseId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setMessage('');
    api.getCourseQuizzes(selectedCourseId)
      .then((items) => {
        setQuizzes(items);
        void refreshQuizAttempts(items);
        if (items.length > 0) {
          if (!items.some((q) => q._id === selectedQuizId)) {
            setSelectedQuizId(items[0]._id);
          }
        } else {
          setSelectedQuizId('');
          setQuestions([]);
        }
      })
      .catch((err) => setMessage(err instanceof Error ? err.message : 'Không thể tải danh sách quiz'))
      .finally(() => setIsLoading(false));
  }, [selectedCourseId]);

  useEffect(() => {
    if (user?.role !== 'student' || !quizzes.length || hasStarted) return;

    const intervalId = window.setInterval(() => {
      void refreshQuizAttempts(quizzes);
    }, 10000);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizzes, user?.role, hasStarted]);

  // Load selected quiz details / history when quiz selection changes
  useEffect(() => {
    if (!selectedQuizId) return;

    setIsLoading(true);
    setHasStarted(false);
    setQuestions([]);
    setSelectedAnswers({});
    setAttemptId('');
    setExpiresAt('');
    setTimeLeft(0);
    setSubmittedResult(null);
    setMessage('');

    if (user?.role === 'student') {
      // Fetch attempt history for preview
      api.getQuizAttempts(selectedQuizId)
        .then((history) => setAttemptsHistory(history))
        .catch(() => setAttemptsHistory([]))
        .finally(() => setIsLoading(false));
    } else {
      // Tutor / Admin view questions & attempt history
      Promise.all([
        api.getQuizQuestions(selectedQuizId),
        api.getQuizAttempts(selectedQuizId).catch(() => []),
      ])
        .then(([qList, history]) => {
          setQuestions(qList);
          setAttemptsHistory(history);
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : 'Không thể tải câu hỏi quiz'))
        .finally(() => setIsLoading(false));
    }
  }, [selectedQuizId, user?.role]);

  async function handleStartQuiz(targetQuizId?: string) {
    const quizIdToStart = targetQuizId || selectedQuizId;
    if (!quizIdToStart || isStarting) return;

    setSelectedQuizId(quizIdToStart);
    setIsStarting(true);
    setMessage('');

    try {
      const attempt = await api.startQuiz(quizIdToStart);
      setAttemptId(attempt.attempt_id);
      setExpiresAt(attempt.expires_at);
      const remainingSeconds = Math.max(0, Math.floor((new Date(attempt.expires_at).getTime() - Date.now()) / 1000));
      setTimeLeft(remainingSeconds);
      setQuestions(attempt.questions);
      setHasStarted(true);
      await refreshQuizAttempts(quizzes);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Không thể khởi tạo bài kiểm tra';
      if (errMsg.includes('QUIZ_HAS_NO_QUESTIONS') || errMsg.includes('no questions')) {
        setMessage('Bài kiểm tra này hiện chưa có câu hỏi nào. Vui lòng liên hệ giảng viên.');
      } else if (errMsg.includes('ACTIVE_ENROLLMENT_REQUIRED')) {
        setMessage('Bạn chưa đăng ký hoặc yêu cầu tham gia khóa học này đang chờ Giảng viên duyệt (Chưa Active).');
      } else {
        setMessage(errMsg);
      }
    } finally {
      setIsStarting(false);
    }
  }

  // Countdown Timer & Auto-submit
  useEffect(() => {
    if (!expiresAt || submittedResult) return;

    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining === 0 && !isSubmitting && !submittedResult) {
        window.clearInterval(timer);
        setMessage('Thời gian làm bài đã hết! Hệ thống đang tự động nộp bài...');
        void handleDoSubmit();
      }
    }, 1000);

    return () => window.clearInterval(timer);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt, submittedResult, isSubmitting]);

  const answeredCount = Object.values(selectedAnswers).filter((answerIds) => answerIds.length > 0).length;
  const progressPercent = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;
  const visibleQuizzes = quizzes.filter((quiz) => {
    const completed = (attemptsByQuizId[quiz._id] ?? []).some((attempt) => attempt.status === 'submitted');
    const difficulty = getQuizDifficulty(quiz);
    const matchesStatus =
      quizStatusFilter === 'all' ||
      (quizStatusFilter === 'completed' ? completed : !completed);
    const matchesDifficulty = difficultyFilter === 'all' || difficultyFilter === difficulty;

    return matchesStatus && matchesDifficulty;
  });

  function getQuizCardStatus(quizId: string) {
    const attempts = attemptsByQuizId[quizId] ?? [];
    const submittedAttempts = attempts.filter((attempt) => attempt.status === 'submitted');
    const inProgressAttempt = attempts.find((attempt) => attempt.status === 'in_progress');
    const expiredAttempt = attempts.find((attempt) => attempt.status === 'expired');
    const latestSubmitted = submittedAttempts[0];

    if (latestSubmitted) {
      const score = latestSubmitted.score ?? 0;
      const total = latestSubmitted.total_score ?? 0;
      const percent = total ? Math.round((score / total) * 100) : 100;
      return {
        label: `Hoàn thành · ${score}/${total}`,
        percent,
        tone: 'completed' as const,
      };
    }

    if (inProgressAttempt) {
      return { label: 'Đang làm', percent: 42, tone: 'active' as const };
    }

    if (expiredAttempt) {
      return { label: 'Hết giờ', percent: 100, tone: 'expired' as const };
    }

    return { label: 'Chưa bắt đầu', percent: 0, tone: 'idle' as const };
  }

  function toggleAnswer(question: QuizQuestion, answerId: string) {
    if (submittedResult) return; // Locked if already submitted

    setSelectedAnswers((current) => {
      const existing = current[question._id] ?? [];
      if (question.question_type === 'single_choice') {
        return { ...current, [question._id]: [answerId] };
      }

      return {
        ...current,
        [question._id]: existing.includes(answerId)
          ? existing.filter((id) => id !== answerId)
          : [...existing, answerId],
      };
    });
  }

  async function handleDoSubmit() {
    if (!attemptId || isSubmitting) return;

    setIsSubmitting(true);
    setMessage('');

    const formattedAnswers = Object.entries(selectedAnswers).map(([questionId, selectedIds]) => ({
      question_id: questionId,
      selected_answer_ids: selectedIds,
    }));

    try {
      const result = await api.submitQuiz(attemptId, formattedAnswers);
      setSubmittedResult(result);
      setMessage('Nộp bài thành công!');
      // Refresh history
      if (selectedQuizId) {
        const history = await api.getQuizAttempts(selectedQuizId).catch(() => []);
        setAttemptsHistory(history);
        setAttemptsByQuizId((current) => ({ ...current, [selectedQuizId]: history }));
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Nộp bài thất bại. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#070d19] text-[#e7ecff] selection:bg-[#adc7ff]/30">
      <AppHeader user={user} roleLabel={getRoleLabel(user?.role)} avatarSrc={avatarSrc} />
      <AppToast message={message} tone={message.includes('thành công') ? 'success' : message.startsWith('Thời gian') ? 'loading' : 'warning'} onClose={() => setMessage('')} />

      <RoleSidebar activePath="/quiz" user={user} />

      <main className="mx-auto w-full max-w-[1320px] flex-grow space-y-6 px-4 py-6 md:pl-64 md:pr-8">
        {hasStarted && !submittedResult && (
        <section className="rounded-2xl border border-[#253047] bg-[#111827]/92 p-5 shadow-xl shadow-black/20">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
            <div>
              <h1 className="mb-1 text-[26px] font-semibold leading-8 text-[#dde2f4]">Bài kiểm tra (Quiz)</h1>
              {attemptId && <p className="mt-2 font-mono text-[12px] text-[#8b90a0]">Attempt ID: {attemptId}</p>}
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {attemptsHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-2 rounded-xl border border-[#354055] bg-[#070d19] px-4 py-2 font-mono text-[13px] text-[#adc7ff] hover:bg-[#151e2d]"
                >
                  <span className="material-symbols-outlined text-[18px]">history</span>
                  {showHistory ? 'Ẩn lịch sử' : `Lịch sử làm bài (${attemptsHistory.length})`}
                </button>
              )}

              {expiresAt && !submittedResult && (
                <div className="flex w-fit items-center gap-3 rounded-xl border border-[#354055] bg-[#070d19] px-6 py-2">
                  <span className="material-symbols-outlined animate-pulse text-[#adc7ff]">schedule</span>
                  <span className="font-mono text-[14px] font-medium text-[#adc7ff]">{formatTime(timeLeft)} còn lại</span>
                </div>
              )}
            </div>
          </div>

          {!submittedResult && (
            <div className="mt-6 space-y-2">
              <div className="flex items-end justify-between">
                <span className="font-mono text-[14px] font-medium text-[#dde2f4]">Đã chọn {answeredCount}/{questions.length} câu</span>
                <span className="font-mono text-[12px] text-[#c1c6d7]">{progressPercent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#2f3542]">
                <div className="h-full rounded-full bg-[#ffc080] transition-all duration-500" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          )}
        </section>
        )}

        {/* Attempt History Section */}
        {showHistory && (
          <section className="rounded-2xl border border-[#253047] bg-[#111827]/92 p-5 shadow-xl shadow-black/20">
            <h3 className="mb-4 text-[20px] font-semibold text-[#dde2f4]">Lịch sử nộp bài</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[14px]">
                <thead className="border-b border-[#414754] text-[#8b90a0]">
                  <tr>
                    <th className="pb-3">Thời gian nộp</th>
                    <th className="pb-3">Trạng thái</th>
                    <th className="pb-3">Số câu đúng</th>
                    <th className="pb-3">Điểm số</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#414754]/40">
                  {attemptsHistory.map((item) => (
                    <tr key={item.attempt_id || (item as unknown as { _id: string })._id}>
                      <td className="py-3 text-[#dde2f4]">{item.submitted_at ? new Date(item.submitted_at).toLocaleString('vi-VN') : '--'}</td>
                      <td className="py-3">
                        <span className={`rounded px-2 py-0.5 text-[12px] ${item.status === 'submitted' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {item.status === 'submitted' ? 'Đã nộp' : item.status === 'expired' ? 'Hết giờ' : 'Đang làm'}
                        </span>
                      </td>
                      <td className="py-3 text-[#c1c6d7]">{item.correct_answers ?? 0}/{item.total_questions ?? '--'}</td>
                      <td className="py-3 font-bold text-[#24dfba]">{item.score ?? 0}/{item.total_score ?? '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Course Selector Only */}
        {!hasStarted && !submittedResult && (
          <div className="space-y-6">
            {myCourses.length > 0 && (
              <label className="hidden max-w-md rounded-2xl border border-[#253047] bg-[#111827]/92 p-4 shadow-xl shadow-black/20">
                <span className="mb-2 block font-mono text-[12px] uppercase tracking-wider text-[#8b90a0]">Chọn khóa học</span>
                <select
                  className="w-full rounded-xl border border-[#354055] bg-[#070d19] px-4 py-3 font-medium text-[#e7ecff] outline-none focus:border-[#8fb7ff]"
                  value={selectedCourseId}
                  onChange={(event) => setSelectedCourseId(event.target.value)}
                >
                  <option value="">-- Chọn khóa học --</option>
                  {myCourses.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {/* List of Quizzes in Course */}
            <div className="quiz-library-panel rounded-2xl border border-[#253047] bg-[#111827]/92 p-7 shadow-2xl shadow-black/25">
              <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#24dfba]/25 bg-[#24dfba]/10 px-4 py-1.5 font-mono text-[12px] font-bold uppercase tracking-wider text-[#24dfba]">
                    <span className="material-symbols-outlined text-[18px]">quiz</span>
                    Quiz library
                  </span>
                  <h2 className="mt-3 text-[24px] font-black text-white">Danh sách bài kiểm tra</h2>
                  <p className="mt-1 text-[14px] text-[#8f9bb3]">Chọn một bài quiz để luyện tập và kiểm tra kiến thức trong khóa học.</p>
                </div>
                <span className="rounded-xl border border-[#354055] bg-[#070d19] px-5 py-3 font-mono text-[14px] text-[#adc7ff]">
                  {visibleQuizzes.length}/{quizzes.length} quiz
                </span>
              </div>
              <h2 className="hidden">
                Danh sách bài kiểm tra ({quizzes.length})
              </h2>

              <div className="mb-5 flex flex-wrap items-center gap-3">
                <div className="flex items-center rounded-xl border border-[#253047] bg-[#070d19] p-1.5">
                  {[
                    { value: 'all', label: 'Tất cả' },
                    { value: 'completed', label: 'Đã hoàn thành' },
                    { value: 'not_started', label: 'Chưa bắt đầu' },
                  ].map((item) => (
                    <button
                      key={item.value}
                      className={`rounded-lg px-4 py-2.5 text-[14px] font-bold transition ${
                        quizStatusFilter === item.value
                          ? 'bg-[#adc7ff] text-[#00285b]'
                          : 'text-[#b8c1d6] hover:bg-[#111827] hover:text-white'
                      }`}
                      type="button"
                      onClick={() => setQuizStatusFilter(item.value as QuizStatusFilter)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <select
                  className="h-10 rounded-xl border border-[#253047] bg-[#070d19] px-3 text-[12px] font-bold text-[#e7ecff] outline-none focus:border-[#8fb7ff]"
                  value={difficultyFilter}
                  onChange={(event) => setDifficultyFilter(event.target.value as DifficultyFilter)}
                >
                  <option value="all">Độ khó: Tất cả</option>
                  <option value="basic">Cơ bản</option>
                  <option value="medium">Trung bình</option>
                  <option value="advanced">Nâng cao</option>
                </select>

                {myCourses.length > 0 && (
                  <select
                    className="h-10 rounded-xl border border-[#253047] bg-[#070d19] px-3 text-[12px] font-bold text-[#e7ecff] outline-none focus:border-[#8fb7ff]"
                    value={selectedCourseId}
                    onChange={(event) => setSelectedCourseId(event.target.value)}
                  >
                    <option value="">Khóa học: Tất cả</option>
                    {myCourses.map((course) => (
                      <option key={course._id} value={course._id}>
                        Khóa học: {course.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {isLoading && <p className="font-mono text-[13px] text-[#8b90a0]">Đang tải danh sách bài kiểm tra...</p>}

              {!isLoading && visibleQuizzes.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[#354055] bg-[#111827]/92 p-10 text-center shadow-xl shadow-black/20">
                  <span className="material-symbols-outlined mb-3 text-[44px] text-[#8b90a0]">quiz</span>
                  <h3 className="text-[20px] font-semibold text-[#dde2f4]">Chưa có bài kiểm tra nào</h3>
                  <p className="mt-2 text-[#8b90a0]">Khóa học này hiện chưa có bài kiểm tra do Giảng viên tạo.</p>
                </div>
              )}

              {!isLoading && visibleQuizzes.length > 0 && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {visibleQuizzes.map((quiz) => {
                    const difficulty = getQuizDifficulty(quiz);
                    const isChallenge = difficulty === 'advanced';
                    const isNewlyUpdated = !isChallenge && wasUpdatedRecently(quiz.updatedAt);
                    const accent = difficulty === 'advanced' ? 'orange' : difficulty === 'medium' ? 'blue' : 'green';
                    const cardStatus = user?.role === 'student'
                      ? getQuizCardStatus(quiz._id)
                      : {
                          label: selectedQuizId === quiz._id ? 'Đang xem' : 'Sẵn sàng',
                          percent: selectedQuizId === quiz._id ? 100 : 0,
                          tone: selectedQuizId === quiz._id ? 'active' as const : 'idle' as const,
                        };
                    const progressTone = cardStatus.tone === 'completed'
                      ? 'bg-[#24dfba]'
                      : cardStatus.tone === 'active'
                        ? 'bg-[#ffc080]'
                        : cardStatus.tone === 'expired'
                          ? 'bg-[#ffb4ab]'
                          : accent === 'orange' ? 'bg-[#ffc080]' : accent === 'green' ? 'bg-[#24dfba]' : 'bg-[#adc7ff]';

                    return (
                    <article key={quiz._id} className={`group flex min-h-[380px] flex-col justify-between overflow-hidden rounded-2xl border border-[#253047] bg-[#070d19] shadow-2xl shadow-black/25 transition-all duration-300 ${accent === 'orange' ? 'hover:border-[#ffc080]/35' : accent === 'green' ? 'hover:border-[#24dfba]/35' : 'hover:border-[#adc7ff]/35'}`}>
                      <div className="p-7">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            {isChallenge && (
                              <span className="rounded-full bg-[#ffc080]/10 px-4 py-1.5 font-mono text-[11px] font-black uppercase tracking-wider text-[#ffc080]">Thử thách</span>
                            )}
                            {isNewlyUpdated && (
                              <span className="rounded-full bg-[#24dfba]/10 px-4 py-1.5 font-mono text-[11px] font-black uppercase tracking-wider text-[#24dfba]">Mới cập nhật</span>
                            )}
                          </div>
                          <span className="flex items-center gap-1.5 rounded-xl bg-[#111827] px-3 py-1.5 font-mono text-[14px] font-bold text-[#e7ecff]">
                            <span className="material-symbols-outlined text-[16px]">schedule</span>
                            {quiz.time_limit} phút
                          </span>
                        </div>
                        <h3 className="mt-3 text-[20px] font-semibold leading-7 text-[#dde2f4]">{quiz.title}</h3>
                        <p className="mt-2 line-clamp-2 text-[14px] leading-6 text-[#c1c6d7]">
                          {quiz.description || 'Bài kiểm tra đánh giá kiến thức khóa học.'}
                        </p>
                        <div className="mt-5 grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-2 rounded-xl bg-[#111827] px-3 py-2">
                            <span className="material-symbols-outlined text-[17px] text-[#adc7ff]">format_list_numbered</span>
                            <span className="font-mono text-[11px] text-[#b8c1d6]">Câu hỏi</span>
                          </div>
                          <div className="flex items-center gap-2 rounded-xl bg-[#111827] px-3 py-2">
                            <span className="material-symbols-outlined text-[17px] text-[#adc7ff]">military_tech</span>
                            <span className="font-mono text-[11px] text-[#b8c1d6]">{getDifficultyLabel(difficulty)}</span>
                          </div>
                        </div>
                        <div className="mt-5">
                          <div className="quiz-card-status mb-2 flex justify-between font-mono text-[11px]">
                            <span className="text-[#8f9bb3]">Trạng thái: {cardStatus.label}</span>
                            <span className={cardStatus.tone === 'completed' ? 'text-[#24dfba]' : cardStatus.tone === 'active' ? 'text-[#ffc080]' : cardStatus.tone === 'expired' ? 'text-[#ffb4ab]' : 'text-[#8f9bb3]'}>{cardStatus.percent}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-[#111827]">
                            <div className={`h-full rounded-full transition-all duration-500 ${progressTone}`} style={{ width: `${cardStatus.percent}%` }} />
                          </div>
                        </div>
                      </div>

                      <div className="mt-auto flex items-center justify-between border-t border-[#253047] bg-[#111827]/70 p-5">
                        {user?.role === 'student' ? (
                          <button
                            type="button"
                            onClick={() => void handleStartQuiz(quiz._id)}
                            disabled={isStarting}
                            className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 font-mono text-[15px] font-black text-[#00285b] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 ${accent === 'orange' ? 'bg-[#ffc080]' : accent === 'green' ? 'bg-[#24dfba]' : 'bg-[#adc7ff]'}`}
                          >
                            <span className="material-symbols-outlined text-[20px]">play_circle</span>
                            {isStarting && selectedQuizId === quiz._id ? 'Đang khởi tạo...' : 'Bắt đầu làm bài'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedQuizId(quiz._id)}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#adc7ff]/50 bg-[#adc7ff]/10 py-3 font-mono text-[13px] font-black text-[#adc7ff] transition hover:bg-[#adc7ff]/20"
                          >
                            Xem câu hỏi
                          </button>
                        )}
                      </div>
                    </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {isLoading && <p className="font-mono text-[12px] text-[#8b90a0]">Đang tải dữ liệu quiz...</p>}

        {/* Submitted Results Display */}
        {submittedResult && (
          <section className="rounded-2xl border border-[#24dfba]/40 bg-[#24dfba]/10 p-8 text-center shadow-xl shadow-black/20">
            <span className="material-symbols-outlined text-[64px] text-[#24dfba]">workspace_premium</span>
            <h2 className="mt-2 text-[28px] font-bold text-[#dde2f4]">Kết quả làm bài</h2>
            
            <div className="mt-6 grid grid-cols-2 gap-4 max-w-md mx-auto sm:grid-cols-4">
              <div className="rounded-lg border border-[#414754] bg-[#0d131f] p-4">
                <p className="font-mono text-[11px] uppercase text-[#8b90a0]">Điểm số</p>
                <p className="mt-1 text-[24px] font-bold text-[#24dfba]">{submittedResult.score}/{submittedResult.total_score}</p>
              </div>
              <div className="rounded-lg border border-[#414754] bg-[#0d131f] p-4">
                <p className="font-mono text-[11px] uppercase text-[#8b90a0]">Số câu đúng</p>
                <p className="mt-1 text-[24px] font-bold text-[#adc7ff]">{submittedResult.correct_answers}/{submittedResult.total_questions}</p>
              </div>
              <div className="rounded-lg border border-[#414754] bg-[#0d131f] p-4">
                <p className="font-mono text-[11px] uppercase text-[#8b90a0]">Thời gian</p>
                <p className="mt-1 text-[24px] font-bold text-[#ffc080]">{formatTime(submittedResult.duration_seconds ?? 0)}</p>
              </div>
              <div className="rounded-lg border border-[#414754] bg-[#0d131f] p-4">
                <p className="font-mono text-[11px] uppercase text-[#8b90a0]">Trạng thái</p>
                <p className="mt-1 text-[18px] font-bold text-emerald-400">Đã hoàn thành</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-8 rounded-lg bg-[#adc7ff] px-6 py-3 font-mono font-bold text-[#00285b] hover:bg-[#adc7ff]/90 transition"
            >
              Làm lại bài kiểm tra
            </button>
            <div className="mt-3 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSubmittedResult(null);
                  setHasStarted(false);
                  setQuestions([]);
                  setSelectedAnswers({});
                  setAttemptId('');
                  setExpiresAt('');
                  setTimeLeft(0);
                }}
                className="rounded-xl border border-[#adc7ff]/50 bg-[#adc7ff]/10 px-6 py-3 font-mono font-bold text-[#adc7ff] transition hover:bg-[#adc7ff]/20"
              >
                Quay lại danh sách quiz
              </button>
              {selectedCourseId && (
                <a
                  className="rounded-xl border border-[#24dfba]/40 bg-[#24dfba]/10 px-6 py-3 font-mono font-bold text-[#24dfba] transition hover:bg-[#24dfba]/20"
                  href={`/course-detail?course_id=${encodeURIComponent(selectedCourseId)}`}
                >
                  Thoát về bài học
                </a>
              )}
            </div>
          </section>
        )}

        {!isLoading && (hasStarted || user?.role !== 'student') && !questions.length && (
          <div className="rounded-2xl border border-dashed border-[#354055] bg-[#111827]/92 p-10 text-center shadow-xl shadow-black/20">
            <span className="material-symbols-outlined mb-3 text-[44px] text-[#8b90a0]">quiz</span>
            <h2 className="text-[22px] font-semibold text-[#dde2f4]">Chưa có câu hỏi quiz</h2>
          </div>
        )}

        {/* Questions list */}
        {!submittedResult && (hasStarted || user?.role !== 'student') && questions.length > 0 && (
          <div className="space-y-5">
            {questions.map((question, index) => (
              <section key={question._id} className="rounded-2xl border border-[#253047] bg-[#111827]/92 p-5 shadow-xl shadow-black/20 md:p-7">
                <div className="mb-6 flex items-start gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#adc7ff]/10 font-bold text-[#adc7ff]">{index + 1}</span>
                  <div>
                    <h2 className="text-[18px] leading-7 text-[#dde2f4]">{question.content}</h2>
                    <p className="mt-2 font-mono text-[12px] text-[#8b90a0]">
                      {question.question_type === 'single_choice' ? 'Một đáp án' : 'Nhiều đáp án'} · {question.point} điểm
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {question.answers.map((answer) => {
                    const checked = selectedAnswers[question._id]?.includes(answer._id) ?? false;
                    return (
                      <button
                        key={answer._id}
                        className={`flex w-full items-center gap-4 rounded-xl border p-5 text-left transition-all ${
                          checked ? 'border-[#adc7ff] bg-[#adc7ff]/10' : 'border-[#414754]/60 hover:border-[#adc7ff]/40 hover:bg-[#1f2937]'
                        }`}
                        type="button"
                        onClick={() => toggleAnswer(question, answer._id)}
                      >
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[14px] font-bold ${checked ? 'border-[#adc7ff] text-[#adc7ff]' : 'border-[#414754] text-[#c1c6d7]'}`}>
                          {checked ? <span className="material-symbols-outlined text-[16px]">check</span> : ''}
                        </span>
                        <span className="text-[16px] text-[#dde2f4]">{answer.content}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}

            {user?.role === 'student' && questions.length > 0 && (
              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleDoSubmit()}
                  className="flex items-center gap-2 rounded-xl bg-[#24dfba] px-8 py-4 font-mono text-[16px] font-bold text-[#00382c] shadow-lg transition-transform active:scale-95 hover:brightness-110 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined">send</span>
                  {isSubmitting ? 'Đang nộp bài...' : 'Nộp bài ngay'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <SphereAIButton />
    </div>
  );
}
