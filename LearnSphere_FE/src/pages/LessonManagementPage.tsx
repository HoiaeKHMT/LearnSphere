import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { RoleSidebar } from '../components/RoleSidebar';
import { AppHeader } from '../components/AppHeader';
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

  // Silence unused state warning if needed or display upload badge
  useEffect(() => {
    if (isUploading) {
      // isUploading active
    }
  }, [isUploading]);

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

  const selectedCourse = useMemo(() => courses.find((course) => course._id === selectedCourseId), [courses, selectedCourseId]);
  const canEditSelectedCourse = selectedCourse ? isCourseOwner(user, selectedCourse) : false;
  const canModerateSelectedCourse = selectedCourse ? canModerateCourse(user, selectedCourse) : false;

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

  async function handleDeleteCourse() {
    if (!selectedCourseId) return;
    const confirmed = window.confirm(
      canModerateSelectedCourse
        ? 'Tạm khóa khóa học này bằng cơ chế xóa mềm hiện có?'
        : 'Xóa khóa học này? Khóa học sẽ được đưa vào thùng rác theo cơ chế xóa mềm hiện có.',
    );
    if (!confirmed) return;

    try {
      const result = await api.deleteCourse(selectedCourseId);
      setMessage(canModerateSelectedCourse ? `${result.message}. Cần thông báo cho chủ sở hữu theo quy trình quản trị.` : result.message);
      await loadCourses('');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể xóa khóa học');
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
        <section className="max-w-md rounded-xl border border-[#414754] bg-[#161c28] p-8 text-center">
          <span className="material-symbols-outlined mb-4 text-[48px] text-[#ffb4ab]">lock</span>
          <h1 className="text-[26px] font-semibold">Không có quyền truy cập</h1>
          <p className="mt-2 text-[#c1c6d7]">Chỉ giảng viên và admin được quản lý khóa học.</p>
          <a className="mt-6 inline-flex rounded-lg bg-[#adc7ff] px-5 py-3 font-bold text-[#002e68]" href="/dashboard">
            Về bảng điều khiển
          </a>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d131f] text-[#dde2f4]">
      <AppHeader user={user} roleLabel={getRoleLabel(user?.role)} avatarSrc={avatarSrc} />

      <RoleSidebar activePath="/lesson-management" items={navItems} user={user} />

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:pl-72 md:pr-8">
        <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 font-mono text-[12px] uppercase tracking-wider text-[#8b90a0]">{getRoleLabel(user?.role)}</p>
            <h1 className="text-[32px] font-semibold leading-10">Quản lý khóa học</h1>
            <p className="mt-1 text-[#c1c6d7]">Gia sư chỉnh sửa khóa học do mình tạo. Admin chỉ kiểm duyệt, tạm khóa hoặc xóa mềm khóa học của người khác.</p>
          </div>
          <label className="flex min-w-[260px] flex-col gap-2">
            <span className="font-mono text-[12px] uppercase tracking-wider text-[#8b90a0]">Khóa học đang quản lý</span>
            <select className="rounded-lg border border-[#414754] bg-[#161c28] px-4 py-3 text-[#dde2f4]" value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)}>
              {courses.map((course) => (
                <option key={course._id} value={course._id}>{course.title}</option>
              ))}
            </select>
          </label>
        </section>

        {(isLoading || message) && (
          <div className="rounded-lg border border-[#ffc080]/30 bg-[#ffc080]/10 px-4 py-3 text-[14px] text-[#ffc080]">
            {isLoading ? 'Đang tải dữ liệu...' : message}
          </div>
        )}

        {!isLoading && !courses.length && (
          <section className="rounded-xl border border-dashed border-[#414754] bg-[#161c28] p-10 text-center">
            <span className="material-symbols-outlined mb-3 text-[44px] text-[#8b90a0]">school</span>
            <h2 className="text-[22px] font-semibold">Chưa có khóa học nào có thể quản lý</h2>
            <p className="mt-2 text-[#c1c6d7]">Hãy tạo khóa học ở trang Khóa học trước, sau đó quay lại để thêm bài học và quiz.</p>
          </section>
        )}

        {selectedCourse && (
          <>
            <section className="rounded-xl border border-white/5 bg-[#161c28] p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-[22px] font-semibold">Thông tin khóa học</h2>
                {(canEditSelectedCourse || canModerateSelectedCourse) && (
                  <button className="rounded-lg border border-[#ffb4ab]/40 px-4 py-2 font-mono text-[12px] font-bold text-[#ffb4ab]" type="button" onClick={() => void handleDeleteCourse()}>
                    {canModerateSelectedCourse ? 'Tạm khóa khóa học' : 'Xóa khóa học'}
                  </button>
                )}
              </div>
              {canEditSelectedCourse ? (
                <div className="space-y-4">
                  <form className="grid gap-4 md:grid-cols-[1fr_1fr_220px_auto]" onSubmit={handleUpdateCourse}>
                    <input className="rounded-lg border border-[#414754] bg-[#0d131f] px-4 py-3" placeholder="Tên khóa học" value={courseForm.title} onChange={(event) => setCourseForm((current) => ({ ...current, title: event.target.value }))} />
                    <input className="rounded-lg border border-[#414754] bg-[#0d131f] px-4 py-3" placeholder="Mô tả" value={courseForm.description} onChange={(event) => setCourseForm((current) => ({ ...current, description: event.target.value }))} />
                    <select className="rounded-lg border border-[#414754] bg-[#0d131f] px-4 py-3" value={courseForm.enrollment_type} onChange={(event) => setCourseForm((current) => ({ ...current, enrollment_type: event.target.value as EnrollmentType }))}>
                      <option value="open">Đăng ký mở</option>
                      <option value="approval_required">Cần duyệt</option>
                    </select>
                    <button className="rounded-lg bg-[#adc7ff] px-5 py-3 font-mono text-[13px] font-bold text-[#00285b]" type="submit">Lưu khóa học</button>
                  </form>

                  <div className="flex items-center gap-4 rounded-lg border border-[#414754]/50 bg-[#0d131f] p-3">
                    <span className="font-mono text-[12px] text-[#8b90a0]">Ảnh đại diện khóa học (Thumbnail S3):</span>
                    <span className="truncate font-mono text-[12px] text-[#adc7ff]">{selectedCourse.thumbnail_key || 'Chưa có thumbnail'}</span>
                    <label className="ml-auto flex cursor-pointer items-center gap-2 rounded-lg border border-[#adc7ff]/40 bg-[#adc7ff]/10 px-4 py-2 font-mono text-[12px] text-[#adc7ff] hover:bg-[#adc7ff]/20">
                      <span className="material-symbols-outlined text-[18px]">upload</span>
                      Upload Thumbnail
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const key = await handleFileUpload(file, 'thumbnails');
                            if (key && selectedCourseId) {
                              await api.updateCourse(selectedCourseId, { thumbnail_key: key });
                              await loadCourses(selectedCourseId);
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-[#414754] bg-[#0d131f] p-4">
                  <h3 className="text-[20px] font-semibold">{selectedCourse.title}</h3>
                  <p className="mt-2 text-[#c1c6d7]">{selectedCourse.description || 'Chưa có mô tả'}</p>
                  <p className="mt-3 font-mono text-[12px] text-[#8b90a0]">
                    Admin đang ở chế độ kiểm duyệt. Không thể chỉnh sửa tiêu đề, mô tả, bài học, quiz hoặc câu hỏi của khóa học này.
                  </p>
                  {canModerateSelectedCourse && (
                    <p className="mt-2 text-[13px] text-[#ffc080]">
                      Khóa học có thể được mở lại ở trang Khóa học bị khóa.
                    </p>
                  )}
                </div>
              )}
            </section>

            {canEditSelectedCourse && selectedCourse.enrollment_type === 'approval_required' && (
              <section className="overflow-hidden rounded-xl border border-white/5 bg-[#161c28]">
                <div className="flex flex-col gap-2 border-b border-[#414754] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-[22px] font-semibold">Duyệt enrollment</h2>
                    <p className="mt-1 text-[14px] text-[#c1c6d7]">Các yêu cầu đăng ký đang chờ duyệt cho khóa học này.</p>
                  </div>
                  <span className="rounded-full border border-[#ffc080]/30 bg-[#ffc080]/10 px-3 py-1 font-mono text-[12px] text-[#ffc080]">
                    {pendingEnrollments.length} chờ duyệt
                  </span>
                </div>

                {!pendingEnrollments.length ? (
                  <div className="p-8 text-center text-[#c1c6d7]">Chưa có enrollment nào cần duyệt.</div>
                ) : (
                  <div className="divide-y divide-[#414754]/40">
                    {pendingEnrollments.map((enrollment) => (
                      <article key={enrollment._id} className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h3 className="text-[18px] font-semibold">{getEnrollmentUserName(enrollment)}</h3>
                          <p className="mt-1 text-[14px] text-[#c1c6d7]">{getEnrollmentUserEmail(enrollment)}</p>
                          <p className="mt-2 font-mono text-[12px] text-[#8b90a0]">Trạng thái: chờ duyệt</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button className="rounded-lg bg-[#24dfba] px-4 py-2 font-mono text-[12px] font-bold text-[#00382c]" type="button" onClick={() => void handleApproveEnrollment(enrollment._id)}>
                            Duyệt
                          </button>
                          <button className="rounded-lg border border-[#ffb4ab]/40 px-4 py-2 font-mono text-[12px] text-[#ffb4ab]" type="button" onClick={() => void handleRejectEnrollment(enrollment._id)}>
                            Từ chối
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
              {canEditSelectedCourse && <form className="space-y-4 rounded-xl border border-white/5 bg-[#161c28] p-5" onSubmit={handleSaveLesson}>
                <h2 className="text-[22px] font-semibold">{editingLessonId ? 'Sửa bài học' : 'Thêm bài học'}</h2>
                <div className="space-y-3">
                  <input className="w-full rounded-lg border border-[#414754] bg-[#0d131f] px-4 py-3" placeholder="Tên bài học" value={lessonForm.title} onChange={(event) => setLessonForm((current) => ({ ...current, title: event.target.value }))} />
                  <textarea className="min-h-28 w-full rounded-lg border border-[#414754] bg-[#0d131f] px-4 py-3" placeholder="Nội dung bài học" value={lessonForm.content} onChange={(event) => setLessonForm((current) => ({ ...current, content: event.target.value }))} />
                  <input className="w-full rounded-lg border border-[#414754] bg-[#0d131f] px-4 py-3" type="number" min="1" placeholder="Thứ tự bài học" value={lessonForm.order_index} onChange={(event) => setLessonForm((current) => ({ ...current, order_index: event.target.value }))} />
                  
                  {/* Video key & upload button */}
                  <div className="space-y-1">
                    <label className="block font-mono text-[12px] text-[#8b90a0]">Video Bài học (S3)</label>
                    <div className="flex gap-2">
                      <input className="flex-1 rounded-lg border border-[#414754] bg-[#0d131f] px-4 py-2 font-mono text-[12px]" placeholder="Video key..." value={lessonForm.video_key} onChange={(event) => setLessonForm((current) => ({ ...current, video_key: event.target.value }))} />
                      <label className="flex cursor-pointer items-center justify-center rounded-lg border border-[#adc7ff]/40 bg-[#adc7ff]/10 px-3 py-2 font-mono text-[12px] text-[#adc7ff] hover:bg-[#adc7ff]/20">
                        Upload Video
                        <input
                          type="file"
                          accept="video/mp4,video/webm"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const key = await handleFileUpload(file, 'lessons/videos');
                              if (key) setLessonForm((prev) => ({ ...prev, video_key: key }));
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Document key & upload button */}
                  <div className="space-y-1">
                    <label className="block font-mono text-[12px] text-[#8b90a0]">Tài liệu Bài học (S3)</label>
                    <div className="flex gap-2">
                      <input className="flex-1 rounded-lg border border-[#414754] bg-[#0d131f] px-4 py-2 font-mono text-[12px]" placeholder="Document key..." value={lessonForm.document_key} onChange={(event) => setLessonForm((current) => ({ ...current, document_key: event.target.value }))} />
                      <label className="flex cursor-pointer items-center justify-center rounded-lg border border-[#adc7ff]/40 bg-[#adc7ff]/10 px-3 py-2 font-mono text-[12px] text-[#adc7ff] hover:bg-[#adc7ff]/20">
                        Upload PDF/DOC
                        <input
                          type="file"
                          accept="application/pdf,.docx"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
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
                <div className="flex gap-2">
                  <button className="rounded-lg bg-[#24dfba] px-5 py-3 font-mono text-[13px] font-bold text-[#00382c]" type="submit">{editingLessonId ? 'Cập nhật' : 'Thêm bài học'}</button>
                  {editingLessonId && <button className="rounded-lg border border-[#414754] px-5 py-3 font-mono text-[13px]" type="button" onClick={() => { setEditingLessonId(''); setLessonForm(emptyLessonForm); }}>Hủy</button>}
                </div>
              </form>}

              <section className="overflow-hidden rounded-xl border border-white/5 bg-[#161c28]">
                <div className="border-b border-[#414754] px-5 py-4">
                  <h2 className="text-[22px] font-semibold">Bài học trong khóa</h2>
                </div>
                {!lessons.length ? (
                  <div className="p-8 text-center text-[#c1c6d7]">Chưa có bài học nào.</div>
                ) : (
                  <div className="divide-y divide-[#414754]/40">
                    {lessons.map((lesson) => (
                      <article key={lesson._id} className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-mono text-[12px] text-[#adc7ff]">#{lesson.order_index}</p>
                          <h3 className="text-[18px] font-semibold">{lesson.title}</h3>
                          <p className="mt-1 line-clamp-2 text-[14px] text-[#c1c6d7]">{lesson.content || 'Chưa có nội dung'}</p>
                        </div>
                        {canEditSelectedCourse && (
                          <div className="flex gap-2">
                            <button className="rounded-lg border border-[#adc7ff]/40 px-4 py-2 font-mono text-[12px] text-[#adc7ff]" type="button" onClick={() => { setEditingLessonId(lesson._id); setLessonForm(toLessonForm(lesson)); }}>Sửa</button>
                            <button className="rounded-lg border border-[#ffb4ab]/40 px-4 py-2 font-mono text-[12px] text-[#ffb4ab]" type="button" onClick={() => void handleDeleteLesson(lesson._id)}>Xóa</button>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </section>

            <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
              {canEditSelectedCourse && (
                <section className="space-y-4 rounded-xl border border-white/5 bg-[#161c28] p-5">
                  <h2 className="text-[22px] font-semibold">Quản lý quiz</h2>
                  <p className="text-[14px] leading-6 text-[#c1c6d7]">Tạo quiz và thêm câu hỏi chi tiết ở trang Quản lý quiz.</p>
                  <a className="inline-flex items-center gap-2 rounded-lg bg-[#adc7ff] px-5 py-3 font-mono text-[13px] font-bold text-[#00285b]" href={`/question-builder?course_id=${selectedCourseId}`}>
                    <span className="material-symbols-outlined text-[18px]">quiz</span>
                    Tạo quiz
                  </a>
                </section>
              )}

              <section className="overflow-hidden rounded-xl border border-white/5 bg-[#161c28]">
                <div className="border-b border-[#414754] px-5 py-4">
                  <h2 className="text-[22px] font-semibold">Quiz trong khóa</h2>
                </div>
                {!quizzes.length ? (
                  <div className="p-8 text-center text-[#c1c6d7]">Chưa có quiz nào.</div>
                ) : (
                  <div className="divide-y divide-[#414754]/40">
                    {quizzes.map((quiz) => (
                      <article key={quiz._id} className={`flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between ${quiz._id === selectedQuizId ? 'bg-[#2f3542]/30' : ''}`}>
                        <button className="text-left" type="button" onClick={() => setSelectedQuizId(quiz._id)}>
                          <h3 className="text-[18px] font-semibold">{quiz.title}</h3>
                          <p className="mt-1 text-[14px] text-[#c1c6d7]">{quiz.description || 'Chưa có mô tả'} · {quiz.time_limit} phút</p>
                        </button>
                        {canEditSelectedCourse && (
                          <div className="flex gap-2">
                            <a className="rounded-lg bg-[#adc7ff] px-4 py-2 font-mono text-[12px] font-bold text-[#00285b]" href={`/question-builder?course_id=${selectedCourseId}&quiz_id=${quiz._id}`}>
                              Quản lý quiz
                            </a>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </section>
          </>
        )}
      </main>

      <SphereAIButton />
    </div>
  );
}
