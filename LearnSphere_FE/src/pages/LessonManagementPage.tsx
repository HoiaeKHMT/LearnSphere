import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppHeader } from '../components/AppHeader';
import { AppToast } from '../components/AppToast';
import { RoleSidebar } from '../components/RoleSidebar';
import { SphereAIButton } from '../components/SphereAIButton';
import { canManageContent, canModerateCourse, getRoleLabel, getRoleNav, isCourseOwner } from '../lib/roleAccess';
import {
  api,
  getStoredUser,
  type Course,
  type Enrollment,
  type EnrollmentType,
  type Lesson,
  type Quiz,
} from '../services/api';

const avatarSrc =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCJoFDj_0QC113oXEglqawaRx_p6aj65L4yuLN_52cJ7ZIsSBwJOLuDBdEOjZO4FGAYbIdjFRiTlh8P2s0viUatzxsXtdGT_HsugoXIhqhwVN_Dw3tV9dDK8jwLYtcCNANCSZMe4LpwBeZ_9u6z_nbGgFvzsUsVhmefvWWra3Gr3YxrVvyeFBabLR6ZaLPdihuammwZ1Kx-7DMoW1tlYifLN7bf0t5jAQwLgAkqx_v0jfzWhkcx2DbATA';

type CourseForm = {
  title: string;
  description: string;
  enrollment_type: EnrollmentType;
};

type LessonForm = {
  title: string;
  content: string;
  order_index: string;
  video_key: string;
  document_key: string;
};

const emptyCourseForm: CourseForm = { title: '', description: '', enrollment_type: 'open' };
const emptyLessonForm: LessonForm = { title: '', content: '', order_index: '1', video_key: '', document_key: '' };
const fieldClass =
  'w-full rounded-xl border border-[#354055] bg-[#070d19] px-4 py-3 text-[15px] text-[#e7ecff] outline-none transition placeholder:text-[#7f8aa3] focus:border-[#8fb7ff] focus:ring-2 focus:ring-[#8fb7ff]/20';
const labelClass = 'font-mono text-[12px] uppercase tracking-wider text-[#9da8bd]';

function toCourseForm(course?: Course): CourseForm {
  if (!course) return emptyCourseForm;
  return {
    title: course.title,
    description: course.description ?? '',
    enrollment_type: course.enrollment_type ?? 'open',
  };
}

function toLessonForm(lesson?: Lesson): LessonForm {
  if (!lesson) return emptyLessonForm;
  return {
    title: lesson.title,
    content: lesson.content ?? '',
    order_index: String(lesson.order_index),
    video_key: lesson.video_key ?? '',
    document_key: lesson.document_key ?? '',
  };
}

function normalizeLessonForm(form: LessonForm) {
  return {
    title: form.title.trim(),
    content: form.content.trim() || undefined,
    order_index: Number(form.order_index),
    video_key: form.video_key.trim() || undefined,
    document_key: form.document_key.trim() || undefined,
  };
}

function getEnrollmentUserName(enrollment: Enrollment) {
  return typeof enrollment.user_id === 'object' ? enrollment.user_id.full_name : 'Học viên';
}

function getEnrollmentUserEmail(enrollment: Enrollment) {
  return typeof enrollment.user_id === 'object' ? enrollment.user_id.email : enrollment.user_id;
}

export function LessonManagementPage() {
  const user = getStoredUser();
  const navItems = useMemo(() => getRoleNav(user), [user]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [pendingEnrollments, setPendingEnrollments] = useState<Enrollment[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [courseForm, setCourseForm] = useState<CourseForm>(emptyCourseForm);
  const [lessonForm, setLessonForm] = useState<LessonForm>(emptyLessonForm);
  const [editingLessonId, setEditingLessonId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);

  const selectedCourse = useMemo(() => courses.find((course) => course._id === selectedCourseId), [courses, selectedCourseId]);
  const canEditSelectedCourse = selectedCourse ? isCourseOwner(user, selectedCourse) : false;
  const canModerateSelectedCourse = selectedCourse ? canModerateCourse(user, selectedCourse) : false;
  const canManageQuiz = user?.role === 'tutor' && canEditSelectedCourse;

  async function handleFileUpload(file: File, folder: 'thumbnails' | 'lessons/videos' | 'lessons/documents') {
    if (!selectedCourseId) {
      setMessage('Vui lòng chọn khóa học trước.');
      return null;
    }

    setIsUploading(true);
    setMessage(`Đang tải file "${file.name}" lên S3...`);

    try {
      const presigned = await api.createPresignedUpload({
        course_id: selectedCourseId,
        file_name: file.name,
        content_type: file.type,
        file_size: file.size,
        folder,
      });

      await api.uploadFileToS3(presigned.upload_url, file);
      setMessage(`Upload file "${file.name}" thành công!`);
      return presigned.file_key;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Upload file thất bại');
      return null;
    } finally {
      setIsUploading(false);
    }
  }

  async function loadCourses(preferredCourseId = selectedCourseId) {
    if (!canManageContent(user)) return;
    setIsLoading(true);
    setMessage('');

    try {
      const items = await api.getCourses();
      const manageableCourses = user?.role === 'admin' ? items : items.filter((course) => isCourseOwner(user, course));
      const nextSelected = manageableCourses.some((course) => course._id === preferredCourseId)
        ? preferredCourseId
        : manageableCourses[0]?._id ?? '';

      setCourses(manageableCourses);
      setSelectedCourseId(nextSelected);
      setCourseForm(toCourseForm(manageableCourses.find((course) => course._id === nextSelected)));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể tải khóa học');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadCourseParts(courseId: string) {
    if (!courseId) {
      setLessons([]);
      setQuizzes([]);
      setPendingEnrollments([]);
      return;
    }

    try {
      const [lessonItems, quizItems] = await Promise.all([
        api.getLessons(courseId),
        api.getCourseQuizzes(courseId),
      ]);
      setLessons(lessonItems.sort((a, b) => a.order_index - b.order_index));
      setQuizzes(quizItems);
      const nextQuizId = quizItems.some((quiz) => quiz._id === selectedQuizId) ? selectedQuizId : quizItems[0]?._id ?? '';
      setSelectedQuizId(nextQuizId);
    } catch (err) {
      setLessons([]);
      setQuizzes([]);
      setPendingEnrollments([]);
      setMessage(err instanceof Error ? err.message : 'Không thể tải thành phần khóa học');
    }
  }

  async function loadPendingEnrollments(courseId: string) {
    if (!courseId || selectedCourse?.enrollment_type !== 'approval_required' || !canEditSelectedCourse) {
      setPendingEnrollments([]);
      return;
    }

    try {
      setPendingEnrollments(await api.getCourseEnrollments(courseId, 'pending'));
    } catch (err) {
      setPendingEnrollments([]);
      setMessage(err instanceof Error ? err.message : 'Không thể tải danh sách enrollment chờ duyệt');
    }
  }

  useEffect(() => {
    void loadCourses(new URLSearchParams(window.location.search).get('course_id') ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?._id, user?.role]);

  useEffect(() => {
    setCourseForm(toCourseForm(selectedCourse));
    setLessonForm({ ...emptyLessonForm, order_index: String(lessons.length + 1 || 1) });
    setEditingLessonId('');
    void loadCourseParts(selectedCourseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId]);

  useEffect(() => {
    void loadPendingEnrollments(selectedCourseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId, selectedCourse?.enrollment_type, canEditSelectedCourse]);

  async function handleUpdateCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEditSelectedCourse) {
      setMessage('Admin không có quyền chỉnh sửa nội dung khóa học của người khác.');
      return;
    }
    if (!selectedCourseId) return;

    try {
      const result = await api.updateCourse(selectedCourseId, {
        title: courseForm.title.trim(),
        description: courseForm.description.trim(),
        enrollment_type: courseForm.enrollment_type,
      });
      setMessage(result.message);
      await loadCourses(selectedCourseId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể cập nhật khóa học');
    }
  }

  function handleDeleteCourse() {
    if (!selectedCourseId) return;
    setDeleteReason('');
    setIsDeleteModalOpen(true);
  }

  async function handleConfirmDeleteCourse() {
    if (!selectedCourseId) return;

    const reason = deleteReason.trim();
    if (!reason) {
      setMessage('Vui lòng nhập lý do khóa khóa học.');
      return;
    }
    if (reason.length > 500) {
      setMessage('Lý do khóa không được vượt quá 500 ký tự.');
      return;
    }

    setIsDeletingCourse(true);
    try {
      const result = await api.deleteCourse(selectedCourseId, reason);
      setMessage(canModerateSelectedCourse ? `${result.message}. Cần thông báo cho chủ sở hữu theo quy trình quản trị.` : result.message);
      setIsDeleteModalOpen(false);
      setDeleteReason('');
      await loadCourses('');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể xóa khóa học');
    } finally {
      setIsDeletingCourse(false);
    }
  }

  async function handleSaveLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEditSelectedCourse) {
      setMessage('Admin chỉ được kiểm duyệt hoặc tạm khóa khóa học, không được sửa bài học.');
      return;
    }
    if (!selectedCourseId) return;

    try {
      const payload = normalizeLessonForm(lessonForm);
      const result = editingLessonId
        ? await api.updateLesson(editingLessonId, payload)
        : await api.createLesson(selectedCourseId, payload);
      setMessage(result.message);
      setEditingLessonId('');
      setLessonForm({ ...emptyLessonForm, order_index: String(lessons.length + 1) });
      await loadCourseParts(selectedCourseId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể lưu bài học');
    }
  }

  async function handleDeleteLesson(lessonId: string) {
    if (!canEditSelectedCourse) {
      setMessage('Admin không có quyền xóa bài học trong khóa học của người khác.');
      return;
    }
    const confirmed = window.confirm('Xóa bài học này?');
    if (!confirmed) return;

    try {
      const result = await api.deleteLesson(lessonId);
      setMessage(result.message);
      await loadCourseParts(selectedCourseId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể xóa bài học');
    }
  }

  async function handleApproveEnrollment(enrollmentId: string) {
    if (!selectedCourseId) return;

    try {
      const result = await api.approveEnrollment(selectedCourseId, enrollmentId);
      setMessage(result.message);
      await loadPendingEnrollments(selectedCourseId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể duyệt enrollment');
    }
  }

  async function handleRejectEnrollment(enrollmentId: string) {
    if (!selectedCourseId) return;
    const confirmed = window.confirm('Từ chối yêu cầu đăng ký khóa học này?');
    if (!confirmed) return;

    try {
      const result = await api.rejectEnrollment(selectedCourseId, enrollmentId);
      setMessage(result.message);
      await loadPendingEnrollments(selectedCourseId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể từ chối enrollment');
    }
  }

  if (!canManageContent(user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d131f] px-4 text-[#dde2f4]">
        <section className="max-w-md rounded-2xl border border-[#354055] bg-[#151c2a] p-8 text-center shadow-2xl shadow-black/30">
          <span className="material-symbols-outlined mb-4 text-[48px] text-[#ffb4ab]">lock</span>
          <h1 className="text-[26px] font-bold">Không có quyền truy cập</h1>
          <p className="mt-2 text-[#b8c1d6]">Chỉ giảng viên và admin được quản lý khóa học.</p>
          <a className="mt-6 inline-flex rounded-xl bg-[#adc7ff] px-5 py-3 font-bold text-[#002e68]" href="/dashboard">
            Về bảng điều khiển
          </a>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070d19] text-[#e7ecff]">
      <AppHeader user={user} roleLabel={getRoleLabel(user?.role)} avatarSrc={avatarSrc} />
      <AppToast message={message} tone={message.startsWith('Đang ') ? 'loading' : 'warning'} onClose={() => setMessage('')} />

      {isDeleteModalOpen && selectedCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <section className="w-full max-w-[520px] rounded-2xl border border-[#354055] bg-[#111827] p-5 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-[#ffb4ab]">
                  <span className="material-symbols-outlined text-[16px]">lock</span>
                  {canModerateSelectedCourse ? 'Tạm khóa' : 'Xóa khóa học'}
                </span>
                <h2 className="mt-4 text-[24px] font-extrabold text-white">
                  {canModerateSelectedCourse ? 'Bạn có chắc muốn tạm khóa khóa học này không?' : 'Bạn có chắc muốn xóa khóa học này không?'}
                </h2>
                <p className="mt-2 text-[14px] leading-6 text-[#b8c1d6]">{selectedCourse.title}</p>
              </div>
              <button
                className="rounded-lg border border-[#354055] p-2 text-[#b8c1d6] transition hover:bg-[#1a2435]"
                type="button"
                onClick={() => {
                  if (isDeletingCourse) return;
                  setIsDeleteModalOpen(false);
                  setDeleteReason('');
                }}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <label className="mt-5 flex flex-col gap-2">
              <span className={labelClass}>Lý do khóa</span>
              <textarea
                className={`${fieldClass} min-h-32 resize-y leading-6`}
                maxLength={500}
                placeholder="Nhập lý do để chủ sở hữu biết vì sao khóa học bị khóa..."
                value={deleteReason}
                onChange={(event) => setDeleteReason(event.target.value)}
              />
            </label>
            <div className="mt-2 text-right font-mono text-[11px] text-[#8f9bb3]">{deleteReason.trim().length}/500</div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className="rounded-xl border border-[#354055] px-5 py-3 font-mono text-[12px] font-bold text-[#b8c1d6] transition hover:bg-[#1a2435]"
                type="button"
                disabled={isDeletingCourse}
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteReason('');
                }}
              >
                Hủy
              </button>
              <button
                className="rounded-xl bg-[#ffb4ab] px-5 py-3 font-mono text-[12px] font-black uppercase tracking-wide text-[#3d0500] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                disabled={isDeletingCourse}
                onClick={() => void handleConfirmDeleteCourse()}
              >
                {isDeletingCourse ? 'Đang xử lý...' : canModerateSelectedCourse ? 'Tạm khóa' : 'Xóa khóa học'}
              </button>
            </div>
          </section>
        </div>
      )}

      <RoleSidebar activePath="/lesson-management" items={navItems} user={user} />

      <main className="min-w-0 md:pl-64">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-5 p-4 md:flex-row md:items-start md:p-6">
          <aside className="w-full shrink-0 space-y-5 md:sticky md:top-24 md:w-[340px] xl:w-[380px]">
            <section className="rounded-2xl border border-[#253047] bg-[#111827]/92 p-5 shadow-xl shadow-black/20">
              <div className="mb-5">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#24dfba]/25 bg-[#24dfba]/10 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-[#24dfba]">
                  <span className="material-symbols-outlined text-[16px]">school</span>
                  Course studio
                </span>
                <h1 className="mt-4 text-[28px] font-black leading-9 text-white">Quản lý khóa học</h1>
                <p className="mt-2 text-[14px] leading-6 text-[#b8c1d6]">
                  Chỉnh sửa thông tin, thêm bài học, kiểm duyệt đăng ký và điều hướng sang phần quiz.
                </p>
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-[#253047] bg-[#070d19] p-3">
                <label className="min-w-0 flex-1">
                  <span className={labelClass}>Khóa học đang quản lý</span>
                  <select className={`${fieldClass} mt-2`} value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)}>
                    {courses.map((course) => (
                      <option key={course._id} value={course._id}>{course.title}</option>
                    ))}
                  </select>
                </label>

                <div className="flex w-full items-stretch rounded-xl bg-[#111827] px-3 py-2">
                  <div className={`${user?.role === 'admin' ? 'basis-1/2' : 'basis-1/3'} min-w-0 text-center`}>
                    <span className="block font-mono text-[10px] uppercase text-[#8f9bb3]">Khóa</span>
                    <span className="text-[18px] font-black leading-6 text-[#adc7ff]">{courses.length}</span>
                  </div>
                  <div className={`${user?.role === 'admin' ? 'basis-1/2 border-l' : 'basis-1/3 border-x'} min-w-0 border-[#354055] text-center`}>
                    <span className="block font-mono text-[10px] uppercase text-[#8f9bb3]">Bài</span>
                    <span className="text-[18px] font-black leading-6 text-[#24dfba]">{lessons.length}</span>
                  </div>
                  {user?.role !== 'admin' && (
                    <div className="min-w-0 basis-1/3 text-center">
                      <span className="block font-mono text-[10px] uppercase text-[#8f9bb3]">Quiz</span>
                      <span className="text-[18px] font-black leading-6 text-[#ffcc7a]">{quizzes.length}</span>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {selectedCourse && (
              <section className="rounded-2xl border border-[#253047] bg-[#111827]/92 p-5 shadow-xl shadow-black/20">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[21px] font-extrabold">Thông tin khóa học</h2>
                    <p className="text-[13px] text-[#8f9bb3]">Cài đặt cơ bản và thumbnail</p>
                  </div>
                  {(canEditSelectedCourse || canModerateSelectedCourse) && (
                    <button
                      className="rounded-xl border border-[#ffb4ab]/40 px-3 py-2 font-mono text-[11px] font-bold text-[#ffb4ab] transition hover:bg-[#ffb4ab]/10"
                      type="button"
                      onClick={() => void handleDeleteCourse()}
                    >
                      {canModerateSelectedCourse ? 'Tạm khóa' : 'Xóa'}
                    </button>
                  )}
                </div>

                {canEditSelectedCourse ? (
                  <form className="space-y-4" onSubmit={handleUpdateCourse}>
                    <label className="flex flex-col gap-2">
                      <span className={labelClass}>Tên khóa học</span>
                      <input className={fieldClass} placeholder="Tên khóa học" value={courseForm.title} onChange={(event) => setCourseForm((current) => ({ ...current, title: event.target.value }))} />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className={labelClass}>Mô tả</span>
                      <textarea className={`${fieldClass} min-h-24 resize-y leading-6`} placeholder="Mô tả khóa học" value={courseForm.description} onChange={(event) => setCourseForm((current) => ({ ...current, description: event.target.value }))} />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className={labelClass}>Kiểu đăng ký</span>
                      <select className={fieldClass} value={courseForm.enrollment_type} onChange={(event) => setCourseForm((current) => ({ ...current, enrollment_type: event.target.value as EnrollmentType }))}>
                        <option value="open">Đăng ký mở</option>
                        <option value="approval_required">Cần duyệt</option>
                      </select>
                    </label>

                    <div className="rounded-xl border border-[#354055] bg-[#070d19] p-3">
                      <p className={labelClass}>Thumbnail S3</p>
                      <p className="mt-2 truncate font-mono text-[12px] text-[#adc7ff]">{selectedCourse.thumbnail_key || 'Chưa có thumbnail'}</p>
                      <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#adc7ff]/40 bg-[#adc7ff]/10 px-4 py-3 font-mono text-[12px] font-bold uppercase tracking-wide text-[#adc7ff] transition hover:bg-[#adc7ff]/20">
                        <span className="material-symbols-outlined text-[18px]">upload</span>
                        Đổi thumbnail
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={async (event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              const key = await handleFileUpload(file, 'thumbnails');
                              if (key && selectedCourseId) {
                                await api.updateCourse(selectedCourseId, { thumbnail_key: key });
                                await loadCourses(selectedCourseId);
                                setMessage('Cập nhật thumbnail thành công!');
                              }
                            }
                          }}
                        />
                      </label>
                    </div>

                    <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#adc7ff] px-5 py-3 font-mono text-[13px] font-black uppercase tracking-wide text-[#00285b] shadow-lg shadow-[#adc7ff]/20 transition hover:brightness-110 active:scale-[0.98]" type="submit">
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      Lưu khóa học
                    </button>
                  </form>
                ) : (
                  <div className="rounded-xl border border-[#354055] bg-[#070d19] p-4">
                    <h3 className="text-[20px] font-bold">{selectedCourse.title}</h3>
                    <p className="mt-2 text-[14px] leading-6 text-[#b8c1d6]">{selectedCourse.description || 'Chưa có mô tả'}</p>
                    <p className="mt-3 font-mono text-[12px] text-[#8f9bb3]">
                      Admin đang ở chế độ kiểm duyệt, không chỉnh sửa nội dung của khóa học này.
                    </p>
                  </div>
                )}
              </section>
            )}
          </aside>

          <section className="flex min-w-0 flex-1 flex-col gap-5">
            {isLoading && (
              <div className="rounded-2xl border border-[#ffc080]/30 bg-[#ffc080]/10 px-5 py-4 text-[14px] text-[#ffc080]">
                Đang tải dữ liệu...
              </div>
            )}

            {!isLoading && !courses.length && (
              <section className="rounded-2xl border border-dashed border-[#354055] bg-[#111827]/92 p-10 text-center shadow-xl shadow-black/20">
                <span className="material-symbols-outlined mb-3 text-[52px] text-[#657188]">school</span>
                <h2 className="text-[24px] font-bold text-white">Chưa có khóa học nào có thể quản lý</h2>
                <p className="mt-2 text-[#b8c1d6]">Hãy tạo khóa học ở trang Khóa học trước, sau đó quay lại để thêm bài học và quiz.</p>
              </section>
            )}

            {selectedCourse && (
              <>
                {canEditSelectedCourse && selectedCourse.enrollment_type === 'approval_required' && (
                  <section className="overflow-hidden rounded-2xl border border-[#253047] bg-[#111827]/92 shadow-xl shadow-black/20">
                    <div className="flex flex-col gap-2 border-b border-[#253047] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-[21px] font-extrabold">Duyệt enrollment</h2>
                        <p className="mt-1 text-[14px] text-[#8f9bb3]">Yêu cầu đăng ký đang chờ duyệt cho khóa học này.</p>
                      </div>
                      <span className="rounded-full border border-[#ffc080]/30 bg-[#ffc080]/10 px-3 py-1 font-mono text-[12px] text-[#ffc080]">
                        {pendingEnrollments.length} chờ duyệt
                      </span>
                    </div>

                    {!pendingEnrollments.length ? (
                      <div className="p-8 text-center text-[#b8c1d6]">Chưa có enrollment nào cần duyệt.</div>
                    ) : (
                      <div className="divide-y divide-[#253047]">
                        {pendingEnrollments.map((enrollment) => (
                          <article key={enrollment._id} className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                            <div>
                              <h3 className="text-[18px] font-bold">{getEnrollmentUserName(enrollment)}</h3>
                              <p className="mt-1 text-[14px] text-[#b8c1d6]">{getEnrollmentUserEmail(enrollment)}</p>
                              <p className="mt-2 font-mono text-[12px] text-[#8f9bb3]">Trạng thái: chờ duyệt</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button className="rounded-xl bg-[#24dfba] px-4 py-2 font-mono text-[12px] font-black text-[#00382c]" type="button" onClick={() => void handleApproveEnrollment(enrollment._id)}>
                                Duyệt
                              </button>
                              <button className="rounded-xl border border-[#ffb4ab]/40 px-4 py-2 font-mono text-[12px] font-bold text-[#ffb4ab] hover:bg-[#ffb4ab]/10" type="button" onClick={() => void handleRejectEnrollment(enrollment._id)}>
                                Từ chối
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {canEditSelectedCourse && (
                  <form className="rounded-2xl border border-[#253047] bg-[#111827]/92 p-5 shadow-xl shadow-black/20" onSubmit={handleSaveLesson}>
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-[22px] font-extrabold text-white">{editingLessonId ? 'Sửa bài học' : 'Thêm bài học'}</h2>
                        <p className="text-[13px] text-[#8f9bb3]">Nội dung bài học, video và tài liệu S3</p>
                      </div>
                      {isUploading && <span className="rounded-full bg-[#ffc080]/10 px-3 py-1 font-mono text-[12px] text-[#ffc080]">Đang upload...</span>}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1fr_150px]">
                      <label className="flex flex-col gap-2">
                        <span className={labelClass}>Tên bài học</span>
                        <input className={fieldClass} placeholder="Tên bài học" value={lessonForm.title} onChange={(event) => setLessonForm((current) => ({ ...current, title: event.target.value }))} />
                      </label>
                      <label className="flex flex-col gap-2">
                        <span className={labelClass}>Thứ tự</span>
                        <input className={fieldClass} type="number" min="1" placeholder="1" value={lessonForm.order_index} onChange={(event) => setLessonForm((current) => ({ ...current, order_index: event.target.value }))} />
                      </label>
                    </div>

                    <label className="mt-4 flex flex-col gap-2">
                      <span className={labelClass}>Nội dung bài học</span>
                      <textarea className={`${fieldClass} min-h-28 resize-y leading-7`} placeholder="Nội dung bài học" value={lessonForm.content} onChange={(event) => setLessonForm((current) => ({ ...current, content: event.target.value }))} />
                    </label>

                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      <div className="rounded-xl border border-[#354055] bg-[#070d19] p-3">
                        <span className={labelClass}>Video bài học</span>
                        <div className="mt-2 flex gap-2">
                          <input className="min-w-0 flex-1 rounded-lg border border-[#354055] bg-[#0d1422] px-3 py-2 font-mono text-[12px] text-[#e7ecff]" placeholder="Video key..." value={lessonForm.video_key} onChange={(event) => setLessonForm((current) => ({ ...current, video_key: event.target.value }))} />
                          <label className="flex cursor-pointer items-center justify-center rounded-lg border border-[#adc7ff]/40 bg-[#adc7ff]/10 px-3 py-2 text-[#adc7ff] hover:bg-[#adc7ff]/20">
                            <span className="material-symbols-outlined text-[18px]">upload</span>
                            <input
                              type="file"
                              accept="video/mp4,video/webm"
                              className="hidden"
                              onChange={async (event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                  const key = await handleFileUpload(file, 'lessons/videos');
                                  if (key) setLessonForm((prev) => ({ ...prev, video_key: key }));
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#354055] bg-[#070d19] p-3">
                        <span className={labelClass}>Tài liệu bài học</span>
                        <div className="mt-2 flex gap-2">
                          <input className="min-w-0 flex-1 rounded-lg border border-[#354055] bg-[#0d1422] px-3 py-2 font-mono text-[12px] text-[#e7ecff]" placeholder="Document key..." value={lessonForm.document_key} onChange={(event) => setLessonForm((current) => ({ ...current, document_key: event.target.value }))} />
                          <label className="flex cursor-pointer items-center justify-center rounded-lg border border-[#adc7ff]/40 bg-[#adc7ff]/10 px-3 py-2 text-[#adc7ff] hover:bg-[#adc7ff]/20">
                            <span className="material-symbols-outlined text-[18px]">upload_file</span>
                            <input
                              type="file"
                              accept="application/pdf,.docx"
                              className="hidden"
                              onChange={async (event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                  const key = await handleFileUpload(file, 'lessons/documents');
                                  if (key) setLessonForm((prev) => ({ ...prev, document_key: key }));
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button className="rounded-xl bg-[#24dfba] px-5 py-3 font-mono text-[13px] font-black uppercase tracking-wide text-[#00382c] shadow-lg shadow-[#24dfba]/15 transition hover:brightness-110" type="submit">
                        {editingLessonId ? 'Cập nhật' : 'Thêm bài học'}
                      </button>
                      {editingLessonId && (
                        <button className="rounded-xl border border-[#354055] px-5 py-3 font-mono text-[13px] font-bold text-[#b8c1d6] hover:bg-[#151e2d]" type="button" onClick={() => { setEditingLessonId(''); setLessonForm(emptyLessonForm); }}>
                          Hủy
                        </button>
                      )}
                    </div>
                  </form>
                )}

                <section className="overflow-hidden rounded-2xl border border-[#253047] bg-[#111827]/92 shadow-xl shadow-black/20">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#253047] px-5 py-4">
                    <div>
                      <h2 className="text-[22px] font-extrabold">Bài học trong khóa</h2>
                      <p className="text-[13px] text-[#8f9bb3]">Sắp xếp theo thứ tự học</p>
                    </div>
                    <span className="rounded-full bg-[#070d19] px-3 py-1 font-mono text-[12px] text-[#24dfba]">{lessons.length} bài học</span>
                  </div>
                  {!lessons.length ? (
                    <div className="p-8 text-center text-[#b8c1d6]">Chưa có bài học nào.</div>
                  ) : (
                    <div className="divide-y divide-[#253047]">
                      {lessons.map((lesson) => (
                        <article key={lesson._id} className="group/lesson flex flex-col gap-3 p-3 transition hover:bg-[#151e2d] md:flex-row md:items-center md:justify-between">
                          <a
                            className="min-w-0 flex-1 rounded-xl p-2 outline-none transition hover:bg-[#adc7ff]/5 focus-visible:ring-2 focus-visible:ring-[#adc7ff]/60"
                            href={`/lesson-detail?course_id=${encodeURIComponent(selectedCourseId)}&lesson_id=${encodeURIComponent(lesson._id)}`}
                            aria-label={`Mở bài học ${lesson.title}`}
                          >
                            <span className="inline-flex rounded-lg bg-[#adc7ff]/15 px-2 py-1 font-mono text-[12px] font-black text-[#adc7ff]">#{lesson.order_index}</span>
                            <h3 className="mt-3 flex items-center gap-2 break-words text-[18px] font-bold text-white transition group-hover/lesson:text-[#adc7ff]">
                              {lesson.title}
                              <span className="material-symbols-outlined text-[18px] text-[#8f9bb3] transition group-hover/lesson:translate-x-1 group-hover/lesson:text-[#adc7ff]">arrow_forward</span>
                            </h3>
                            <p className="mt-1 line-clamp-2 text-[14px] leading-6 text-[#b8c1d6]">{lesson.content || 'Chưa có nội dung'}</p>
                          </a>
                          {canEditSelectedCourse && (
                            <div className="flex shrink-0 flex-wrap gap-2 px-2 pb-2 md:px-0 md:pb-0 md:pr-2">
							  <button className="rounded-xl border border-[#adc7ff]/40 px-4 py-2 font-mono text-[12px] font-bold text-[#adc7ff] hover:bg-[#adc7ff]/10" type="button" onClick={() => { setEditingLessonId(lesson._id); setLessonForm(toLessonForm(lesson)); }}>
								Sửa
							  </button>
							  <button className="rounded-xl border border-[#ffb4ab]/40 px-4 py-2 font-mono text-[12px] font-bold text-[#ffb4ab] hover:bg-[#ffb4ab]/10" type="button" onClick={() => void handleDeleteLesson(lesson._id)}>
								Xóa
							  </button>
							</div>
						  )}
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                {user?.role !== 'admin' && (
                <section className="overflow-hidden rounded-2xl border border-[#253047] bg-[#111827]/92 shadow-xl shadow-black/20">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#253047] px-5 py-4">
                    <div>
                      <h2 className="text-[22px] font-extrabold">Quiz trong khóa</h2>
                      <p className="text-[13px] text-[#8f9bb3]">Tạo và quản lý câu hỏi qua trang quiz builder</p>
                    </div>
                    {canManageQuiz && (
                      <a className="inline-flex items-center gap-2 rounded-xl bg-[#adc7ff] px-4 py-2 font-mono text-[12px] font-black uppercase tracking-wide text-[#00285b]" href={`/question-builder?course_id=${selectedCourseId}`}>
                        <span className="material-symbols-outlined text-[18px]">quiz</span>
                        Tạo quiz
                      </a>
                    )}
                  </div>

                  {!quizzes.length ? (
                    <div className="p-8 text-center text-[#b8c1d6]">Chưa có quiz nào.</div>
                  ) : (
                    <div className="divide-y divide-[#253047]">
                      {quizzes.map((quiz) => (
                        <article key={quiz._id} className={`flex flex-col gap-3 p-5 transition hover:bg-[#151e2d] md:flex-row md:items-center md:justify-between ${quiz._id === selectedQuizId ? 'bg-[#24dfba]/5' : ''}`}>
                          <button className="min-w-0 text-left" type="button" onClick={() => setSelectedQuizId(quiz._id)}>
                            <h3 className="break-words text-[18px] font-bold text-white">{quiz.title}</h3>
                            <p className="mt-1 text-[14px] leading-6 text-[#b8c1d6]">{quiz.description || 'Chưa có mô tả'} · {quiz.time_limit} phút</p>
                          </button>
                          {canManageQuiz && (
                            <a className="shrink-0 rounded-xl bg-[#adc7ff] px-4 py-2 font-mono text-[12px] font-black text-[#00285b]" href={`/question-builder?course_id=${selectedCourseId}&quiz_id=${quiz._id}`}>
                              Quản lý quiz
                            </a>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </section>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      <SphereAIButton />
    </div>
  );
}
