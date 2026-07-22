import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppHeader } from '../components/AppHeader';
import { AppToast } from '../components/AppToast';
import { RoleSidebar } from '../components/RoleSidebar';
import { SphereAIButton } from '../components/SphereAIButton';
import { canManageContent, getRoleLabel, getRoleNav, isCourseOwner } from '../lib/roleAccess';
import { api, getAIErrorMessage, getStoredUser, type Course, type Lesson, type QuestionInput, type Quiz, type QuizQuestion } from '../services/api';

type QuestionForm = {
  content: string;
  question_type: QuestionInput['question_type'];
  point: string;
  answers: Array<{ content: string; is_correct: boolean }>;
};

type QuizForm = {
  title: string;
  description: string;
  time_limit: string;
};

type BuilderMode = 'ai' | 'manual';

const avatarSrc =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDKeNBi2jNgbEX4dt6nsH8jJ0KsxzOaxqx2_3cWyMw1EojZOMGx8vJ8ZLFtsLYzqvQb9_dSiLClGrvSO4CC2JllO5YZHuHqUbvV1MSBNYm-i0rDvPn2F8A7NYDrALUHOW7B91ZePrzuoy9OH-pfMu7ItzDyGaJdG859kW0r_EFrTL9AHdLIPJAgzWL8CGrqQxQvMwNXzlmKUYlEHjOyGdInGpJkYNSHYPbXj6hVa42TveS95tPWoVIQhA';

const emptyQuestionForm: QuestionForm = {
  content: '',
  question_type: 'single_choice',
  point: '1',
  answers: [
    { content: '', is_correct: true },
    { content: '', is_correct: false },
  ],
};

const emptyQuizForm: QuizForm = {
  title: '',
  description: '',
  time_limit: '15',
};

const fieldClass =
  'w-full rounded-xl border border-[#354055] bg-[#070d19] px-4 py-3 text-[15px] text-[#e7ecff] outline-none transition placeholder:text-[#7f8aa3] focus:border-[#8fb7ff] focus:ring-2 focus:ring-[#8fb7ff]/20';
const labelClass = 'font-mono text-[12px] uppercase tracking-wider text-[#9da8bd]';

function normalizeQuestionForm(form: QuestionForm): QuestionInput {
  return {
    content: form.content.trim(),
    question_type: form.question_type,
    point: Number(form.point),
    answers: form.answers.map((answer) => ({
      content: answer.content.trim(),
      is_correct: answer.is_correct,
    })),
  };
}

function getQuestionTypeLabel(type: QuizQuestion['question_type']) {
  return type === 'single_choice' ? 'Một đáp án' : 'Nhiều đáp án';
}

export function QuestionBuilderPage() {
  const params = new URLSearchParams(window.location.search);
  const initialCourseId = params.get('course_id') ?? '';
  const initialQuizId = params.get('quiz_id') ?? '';
  const user = getStoredUser();
  const navItems = getRoleNav(user);
  const [courses, setCourses] = useState<Course[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [generatedQuestions, setGeneratedQuestions] = useState<QuestionInput[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState(initialCourseId);
  const [selectedQuizId, setSelectedQuizId] = useState(initialQuizId);
  const [quizForm, setQuizForm] = useState<QuizForm>(emptyQuizForm);
  const [questionForm, setQuestionForm] = useState<QuestionForm>(emptyQuestionForm);
  const [selectedAILessonId, setSelectedAILessonId] = useState('');
  const [aiQuestionCount, setAIQuestionCount] = useState('5');
  const [builderMode, setBuilderMode] = useState<BuilderMode>('ai');
  const [isCreateQuizOpen, setIsCreateQuizOpen] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isSavingGenerated, setIsSavingGenerated] = useState(false);
  const [message, setMessage] = useState('');

  const selectedQuiz = useMemo(() => quizzes.find((quiz) => quiz._id === selectedQuizId), [quizzes, selectedQuizId]);
  const selectedCourse = useMemo(() => courses.find((course) => course._id === selectedCourseId), [courses, selectedCourseId]);
  const canEditQuizDetail = canManageContent(user);
  const correctCount = questionForm.answers.filter((answer) => answer.is_correct && answer.content.trim()).length;

  useEffect(() => {
    if (!canEditQuizDetail) return;

    setIsLoadingCourses(true);
    api.getCourses()
      .then((items) => {
        const availableCourses = user?.role === 'admin' ? items : items.filter((course) => isCourseOwner(user, course));
        setCourses(availableCourses);
        if (!selectedCourseId && availableCourses[0]) {
          setSelectedCourseId(availableCourses[0]._id);
        }
      })
      .catch((err) => setMessage(err instanceof Error ? err.message : 'Không thể tải khóa học'))
      .finally(() => setIsLoadingCourses(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEditQuizDetail, user?.id, user?._id]);

  useEffect(() => {
    if (!selectedCourseId) {
      setQuizzes([]);
      setSelectedQuizId('');
      return;
    }

    setIsLoadingQuizzes(true);
    setMessage('');
    api.getCourseQuizzes(selectedCourseId)
      .then((items) => {
        setQuizzes(items);
        const nextQuizId = items.some((quiz) => quiz._id === selectedQuizId) ? selectedQuizId : items[0]?._id ?? '';
        setSelectedQuizId(nextQuizId);
      })
      .catch((err) => {
        setQuizzes([]);
        setSelectedQuizId('');
        setMessage(err instanceof Error ? err.message : 'Không thể tải quiz của khóa học');
      })
      .finally(() => setIsLoadingQuizzes(false));
  }, [selectedCourseId, selectedQuizId]);

  useEffect(() => {
    if (!selectedCourseId) {
      setLessons([]);
      setSelectedAILessonId('');
      setGeneratedQuestions([]);
      return;
    }

    api.getLessons(selectedCourseId)
      .then((items) => {
        setLessons(items);
        setSelectedAILessonId((current) => items.some((lesson) => lesson._id === current) ? current : items[0]?._id ?? '');
        setGeneratedQuestions([]);
      })
      .catch((error) => {
        setLessons([]);
        setSelectedAILessonId('');
        setGeneratedQuestions([]);
        setMessage(getAIErrorMessage(error, 'Không thể tải bài học để tạo quiz bằng AI.'));
      });
  }, [selectedCourseId]);

  useEffect(() => {
    if (!selectedQuizId) {
      setQuestions([]);
      return;
    }

    setIsLoadingQuestions(true);
    api.getQuizQuestions(selectedQuizId)
      .then(setQuestions)
      .catch((err) => {
        setQuestions([]);
        setMessage(err instanceof Error ? err.message : 'Không thể tải câu hỏi trong quiz');
      })
      .finally(() => setIsLoadingQuestions(false));
  }, [selectedQuizId]);

  function updateCorrectAnswer(index: number, checked: boolean) {
    setQuestionForm((current) => ({
      ...current,
      answers: current.answers.map((answer, answerIndex) => {
        if (current.question_type === 'single_choice') {
          return { ...answer, is_correct: answerIndex === index };
        }

        return answerIndex === index ? { ...answer, is_correct: checked } : answer;
      }),
    }));
  }

  function updateQuestionType(question_type: QuestionForm['question_type']) {
    setQuestionForm((current) => ({
      ...current,
      question_type,
      answers: question_type === 'single_choice'
        ? current.answers.map((answer, index) => ({ ...answer, is_correct: index === 0 }))
        : current.answers,
    }));
  }

  function addAnswer() {
    setQuestionForm((current) => ({
      ...current,
      answers: [...current.answers, { content: '', is_correct: false }],
    }));
  }

  function removeAnswer(index: number) {
    setQuestionForm((current) => {
      if (current.answers.length <= 2) return current;

      const answers = current.answers.filter((_, answerIndex) => answerIndex !== index);
      if (!answers.some((answer) => answer.is_correct)) {
        answers[0] = { ...answers[0], is_correct: true };
      }

      return { ...current, answers };
    });
  }

  async function loadQuestions(quizId: string) {
    setIsLoadingQuestions(true);
    try {
      setQuestions(await api.getQuizQuestions(quizId));
    } catch (err) {
      setQuestions([]);
      setMessage(err instanceof Error ? err.message : 'Không thể tải câu hỏi trong quiz');
    } finally {
      setIsLoadingQuestions(false);
    }
  }

  async function handleCreateQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCourseId) {
      setMessage('Vui lòng chọn khóa học trước khi tạo quiz.');
      return;
    }

    if (!quizForm.title.trim()) {
      setMessage('Vui lòng nhập tên quiz.');
      return;
    }

    const timeLimit = Number(quizForm.time_limit);
    if (!timeLimit || timeLimit <= 0) {
      setMessage('Thời lượng quiz phải lớn hơn 0.');
      return;
    }

    setIsCreatingQuiz(true);
    try {
      const result = await api.createQuiz(selectedCourseId, {
        title: quizForm.title.trim(),
        description: quizForm.description.trim() || undefined,
        time_limit: timeLimit,
      });
      setMessage(result.message);
      setQuizForm(emptyQuizForm);
	  setIsCreateQuizOpen(false);
      const nextQuizzes = await api.getCourseQuizzes(selectedCourseId);
      setQuizzes(nextQuizzes);
      setSelectedQuizId(result.quiz._id);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể tạo quiz');
    } finally {
      setIsCreatingQuiz(false);
    }
  }

  async function handleCreateQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedQuizId) {
      setMessage('Vui lòng chọn quiz cần tạo câu hỏi.');
      return;
    }

    const payload = normalizeQuestionForm(questionForm);
    const filledAnswers = payload.answers.filter((answer) => answer.content);
    const correctAnswers = filledAnswers.filter((answer) => answer.is_correct);

    if (!payload.content) {
      setMessage('Vui lòng nhập nội dung câu hỏi.');
      return;
    }

    if (!payload.point || payload.point <= 0) {
      setMessage('Điểm câu hỏi phải lớn hơn 0.');
      return;
    }

    if (filledAnswers.length < 2) {
      setMessage('Mỗi câu hỏi cần ít nhất 2 đáp án.');
      return;
    }

    if (payload.question_type === 'single_choice' && correctAnswers.length !== 1) {
      setMessage('Câu hỏi một đáp án cần đúng đúng 1 đáp án.');
      return;
    }

    if (payload.question_type === 'multiple_choice' && !correctAnswers.length) {
      setMessage('Câu hỏi nhiều đáp án cần ít nhất 1 đáp án đúng.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await api.createQuizQuestion(selectedQuizId, { ...payload, answers: filledAnswers });
      setMessage(result.message);
      setQuestionForm(emptyQuestionForm);
      await loadQuestions(selectedQuizId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể tạo câu hỏi');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteQuestion(questionId: string) {
    if (!selectedQuizId) return;
    const confirmed = window.confirm('Xóa câu hỏi này khỏi quiz?');
    if (!confirmed) return;

    try {
      const result = await api.deleteQuizQuestion(selectedQuizId, questionId);
      setMessage(result.message);
      await loadQuestions(selectedQuizId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể xóa câu hỏi');
    }
  }

  async function handleGenerateWithAI() {
	if (!selectedQuizId) {
	  setMessage('Vui lòng chọn hoặc tạo quiz trước khi sinh câu hỏi bằng AI.');
	  return;
	}
    if (!selectedAILessonId) {
      setMessage('Vui lòng chọn bài học có nội dung để AI tạo câu hỏi.');
      return;
    }

    const count = Number(aiQuestionCount);
    if (!Number.isInteger(count) || count < 1 || count > 20) {
      setMessage('Số câu hỏi AI phải từ 1 đến 20.');
      return;
    }

    setIsGeneratingAI(true);
    setGeneratedQuestions([]);
    const sourceLesson = lessons.find((lesson) => lesson._id === selectedAILessonId);
    setMessage(
      sourceLesson?.document_key && sourceLesson.ai_index_status !== 'ready'
        ? 'AI đang đọc document trước khi tạo câu hỏi. Quá trình này có thể mất một lúc...'
        : '',
    );
    try {
      const result = await api.generateQuizWithAI({
        lesson_id: selectedAILessonId,
        number_of_questions: count,
      });
      setGeneratedQuestions(result.questions);
      setMessage(`AI đã tạo ${result.questions.length} câu hỏi nháp. Hãy kiểm tra trước khi thêm vào quiz.`);
    } catch (error) {
      setMessage(getAIErrorMessage(error, 'Không thể tạo câu hỏi bằng AI.'));
    } finally {
      setIsGeneratingAI(false);
    }
  }

  async function handleSaveGeneratedQuestions() {
    if (!selectedQuizId || !generatedQuestions.length || isSavingGenerated) {
      if (!selectedQuizId) setMessage('Vui lòng chọn quiz nhận các câu hỏi AI.');
      return;
    }

	const invalidIndex = generatedQuestions.findIndex((question) => {
	  const answers = question.answers.filter((answer) => answer.content.trim());
	  const correctCount = answers.filter((answer) => answer.is_correct).length;
	  return !question.content.trim()
		|| !Number.isFinite(question.point)
		|| question.point <= 0
		|| answers.length < 2
		|| (question.question_type === 'single_choice' ? correctCount !== 1 : correctCount < 1);
	});
	if (invalidIndex >= 0) {
	  setMessage(`Câu AI số ${invalidIndex + 1} chưa hợp lệ. Hãy kiểm tra nội dung, đáp án và đáp án đúng.`);
	  return;
	}

    setIsSavingGenerated(true);
    let savedCount = 0;
    try {
	  for (const question of generatedQuestions) {
		await api.createQuizQuestion(selectedQuizId, {
		  ...question,
		  content: question.content.trim(),
		  answers: question.answers
			.filter((answer) => answer.content.trim())
			.map((answer) => ({ ...answer, content: answer.content.trim() })),
		});
        savedCount += 1;
      }
      setGeneratedQuestions([]);
      await loadQuestions(selectedQuizId);
      setMessage(`Đã thêm ${savedCount} câu hỏi AI vào quiz.`);
    } catch (error) {
      await loadQuestions(selectedQuizId);
      setGeneratedQuestions((current) => current.slice(savedCount));
      setMessage(`${getAIErrorMessage(error, 'Không thể lưu toàn bộ câu hỏi AI.')} Đã lưu ${savedCount} câu.`);
    } finally {
      setIsSavingGenerated(false);
    }
  }

  function updateGeneratedQuestion(index: number, changes: Partial<QuestionInput>) {
    setGeneratedQuestions((current) => current.map((question, itemIndex) => {
      if (itemIndex !== index) return question;
      if (changes.question_type === 'single_choice' && question.question_type !== 'single_choice') {
        return {
          ...question,
          ...changes,
          answers: question.answers.map((answer, answerIndex) => ({ ...answer, is_correct: answerIndex === 0 })),
        };
      }
      return { ...question, ...changes };
    }));
  }

  function updateGeneratedAnswer(questionIndex: number, answerIndex: number, content: string) {
    setGeneratedQuestions((current) => current.map((question, itemIndex) => itemIndex === questionIndex
      ? {
          ...question,
          answers: question.answers.map((answer, index) => index === answerIndex ? { ...answer, content } : answer),
        }
      : question));
  }

  function updateGeneratedCorrectAnswer(questionIndex: number, answerIndex: number, checked: boolean) {
    setGeneratedQuestions((current) => current.map((question, itemIndex) => {
      if (itemIndex !== questionIndex) return question;
      return {
        ...question,
        answers: question.answers.map((answer, index) => ({
          ...answer,
          is_correct: question.question_type === 'single_choice' ? index === answerIndex : index === answerIndex ? checked : answer.is_correct,
        })),
      };
    }));
  }

  if (!canEditQuizDetail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d131f] px-4 text-[#dde2f4]">
        <section className="max-w-md rounded-2xl border border-[#354055] bg-[#151c2a] p-8 text-center shadow-2xl shadow-black/30">
          <span className="material-symbols-outlined mb-4 text-[48px] text-[#ffb4ab]">lock</span>
          <h1 className="text-[26px] font-bold">Không có quyền truy cập</h1>
          <p className="mt-2 text-[#b8c1d6]">Chỉ gia sư sở hữu khóa học hoặc quản trị viên được quản lý chi tiết quiz.</p>
          <a className="mt-6 inline-flex rounded-xl bg-[#adc7ff] px-5 py-3 font-bold text-[#002e68]" href="/dashboard">
            Về bảng điều khiển
          </a>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#070d19] text-[#e7ecff]">
      <AppHeader user={user} roleLabel={getRoleLabel(user?.role)} avatarSrc={avatarSrc} />
      <AppToast message={message} tone="warning" onClose={() => setMessage('')} />

      {isCreateQuizOpen && (
        <div className="fixed inset-0 z-50 flex overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
          <form
            className="relative m-auto w-full max-w-[560px] rounded-2xl border border-[#ffcc7a]/30 bg-[#111827] p-5 shadow-2xl shadow-black/50 sm:p-6"
            onSubmit={handleCreateQuiz}
          >
            <button
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-[#354055] text-[#9da8bd] transition hover:border-[#ffb4ab]/50 hover:bg-[#ffb4ab]/10 hover:text-[#ffb4ab] disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              aria-label="Đóng form tạo quiz"
              disabled={isCreatingQuiz}
              onClick={() => setIsCreateQuizOpen(false)}
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="mb-6 flex items-center gap-3 pr-12">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ffcc7a]/12 text-[#ffcc7a]">
                <span className="material-symbols-outlined">add_notes</span>
              </span>
              <div className="min-w-0">
                <h2 className="text-[22px] font-extrabold text-white">Tạo quiz mới</h2>
                <p className="truncate text-[13px] text-[#8f9bb3]">
                  {selectedCourse?.title ?? 'Chọn khóa học trước khi tạo quiz'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex flex-col gap-2">
                <span className={labelClass}>Tiêu đề quiz</span>
                <input
                  className={fieldClass}
                  autoFocus
                  placeholder="Ví dụ: Kiểm tra chương 1"
                  value={quizForm.title}
                  onChange={(event) => setQuizForm((current) => ({ ...current, title: event.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className={labelClass}>Mô tả</span>
                <input
                  className={fieldClass}
                  placeholder="Mô tả ngắn cho quiz"
                  value={quizForm.description}
                  onChange={(event) => setQuizForm((current) => ({ ...current, description: event.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className={labelClass}>Thời lượng (phút)</span>
                <input
                  className={fieldClass}
                  type="number"
                  min="1"
                  placeholder="15"
                  value={quizForm.time_limit}
                  onChange={(event) => setQuizForm((current) => ({ ...current, time_limit: event.target.value }))}
                />
              </label>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  className="rounded-xl border border-[#46536b] px-5 py-3 font-mono text-[12px] font-black uppercase tracking-wide text-[#c5cee3] transition hover:bg-[#1a2435] disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={isCreatingQuiz}
                  onClick={() => setIsCreateQuizOpen(false)}
                >
                  Hủy
                </button>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#adc7ff] px-5 py-3 font-mono text-[13px] font-black uppercase tracking-wide text-[#00285b] shadow-lg shadow-[#adc7ff]/20 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  type="submit"
                  disabled={!selectedCourseId || isCreatingQuiz}
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  {isCreatingQuiz ? 'Đang tạo...' : 'Tạo quiz'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <RoleSidebar activePath="/question-builder" items={navItems} user={user} />

      <main className="min-w-0 md:pl-64">
		<div className="mx-auto max-w-[1180px] p-4 md:p-6">
		  <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <section className="w-full shrink-0 space-y-5 md:sticky md:top-24 md:w-[340px] xl:w-[380px]">
            <div className="rounded-2xl border border-[#253047] bg-[#111827]/92 p-5 shadow-xl shadow-black/20">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#adc7ff]/12 text-[#adc7ff]">
                  <span className="material-symbols-outlined">settings_applications</span>
                </span>
                <div>
                  <h2 className="text-[22px] font-extrabold">Cài đặt bài thi</h2>
                  <p className="text-[13px] text-[#8f9bb3]">Chọn khóa học và quiz đang biên soạn</p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="flex flex-col gap-2">
                  <span className={labelClass}>Khóa học liên quan</span>
                  <select
                    className={fieldClass}
                    value={selectedCourseId}
                    onChange={(event) => {
                      setSelectedCourseId(event.target.value);
                      setSelectedQuizId('');
                    }}
                  >
                    <option value="">{isLoadingCourses ? 'Đang tải khóa học...' : 'Chọn khóa học'}</option>
                    {courses.map((course) => (
                      <option key={course._id} value={course._id}>{course.title}</option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className={labelClass}>Quiz cần tạo chi tiết</span>
                  <select
                    className={fieldClass}
                    value={selectedQuizId}
                    onChange={(event) => setSelectedQuizId(event.target.value)}
                    disabled={!selectedCourseId || isLoadingQuizzes}
                  >
                    <option value="">{isLoadingQuizzes ? 'Đang tải quiz...' : 'Chọn quiz'}</option>
                    {quizzes.map((quiz) => (
                      <option key={quiz._id} value={quiz._id}>{quiz.title}</option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <article className="rounded-xl border border-[#354055] bg-[#070d19] p-4">
                    <p className={labelClass}>Thời lượng</p>
                    <p className="mt-2 text-[22px] font-black text-white">{selectedQuiz ? `${selectedQuiz.time_limit} phút` : '--'}</p>
                  </article>
                  <article className="rounded-xl border border-[#354055] bg-[#070d19] p-4">
                    <p className={labelClass}>Số câu hỏi</p>
                    <p className="mt-2 text-[22px] font-black text-[#24dfba]">{questions.length}</p>
                  </article>
                </div>

                {!courses.length && !isLoadingCourses && (
                  <div className="rounded-xl border border-dashed border-[#46536b] bg-[#070d19] p-4 text-[14px] text-[#b8c1d6]">
                    Bạn chưa có khóa học nào để tạo chi tiết quiz.
                  </div>
                )}

                {selectedCourse && !quizzes.length && !isLoadingQuizzes && (
                  <div className="rounded-xl border border-dashed border-[#46536b] bg-[#070d19] p-4 text-[14px] text-[#b8c1d6]">
                    Khóa học này chưa có quiz. Tạo quiz bên dưới để bắt đầu thêm câu hỏi.
                  </div>
                )}
              </div>
            </div>

			<button
			  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#ffcc7a]/35 bg-[#ffcc7a]/10 px-4 py-3 font-mono text-[12px] font-black uppercase tracking-wide text-[#ffcc7a] transition hover:bg-[#ffcc7a]/15 disabled:cursor-not-allowed disabled:opacity-50"
			  type="button"
			  disabled={!selectedCourseId}
			  onClick={() => setIsCreateQuizOpen(true)}
			>
			  <span className="material-symbols-outlined text-[18px]">add_circle</span>
			  Tạo quiz mới
			</button>
          </section>

          <section className="flex min-w-0 flex-1 flex-col gap-5">
            <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#253047] bg-[#111827]/92 p-5 shadow-xl shadow-black/20 xl:flex-row xl:items-center">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#24dfba]/12 text-[#24dfba]">
                  <span className="material-symbols-outlined">format_list_bulleted</span>
                </span>
                <div>
                  <h2 className="text-[24px] font-extrabold text-white">Trình xây dựng câu hỏi</h2>
                  <p className="text-[13px] text-[#8f9bb3]">{selectedQuiz?.title ?? 'Chọn quiz để bắt đầu thêm câu hỏi'}</p>
                </div>
              </div>
			  <div className="flex flex-wrap gap-2 font-mono text-[11px]">
				<span className="rounded-full border border-[#adc7ff]/25 bg-[#adc7ff]/10 px-3 py-1.5 text-[#adc7ff]">{selectedQuiz ? `${selectedQuiz.time_limit} phút` : 'Chưa chọn quiz'}</span>
				<span className="rounded-full border border-[#24dfba]/25 bg-[#24dfba]/10 px-3 py-1.5 text-[#24dfba]">{questions.length} câu đã lưu</span>
			  </div>
            </div>

			<div className="grid grid-cols-2 rounded-2xl border border-[#253047] bg-[#111827]/92 p-1.5 shadow-xl shadow-black/20">
			  <button
				className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-mono text-[12px] font-black transition ${builderMode === 'ai' ? 'bg-[#fe9800] text-[#3b2300]' : 'text-[#9da8bd] hover:bg-[#1a2435] hover:text-white'}`}
				type="button"
				onClick={() => setBuilderMode('ai')}
			  >
				<span className="material-symbols-outlined text-[18px]">auto_awesome</span>
				Tạo bằng AI
			  </button>
			  <button
				className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-mono text-[12px] font-black transition ${builderMode === 'manual' ? 'bg-[#adc7ff] text-[#00285b]' : 'text-[#9da8bd] hover:bg-[#1a2435] hover:text-white'}`}
				type="button"
				onClick={() => setBuilderMode('manual')}
			  >
				<span className="material-symbols-outlined text-[18px]">edit_note</span>
				Nhập thủ công
			  </button>
			</div>

			{builderMode === 'ai' && (
			<section className="rounded-2xl border border-[#fe9800]/25 bg-[#111827]/92 p-5 shadow-xl shadow-black/20">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_120px_auto] md:items-end">
                <label className="flex flex-col gap-2">
                  <span className={labelClass}>Bài học làm nguồn</span>
                  <select
                    className={fieldClass}
                    value={selectedAILessonId}
                    disabled={!selectedCourseId || isGeneratingAI}
                    onChange={(event) => {
                      setSelectedAILessonId(event.target.value);
                      setGeneratedQuestions([]);
                    }}
                  >
                    <option value="">Chọn bài học</option>
                    {lessons.map((lesson) => (
                      <option key={lesson._id} value={lesson._id}>{lesson.title}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2">
                  <span className={labelClass}>Số câu</span>
                  <input
                    className={fieldClass}
                    type="number"
                    min="1"
                    max="20"
                    value={aiQuestionCount}
                    disabled={isGeneratingAI}
                    onChange={(event) => setAIQuestionCount(event.target.value)}
                  />
                </label>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#fe9800]/40 bg-[#fe9800]/10 px-5 py-3 font-bold text-[#ffcc7a] hover:bg-[#fe9800]/20 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
				  disabled={!selectedQuizId || !selectedAILessonId || isGeneratingAI}
                  onClick={() => void handleGenerateWithAI()}
                >
                  <span className="material-symbols-outlined text-[19px]">auto_awesome</span>
                  Sinh câu hỏi
                </button>
              </div>

              {!lessons.length && selectedCourseId && (
                <p className="mt-4 rounded-xl border border-dashed border-[#46536b] p-4 text-[13px] text-[#9da8bd]">
                  Khóa học chưa có bài học để AI tạo câu hỏi.
                </p>
              )}

              {generatedQuestions.length > 0 && (
                <div className="mt-5 space-y-4 border-t border-[#253047] pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-[18px] font-bold text-white">Bản nháp do AI tạo</h3>
                      <p className="text-[12px] text-[#8f9bb3]">Kiểm tra đáp án trước khi thêm vào quiz đang chọn.</p>
                    </div>
                    <button
                      className="rounded-xl bg-[#24dfba] px-5 py-3 font-mono text-[12px] font-black text-[#00382e] disabled:cursor-not-allowed disabled:opacity-50"
                      type="button"
                      disabled={!selectedQuizId || isSavingGenerated}
                      onClick={() => void handleSaveGeneratedQuestions()}
                    >
                      {isSavingGenerated ? 'Đang thêm...' : `Thêm ${generatedQuestions.length} câu vào quiz`}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {generatedQuestions.map((question, index) => (
					  <article key={`ai-draft-${index}`} className="rounded-xl border border-[#354055] bg-[#070d19] p-4">
						<div className="mb-3 flex items-center justify-between gap-3">
						  <p className="font-mono text-[11px] font-black uppercase tracking-wider text-[#ffcc7a]">Câu nháp {index + 1}</p>
                          <button
							className="rounded-lg p-1.5 text-[#ffb4ab] transition hover:bg-[#ffb4ab]/10"
                            type="button"
                            aria-label="Bỏ câu hỏi nháp"
                            onClick={() => setGeneratedQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                          >
                            <span className="material-symbols-outlined text-[20px]">close</span>
                          </button>
                        </div>
						<textarea
						  className={`${fieldClass} min-h-20 resize-y text-[14px] leading-6`}
						  value={question.content}
						  onChange={(event) => updateGeneratedQuestion(index, { content: event.target.value })}
						/>
						<div className="mt-3 grid gap-3 sm:grid-cols-[1fr_110px]">
						  <select
							className={fieldClass}
							value={question.question_type}
							onChange={(event) => updateGeneratedQuestion(index, { question_type: event.target.value as QuestionInput['question_type'] })}
						  >
							<option value="single_choice">Một đáp án đúng</option>
							<option value="multiple_choice">Nhiều đáp án đúng</option>
						  </select>
						  <input
							className={fieldClass}
							type="number"
							min="0.5"
							step="0.5"
							value={question.point}
							onChange={(event) => updateGeneratedQuestion(index, { point: Number(event.target.value) })}
							aria-label={`Điểm câu AI số ${index + 1}`}
						  />
						</div>
						<div className="mt-3 space-y-2">
                          {question.answers.map((answer, answerIndex) => (
							<label key={answerIndex} className={`flex items-center gap-3 rounded-xl border p-2 transition ${answer.is_correct ? 'border-[#24dfba]/45 bg-[#24dfba]/10' : 'border-[#253047] bg-[#0d1422]'}`}>
							  <input
								type={question.question_type === 'single_choice' ? 'radio' : 'checkbox'}
								name={`ai-correct-${index}`}
								checked={answer.is_correct}
								onChange={(event) => updateGeneratedCorrectAnswer(index, answerIndex, event.target.checked)}
							  />
							  <input
								className="min-w-0 flex-1 bg-transparent px-2 py-1 text-[13px] text-[#e7ecff] outline-none"
								value={answer.content}
								onChange={(event) => updateGeneratedAnswer(index, answerIndex, event.target.value)}
								aria-label={`Đáp án ${answerIndex + 1} của câu AI ${index + 1}`}
							  />
							  {answer.is_correct && <span className="font-mono text-[10px] font-bold text-[#24dfba]">ĐÚNG</span>}
							</label>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </section>
			)}

			{builderMode === 'manual' && (
            <form className="rounded-2xl border border-[#253047] bg-[#111827]/92 p-5 shadow-xl shadow-black/20" onSubmit={handleCreateQuestion}>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-[20px] font-extrabold text-white">Câu hỏi mới</h3>
                  <p className="text-[13px] text-[#8f9bb3]">Nhập nội dung, thêm đáp án và chọn đáp án đúng</p>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-full border border-[#354055] bg-[#070d19] px-3 py-1 font-mono text-[12px] text-[#b8c1d6]">
                    {questionForm.answers.length} đáp án
                  </span>
                  <span className="rounded-full border border-[#24dfba]/30 bg-[#24dfba]/10 px-3 py-1 font-mono text-[12px] text-[#24dfba]">
                    {correctCount} đúng
                  </span>
                </div>
              </div>

              <div className="space-y-5">
                <label className="flex flex-col gap-2">
                  <span className={labelClass}>Nội dung câu hỏi</span>
                  <textarea
                    className={`${fieldClass} min-h-28 resize-y leading-7`}
                    placeholder="Ví dụ: Lợi ích chính của việc sử dụng AWS Lambda là gì?"
                    value={questionForm.content}
                    onChange={(event) => setQuestionForm((current) => ({ ...current, content: event.target.value }))}
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-[1fr_140px]">
                  <label className="flex flex-col gap-2">
                    <span className={labelClass}>Loại câu hỏi</span>
                    <select
                      className={fieldClass}
                      value={questionForm.question_type}
                      onChange={(event) => updateQuestionType(event.target.value as QuestionForm['question_type'])}
                    >
                      <option value="single_choice">Một đáp án đúng</option>
                      <option value="multiple_choice">Nhiều đáp án đúng</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className={labelClass}>Điểm</span>
                    <input
                      className={fieldClass}
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={questionForm.point}
                      onChange={(event) => setQuestionForm((current) => ({ ...current, point: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className={labelClass}>Đáp án</h3>
                    <button
                      className="rounded-xl border border-[#adc7ff]/50 bg-[#adc7ff]/10 px-4 py-2 font-mono text-[12px] font-bold uppercase tracking-wide text-[#adc7ff] transition hover:bg-[#adc7ff]/20"
                      type="button"
                      onClick={addAnswer}
                    >
                      Thêm đáp án
                    </button>
                  </div>

                  {questionForm.answers.map((answer, index) => (
                    <div
                      key={index}
                      className={`grid gap-3 rounded-xl border p-3 transition xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center ${
                        answer.is_correct
                          ? 'border-[#24dfba]/45 bg-[#24dfba]/10 shadow-lg shadow-[#24dfba]/5'
                          : 'border-[#354055] bg-[#070d19]'
                      }`}
                    >
                      <input
                        className="min-w-0 rounded-lg border border-[#354055] bg-[#0d1422] px-4 py-3 text-[#e7ecff] outline-none placeholder:text-[#7f8aa3] focus:border-[#8fb7ff]"
                        placeholder={`Đáp án ${index + 1}`}
                        value={answer.content}
                        onChange={(event) =>
                          setQuestionForm((current) => ({
                            ...current,
                            answers: current.answers.map((item, itemIndex) => itemIndex === index ? { ...item, content: event.target.value } : item),
                          }))
                        }
                      />
                      <label className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 font-mono text-[12px] font-bold ${answer.is_correct ? 'bg-[#24dfba]/15 text-[#24dfba]' : 'bg-[#151e2d] text-[#b8c1d6]'}`}>
                        <input
                          type={questionForm.question_type === 'single_choice' ? 'radio' : 'checkbox'}
                          name="correct-answer"
                          checked={answer.is_correct}
                          onChange={(event) => updateCorrectAnswer(index, event.target.checked)}
                        />
                        Đáp án đúng
                      </label>
                      <button
                        className="rounded-lg border border-[#ffb4ab]/35 px-3 py-2 font-mono text-[12px] font-bold text-[#ffb4ab] transition hover:bg-[#ffb4ab]/10"
                        type="button"
                        onClick={() => removeAnswer(index)}
                      >
                        Xóa
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#adc7ff] px-5 py-3 font-mono text-[13px] font-black uppercase tracking-wide text-[#00285b] shadow-lg shadow-[#adc7ff]/20 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  type="submit"
                  disabled={!selectedQuizId || isSaving}
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  {isSaving ? 'Đang lưu...' : 'Thêm câu hỏi vào quiz'}
                </button>
              </div>
            </form>
			)}

            <section className="overflow-hidden rounded-2xl border border-[#253047] bg-[#111827]/92 shadow-xl shadow-black/20">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#253047] px-5 py-4">
                <div>
                  <h3 className="text-[20px] font-extrabold">{selectedQuiz?.title ?? 'Câu hỏi trong quiz'}</h3>
                  <p className="text-[13px] text-[#8f9bb3]">Danh sách câu hỏi đã thêm vào bài kiểm tra</p>
                </div>
                {isLoadingQuestions && <span className="font-mono text-[12px] text-[#8b90a0]">Đang tải...</span>}
              </div>

              {!questions.length && !isLoadingQuestions ? (
                <div className="flex flex-col items-center justify-center p-10 text-center">
                  <span className="material-symbols-outlined mb-3 text-[52px] text-[#657188]">quiz</span>
                  <h3 className="text-[24px] font-bold text-white">Chưa có câu hỏi nào</h3>
                  <p className="mt-2 max-w-md text-[14px] leading-6 text-[#8f9bb3]">Sau khi chọn quiz, hãy thêm câu hỏi đầu tiên để học viên có thể làm bài kiểm tra.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#253047]">
                  {questions.map((question, index) => (
                    <article key={question._id} className="p-5 transition hover:bg-[#151e2d]">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div className="min-w-0">
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-[#adc7ff]/15 px-2 font-mono text-[12px] font-black text-[#adc7ff]">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <span className="rounded-full bg-[#070d19] px-3 py-1 font-mono text-[12px] text-[#9da8bd]">
                              {getQuestionTypeLabel(question.question_type)}
                            </span>
                            <span className="rounded-full bg-[#070d19] px-3 py-1 font-mono text-[12px] text-[#ffcc7a]">
                              {question.point} điểm
                            </span>
                          </div>
                          <h4 className="break-words text-[18px] font-bold leading-7 text-white">{question.content}</h4>
                        </div>
                        <button
                          className="rounded-lg border border-[#ffb4ab]/40 px-4 py-2 font-mono text-[12px] font-bold text-[#ffb4ab] transition hover:bg-[#ffb4ab]/10"
                          type="button"
                          onClick={() => void handleDeleteQuestion(question._id)}
                        >
                          Xóa
                        </button>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {question.answers.map((answer) => (
                          <div
                            key={answer._id}
                            className={`rounded-xl border px-3 py-2 text-[14px] ${
                              answer.is_correct
                                ? 'border-[#24dfba]/45 bg-[#24dfba]/10 text-[#24dfba]'
                                : 'border-[#354055] bg-[#070d19] text-[#b8c1d6]'
                            }`}
                          >
                            {answer.content}
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>
		  </div>
		</div>
      </main>

      <SphereAIButton />
    </div>
  );
}
