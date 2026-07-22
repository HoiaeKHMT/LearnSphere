import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppHeader } from '../components/AppHeader';
import { AppToast } from '../components/AppToast';
import { SphereAIButton } from '../components/SphereAIButton';
import { RoleSidebar } from '../components/RoleSidebar';
import { canModerateCourse, canStudy, getRoleLabel, getRoleNav, isCourseOwner } from '../lib/roleAccess';
import { api, getStoredUser, type Course, type CourseProgress, type Enrollment, type EnrollmentType } from '../services/api';

const avatarSrc =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAK3DeXFfcU7eoLcYm0J-P0geFc_1SNB3sOpbZdSgXNGYGNkWLvpydHgoO3teNd6SCKCfYzJzNrs1AB7P8Pu74X-3istluRsHM1oPvbEs2nLPM2cHWOxHmwakxXKAZY99rZGG-p9kypULkAvH9bkTxwS1EgNluYqYhNlGpql2gZkqIWaOYk5FWOQvYjhFI2VJivahYgEOwamgFB5MZtSI9a-fovv-ztHAlZ1TjPwNnEgpB773mBUptA6A';
const heroImage =
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1600&q=80';

type CourseForm = {
  title: string;
  description: string;
  enrollment_type: EnrollmentType;
};

type SortMode = 'popular' | 'newest' | 'title';
type EnrollmentFilter = 'all' | 'open' | 'approval_required';
type StudentStatusFilter = 'all' | 'not_enrolled' | 'active' | 'pending';

const sortOptions: Array<{ value: SortMode; label: string; icon: string }> = [
  { value: 'popular', label: 'Phù hợp nhất', icon: 'stars' },
  { value: 'newest', label: 'Mới nhất', icon: 'fiber_new' },
  { value: 'title', label: 'Tên A-Z', icon: 'sort_by_alpha' },
];

function getCourseHref(courseId: string) {
  return `/course-detail?course_id=${encodeURIComponent(courseId)}`;
}

export function CourseCatalogPage() {
  const user = getStoredUser();
  const navItems = useMemo(() => getRoleNav(user), [user]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollmentStatusByCourseId, setEnrollmentStatusByCourseId] = useState<Record<string, Enrollment['status']>>({});
  const [progressByCourseId, setProgressByCourseId] = useState<Record<string, CourseProgress>>({});
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateCourseOpen, setIsCreateCourseOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('popular');
  const [enrollmentFilter, setEnrollmentFilter] = useState<EnrollmentFilter>('all');
  const [studentStatusFilter, setStudentStatusFilter] = useState<StudentStatusFilter>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [form, setForm] = useState<CourseForm>({
    title: '',
    description: '',
    enrollment_type: 'open',
  });
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  async function loadCourses({ silent = false } = {}) {
    if (!silent) {
      setIsLoading(true);
      setMessage('');
    }

    try {
      const [items, myEnrollments] = await Promise.all([
        api.getCourses(),
        canStudy(user) ? api.getMyCourses().catch(() => [] as Enrollment[]) : Promise.resolve([] as Enrollment[]),
      ]);

      setCourses(items);
      const enrollmentStatuses = Object.fromEntries(
        myEnrollments
          .filter((enrollment) => typeof enrollment.course_id !== 'string')
          .map((enrollment) => {
            const enrolledCourse = enrollment.course_id as Course;
            return [enrolledCourse._id, enrollment.status] as const;
          }),
      );
      setEnrollmentStatusByCourseId(enrollmentStatuses);

      if (canStudy(user)) {
        const activeCourseIds = Object.entries(enrollmentStatuses)
          .filter(([, status]) => status === 'active')
          .map(([courseId]) => courseId);
        const progressItems = await Promise.all(
          activeCourseIds.map(async (courseId) => {
            try {
              return [courseId, await api.getCourseProgress(courseId)] as const;
            } catch {
              return null;
            }
          }),
        );
        setProgressByCourseId(Object.fromEntries(progressItems.filter(Boolean) as Array<readonly [string, CourseProgress]>));
      } else {
        setProgressByCourseId({});
      }

      const thumbnails = await Promise.all(
        items
          .filter((course) => course.thumbnail_key)
          .map(async (course) => {
            try {
              const result = await api.getCourseThumbnail(course._id);
              return [course._id, result.download_url] as const;
            } catch {
              return null;
            }
          }),
      );
      setThumbnailUrls(Object.fromEntries(thumbnails.filter(Boolean) as Array<readonly [string, string]>));
    } catch (err) {
      if (!silent) setMessage(err instanceof Error ? err.message : 'Không thể tải khóa học');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadCourses();
    const intervalId = window.setInterval(() => {
      void loadCourses({ silent: true });
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, []);

  async function uploadCourseThumbnail(courseId: string, file: File) {
    const presigned = await api.createPresignedUpload({
      course_id: courseId,
      file_name: file.name,
      content_type: file.type || 'image/jpeg',
      file_size: file.size,
      folder: 'thumbnails',
    });
    await api.uploadFileToS3(presigned.upload_url, file);
    await api.updateCourse(courseId, { thumbnail_key: presigned.file_key });
  }

  async function handleCreateCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (user?.role !== 'tutor') return;
    if (!form.title.trim()) {
      setMessage('Vui lòng nhập tên khóa học.');
      return;
    }

    setIsCreating(true);
    try {
      const result = await api.createCourse({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        enrollment_type: form.enrollment_type,
      });

      if (thumbnailFile && result.course?._id) {
        try {
          await uploadCourseThumbnail(result.course._id, thumbnailFile);
        } catch {
          setMessage('Tạo khóa học thành công nhưng không thể tải thumbnail.');
        }
      }

      setMessage('Tạo khóa học thành công!');
      setForm({ title: '', description: '', enrollment_type: 'open' });
      setThumbnailFile(null);
      setIsCreateCourseOpen(false);
      await loadCourses();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể tạo khóa học');
    } finally {
      setIsCreating(false);
    }
  }

  function closeCreateCourseForm() {
    if (isCreating) return;
    setIsCreateCourseOpen(false);
    setForm({ title: '', description: '', enrollment_type: 'open' });
    setThumbnailFile(null);
  }

  async function handleEnroll(courseId: string) {
    if (!user) {
      window.location.assign('/login');
      return;
    }

    if (!canStudy(user)) {
      setMessage('Chỉ học viên mới đăng ký khóa học.');
      return;
    }

    try {
      const result = await api.enrollCourse(courseId);
      setMessage(result.message);
      await loadCourses();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể đăng ký khóa học');
    }
  }

  function getStudentAction(course: Course) {
    const status = enrollmentStatusByCourseId[course._id];
    if (status === 'active') return { label: 'Vào học', tone: 'active' as const };
    if (status === 'pending') return { label: 'Chờ duyệt', tone: 'pending' as const };
    return { label: 'Đăng ký', tone: 'default' as const };
  }

  function handleCourseAction(course: Course) {
	const courseDetailUrl = getCourseHref(course._id);
    const status = enrollmentStatusByCourseId[course._id];

    if (canStudy(user)) {
      if (status === 'active') {
		window.location.assign(courseDetailUrl);
      } else if (status !== 'pending') {
        void handleEnroll(course._id);
      }
      return;
    }

    if (isCourseOwner(user, course) || canModerateCourse(user, course)) {
      window.location.assign(`/lesson-management?course_id=${encodeURIComponent(course._id)}`);
      return;
    }

	window.location.assign(courseDetailUrl);
  }

  const filteredCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = courses.filter((course) => {
      const status = enrollmentStatusByCourseId[course._id];
      const matchesQuery =
        !normalizedQuery ||
        course.title.toLowerCase().includes(normalizedQuery) ||
        (course.description ?? '').toLowerCase().includes(normalizedQuery);
      const matchesEnrollmentType = enrollmentFilter === 'all' || course.enrollment_type === enrollmentFilter;
      const matchesStudentStatus =
        !canStudy(user) ||
        studentStatusFilter === 'all' ||
        (studentStatusFilter === 'not_enrolled' ? !status : status === studentStatusFilter);

      return matchesQuery && matchesEnrollmentType && matchesStudentStatus;
    });

    return [...filtered].sort((first, second) => {
      if (sortMode === 'title') return first.title.localeCompare(second.title, 'vi');
      if (sortMode === 'newest') return second._id.localeCompare(first._id);
      const firstActive = enrollmentStatusByCourseId[first._id] === 'active' ? 1 : 0;
      const secondActive = enrollmentStatusByCourseId[second._id] === 'active' ? 1 : 0;
      return secondActive - firstActive || first.title.localeCompare(second.title, 'vi');
    });
  }, [courses, enrollmentFilter, enrollmentStatusByCourseId, query, sortMode, studentStatusFilter, user]);

  const featuredCourse = useMemo(
    () =>
      [...courses].sort((first, second) =>
        (second.enrollment_count ?? 0) - (first.enrollment_count ?? 0) ||
        second._id.localeCompare(first._id),
      )[0],
    [courses],
  );
  const featuredImage = featuredCourse ? thumbnailUrls[featuredCourse._id] || heroImage : heroImage;
  const activeCourseCount = Object.values(enrollmentStatusByCourseId).filter((status) => status === 'active').length;

  return (
    <div className="flex min-h-screen flex-col bg-[#0d131f] text-[#dde2f4] selection:bg-[#4a8eff] selection:text-[#00285b]">
      <AppHeader user={user} roleLabel={getRoleLabel(user?.role)} avatarSrc={avatarSrc} />
      <RoleSidebar activePath="/courses" items={navItems} user={user} />

      {user?.role === 'tutor' && isCreateCourseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6">
          <form
            className="max-h-[90vh] w-full max-w-[640px] overflow-y-auto rounded-2xl border border-[#354055] bg-[#111827] shadow-2xl shadow-black/50"
            onSubmit={handleCreateCourse}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#253047] px-5 py-4 sm:px-6">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#adc7ff]/25 bg-[#adc7ff]/10 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-[#adc7ff]">
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  Khóa học mới
                </span>
                <h2 className="mt-3 text-[25px] font-extrabold text-white">Tạo khóa học</h2>
                <p className="mt-1 text-[14px] text-[#8f9bb3]">Nhập thông tin cơ bản; bạn có thể thêm bài học sau khi tạo xong.</p>
              </div>
              <button
                className="rounded-xl border border-[#354055] p-2 text-[#b8c1d6] transition hover:bg-[#1a2435]"
                type="button"
                aria-label="Đóng form tạo khóa học"
                disabled={isCreating}
                onClick={closeCreateCourseForm}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <label className="flex flex-col gap-2">
                <span className="font-mono text-[12px] uppercase tracking-wider text-[#9da8bd]">Tên khóa học</span>
                <input
                  className="rounded-xl border border-[#354055] bg-[#070d19] px-4 py-3 text-[#e7ecff] outline-none placeholder:text-[#7f8aa3] focus:border-[#adc7ff] focus:ring-2 focus:ring-[#adc7ff]/20"
                  autoFocus
                  maxLength={200}
                  placeholder="Ví dụ: Hóa học 12"
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="font-mono text-[12px] uppercase tracking-wider text-[#9da8bd]">Mô tả khóa học</span>
                <textarea
                  className="min-h-32 resize-y rounded-xl border border-[#354055] bg-[#070d19] px-4 py-3 leading-6 text-[#e7ecff] outline-none placeholder:text-[#7f8aa3] focus:border-[#adc7ff] focus:ring-2 focus:ring-[#adc7ff]/20"
                  maxLength={1000}
                  placeholder="Mô tả mục tiêu và nội dung chính của khóa học..."
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                />
                <span className="text-right font-mono text-[11px] text-[#657188]">{form.description.length}/1000</span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="font-mono text-[12px] uppercase tracking-wider text-[#9da8bd]">Hình thức đăng ký</span>
                  <select
                    className="rounded-xl border border-[#354055] bg-[#070d19] px-4 py-3 text-[#e7ecff] outline-none focus:border-[#adc7ff] focus:ring-2 focus:ring-[#adc7ff]/20"
                    value={form.enrollment_type}
                    onChange={(event) => setForm((current) => ({ ...current, enrollment_type: event.target.value as EnrollmentType }))}
                  >
                    <option value="open">Đăng ký mở</option>
                    <option value="approval_required">Cần giảng viên duyệt</option>
                  </select>
                </label>

                <label className="flex cursor-pointer flex-col gap-2">
                  <span className="font-mono text-[12px] uppercase tracking-wider text-[#9da8bd]">Thumbnail</span>
                  <span className="flex min-h-[50px] items-center gap-2 rounded-xl border border-dashed border-[#46536b] bg-[#070d19] px-4 py-3 text-[13px] text-[#adc7ff] transition hover:border-[#adc7ff]">
                    <span className="material-symbols-outlined text-[20px]">upload</span>
                    <span className="min-w-0 truncate">{thumbnailFile ? thumbnailFile.name : 'Chọn ảnh JPG, PNG hoặc WebP'}</span>
                  </span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => setThumbnailFile(event.target.files?.[0] ?? null)} />
                </label>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-[#253047] pt-5 sm:flex-row sm:justify-end">
                <button
                  className="rounded-xl border border-[#46536b] px-5 py-3 font-mono text-[12px] font-black uppercase tracking-wide text-[#c5cee3] transition hover:bg-[#1a2435] disabled:opacity-50"
                  type="button"
                  disabled={isCreating}
                  onClick={closeCreateCourseForm}
                >
                  Hủy
                </button>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#adc7ff] px-5 py-3 font-mono text-[12px] font-black uppercase tracking-wide text-[#00285b] transition hover:brightness-110 disabled:opacity-60"
                  type="submit"
                  disabled={isCreating}
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  {isCreating ? 'Đang tạo...' : 'Tạo khóa học'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <main className="w-full flex-grow pb-24 md:pl-64">
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8">
          <section className="relative overflow-hidden rounded-xl border border-white/5 bg-[#242a37] shadow-card">
            <div className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-700" style={{ backgroundImage: `url(${featuredImage})` }} />
            <div className="absolute inset-0 z-10 bg-[linear-gradient(90deg,#0d131f_0%,rgba(13,19,31,0.88)_42%,rgba(13,19,31,0.18)_100%)]" />
            <div className="relative z-20 flex min-h-[280px] max-w-2xl flex-col justify-center px-6 py-8 md:min-h-[320px] md:px-10">
              <span className="mb-4 inline-flex w-fit items-center gap-1 rounded-full border border-[#24dfba]/20 bg-[#24dfba]/10 px-3 py-1 font-mono text-[12px] font-bold text-[#24dfba]">
                <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: '"FILL" 1' }}>star</span>
                KHÓA HỌC NỔI BẬT
              </span>
              <h1 className="text-[32px] font-bold leading-tight text-[#dde2f4] md:text-[46px]">
                {featuredCourse?.title ?? 'Khám phá khóa học trong LearnSphere'}
              </h1>
              <p className="mt-4 line-clamp-2 text-[15px] leading-7 text-[#c1c6d7] md:text-[17px]">
                {featuredCourse?.description ?? 'Tìm khóa học phù hợp, đăng ký học và tiếp tục lộ trình của bạn trên một giao diện trực quan hơn.'}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                {featuredCourse ? (
                  <button
                    className="inline-flex items-center gap-2 rounded-lg bg-[#adc7ff] px-6 py-3 font-mono text-[13px] font-bold text-[#002e68] transition hover:shadow-[0_0_24px_rgba(173,199,255,0.35)] active:scale-95"
                    type="button"
                    onClick={() => handleCourseAction(featuredCourse)}
                  >
                    {canStudy(user) ? getStudentAction(featuredCourse).label : 'Xem khóa học'}
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                ) : null}
                <div className="flex items-center gap-2 text-[#8b90a0]">
                  <span className="material-symbols-outlined text-[18px]">school</span>
                  <span className="font-mono text-[12px]">{courses.length} khóa học hiện có</span>
                </div>
                {featuredCourse && (
                  <div className="flex items-center gap-2 text-[#24dfba]">
                    <span className="material-symbols-outlined text-[18px]">group</span>
                    <span className="font-mono text-[12px]">{featuredCourse.enrollment_count ?? 0} người học</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          <AppToast message={message} tone={message.startsWith('Đang ') ? 'loading' : 'warning'} onClose={() => setMessage('')} />

          {isLoading && (
            <div className="rounded-lg border border-white/5 bg-[#161c28] px-4 py-3 font-mono text-[12px] text-[#ffc080]">
              Đang tải khóa học...
            </div>
          )}

          <section className="relative">
            <div className="relative min-w-0">
              <div className="mb-6 space-y-4">
                <div className="flex flex-col gap-4 rounded-2xl border border-[#253047] bg-[#111827]/80 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="mb-1 font-mono text-[12px] uppercase text-[#8b90a0]">{getRoleLabel(user?.role)}</p>
                    <h2 className="text-[28px] font-semibold text-[#dde2f4]">Khóa học hiện có</h2>
                    {user?.role === 'tutor' && <p className="mt-1 text-[13px] text-[#8f9bb3]">Quản lý khóa hiện tại hoặc bắt đầu xây dựng một khóa học mới.</p>}
                  </div>
                  {user?.role === 'tutor' && (
                    <button
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#24dfba] px-6 py-3 font-mono text-[13px] font-black uppercase tracking-wide text-[#00382c] shadow-lg shadow-[#24dfba]/20 transition hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[#24dfba]/30 active:scale-95"
                      type="button"
                      onClick={() => setIsCreateCourseOpen(true)}
                    >
                      <span className="material-symbols-outlined text-[21px]">add_circle</span>
                      Tạo khóa học
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 font-mono text-[12px] font-bold transition active:scale-95 ${
                      isFilterOpen
                        ? 'border-[#ffc080]/50 bg-[#ffc080]/10 text-[#ffc080]'
                        : 'border-[#adc7ff]/50 bg-[#161c28] text-[#adc7ff] hover:bg-[#adc7ff]/10'
                    }`}
                    type="button"
                    aria-expanded={isFilterOpen}
                    onClick={() => setIsFilterOpen((current) => !current)}
                  >
                    <span className="material-symbols-outlined text-[18px]">filter_list</span>
                    Bộ lọc
                  </button>
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-[#161c28] p-1.5">
                    <span className="px-2 font-mono text-[12px] text-[#8b90a0]">Sắp xếp:</span>
                    {sortOptions.map((item) => {
                      const isSelected = sortMode === item.value;

                      return (
                        <button
                          key={item.value}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-bold transition active:scale-95 ${
                            isSelected
                              ? 'bg-[#adc7ff] text-[#002e68] shadow-lg shadow-[#adc7ff]/10'
                              : 'text-[#c1c6d7] hover:bg-[#242a37] hover:text-[#dde2f4]'
                          }`}
                          type="button"
                          onClick={() => setSortMode(item.value)}
                        >
                          <span className="material-symbols-outlined text-[16px]">{isSelected ? 'check_circle' : item.icon}</span>
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {isFilterOpen && (
                <div className="mb-6 rounded-xl border border-white/10 bg-[#161c28] p-4 shadow-xl shadow-black/20">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <h2 className="text-[18px] font-semibold text-[#dde2f4]">Bộ lọc</h2>
                    <button className="icon-button h-8 w-8" type="button" aria-label="Đóng bộ lọc" onClick={() => setIsFilterOpen(false)}>
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <label className="block space-y-1.5">
                      <span className="font-mono text-[11px] uppercase tracking-wide text-[#8b90a0]">Tìm kiếm</span>
                      <input className="h-9 w-full rounded-full border border-[#414754] bg-[#080e1a] px-4 text-[13px] text-[#dde2f4] outline-none placeholder:text-[#8b90a0] focus:border-[#adc7ff]" placeholder="Tìm khóa học..." value={query} onChange={(event) => setQuery(event.target.value)} />
                    </label>

                    <div>
                      <p className="mb-2.5 font-mono text-[11px] uppercase tracking-wide text-[#8b90a0]">Kiểu đăng ký</p>
                      <div className="space-y-2.5">
                        {[
                          { value: 'all', label: 'Tất cả' },
                          { value: 'open', label: 'Đăng ký mở' },
                          { value: 'approval_required', label: 'Cần duyệt' },
                        ].map((item) => (
                          <label key={item.value} className="flex cursor-pointer items-center gap-2.5 text-[14px] font-medium text-[#c1c6d7] transition hover:text-[#dde2f4]">
                            <input className="h-3.5 w-3.5 rounded border-[#414754] bg-[#0d131f] text-[#adc7ff]" type="radio" name="enrollment_filter" checked={enrollmentFilter === item.value} onChange={() => setEnrollmentFilter(item.value as EnrollmentFilter)} />
                            {item.label}
                          </label>
                        ))}
                      </div>
                    </div>

                    {canStudy(user) && (
                      <div>
                        <p className="mb-2.5 font-mono text-[11px] uppercase tracking-wide text-[#8b90a0]">Trạng thái học</p>
                        <div className="space-y-2.5">
                          {[
                            { value: 'all', label: 'Tất cả' },
                            { value: 'not_enrolled', label: 'Chưa đăng ký' },
                            { value: 'active', label: 'Đang học' },
                            { value: 'pending', label: 'Chờ duyệt' },
                          ].map((item) => (
                            <label key={item.value} className="flex cursor-pointer items-center gap-2.5 text-[14px] font-medium text-[#c1c6d7] transition hover:text-[#dde2f4]">
                              <input className="h-3.5 w-3.5 rounded border-[#414754] bg-[#0d131f] text-[#adc7ff]" type="radio" name="student_status_filter" checked={studentStatusFilter === item.value} onChange={() => setStudentStatusFilter(item.value as StudentStatusFilter)} />
                              {item.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="mb-2.5 font-mono text-[11px] uppercase tracking-wide text-[#8b90a0]">Tổng quan</p>
                      <div className="space-y-1.5 rounded-lg bg-[#080e1a] p-3 text-[13px] text-[#c1c6d7]">
                        <div className="flex justify-between"><span>Tổng khóa</span><span className="text-[#dde2f4]">{courses.length}</span></div>
                        {canStudy(user) && <div className="flex justify-between"><span>Đang học</span><span className="text-[#24dfba]">{activeCourseCount}</span></div>}
                      </div>
                    </div>
                    <button
                      className="self-end rounded-lg border border-[#adc7ff] px-3 py-2.5 font-mono text-[12px] font-bold text-[#adc7ff] transition hover:bg-[#adc7ff]/10 active:scale-95"
                      type="button"
                      onClick={() => {
                        setQuery('');
                        setEnrollmentFilter('all');
                        setStudentStatusFilter('all');
                        setSortMode('popular');
                        setIsFilterOpen(false);
                      }}
                    >
                      Xóa tất cả bộ lọc
                    </button>
                  </div>
                </div>
              )}

              {!isLoading && !filteredCourses.length && (
                <div className="rounded-xl border border-dashed border-[#414754] bg-[#161c28] p-10 text-center">
                  <span className="material-symbols-outlined mb-3 text-[44px] text-[#8b90a0]">school</span>
                  <h3 className="text-[22px] font-semibold text-[#dde2f4]">Không tìm thấy khóa học</h3>
                  <p className="mt-2 text-[#8b90a0]">Thử đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredCourses.map((course, index) => {
                  const creator = typeof course.created_by === 'object' ? course.created_by.full_name : 'Chưa rõ';
                  const enrollmentType = course.enrollment_type === 'approval_required' ? 'Cần duyệt' : 'Mở';
                  const canManageCourse = isCourseOwner(user, course);
                  const canModerate = canModerateCourse(user, course);
                  const enrollmentStatus = enrollmentStatusByCourseId[course._id];
                  const isActiveEnrollment = enrollmentStatus === 'active';
                  const isPendingEnrollment = enrollmentStatus === 'pending';
				  const courseDetailUrl = getCourseHref(course._id);
                  const studentAction = getStudentAction(course);
                  const badgeTone = index % 3 === 0 ? 'text-[#ffc080]' : index % 3 === 1 ? 'text-[#24dfba]' : 'text-[#adc7ff]';
                  const progress = progressByCourseId[course._id];
                  const progressPercent = progress?.progress_percent ?? 0;
                  const isCompleted = isActiveEnrollment && progressPercent >= 100;

                  return (
                    <article
                      key={course._id}
                      className="group relative flex min-h-[430px] h-full flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#101827] shadow-xl shadow-black/25 transition-all duration-300 hover:-translate-y-1 hover:border-[#adc7ff]/45 hover:shadow-[0_20px_50px_-24px_rgba(143,183,255,0.55)]"
                    >
                      <div className="absolute inset-0 overflow-hidden bg-[#0b1321]">
                        {thumbnailUrls[course._id] ? (
                          <>
                            <img
                              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-55 blur-2xl transition duration-700 group-hover:scale-125"
                              src={thumbnailUrls[course._id]}
                              alt=""
                              aria-hidden="true"
                            />
                            <img
                              className="absolute inset-0 h-full w-full object-contain object-top opacity-85 transition duration-700 group-hover:scale-[1.02]"
                              src={thumbnailUrls[course._id]}
                              alt={`Thumbnail ${course.title}`}
                            />
                          </>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_25%_15%,rgba(173,199,255,0.32),transparent_36%),linear-gradient(145deg,#101a2b,#202d43)]">
                            <span className="material-symbols-outlined text-[72px] text-[#adc7ff]/25">school</span>
                          </div>
                        )}
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#050a13]/10 via-[#07101c]/55 to-[#050911]/[0.98]" />
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(4,9,17,0.5),transparent_55%)]" />

                        <span className={`absolute left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#07101a]/80 px-3 py-1.5 font-mono text-[11px] font-bold shadow-lg shadow-black/20 backdrop-blur-md ${badgeTone}`}>
                          <span className="material-symbols-outlined text-[14px]">{course.enrollment_type === 'approval_required' ? 'verified_user' : 'bolt'}</span>
                          {enrollmentType}
                        </span>

                        {(canManageCourse || canModerate) && (
                          <label className="absolute right-4 top-4 z-20 flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-[#07101a]/80 px-3 py-1.5 font-mono text-[11px] font-bold text-[#dbe7ff] opacity-0 shadow-lg shadow-black/20 backdrop-blur-md transition hover:border-[#adc7ff]/50 hover:bg-[#13223a]/90 group-hover:opacity-100 group-focus-within:opacity-100">
                            <span className="material-symbols-outlined text-[15px]">upload</span>
                            Đổi ảnh
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={async (event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                  try {
                                    setMessage('Đang upload thumbnail...');
                                    await uploadCourseThumbnail(course._id, file);
                                    await loadCourses();
                                    setMessage('Cập nhật thumbnail thành công!');
                                  } catch (err) {
                                    setMessage(err instanceof Error ? err.message : 'Không thể cập nhật thumbnail');
                                  }
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>

                      <div className="relative z-10 mt-auto flex flex-1 flex-col justify-end p-5 pt-16">
						<a className="block" href={courseDetailUrl}>
                          <h3 className="mb-2 text-[24px] font-bold leading-8 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] transition-colors group-hover:text-[#dce8ff]">{course.title}</h3>
                          <p className="mb-5 line-clamp-3 text-[14px] leading-6 text-white/85 drop-shadow-[0_1px_5px_rgba(0,0,0,0.95)]">
                            {course.description || 'Chưa có mô tả cho khóa học này.'}
                          </p>
                        </a>

                        <div className="space-y-4 border-t border-white/15 pt-4">
                        {isActiveEnrollment && canStudy(user) && (
                          <div>
                            <div className={`mb-1.5 flex justify-between font-mono text-[11px] font-bold ${isCompleted ? 'text-[#54f5cf]' : 'text-[#ffd29a]'}`}>
                              <span>Trạng thái học</span>
                              <span>{isCompleted ? 'Hoàn thành' : 'Đang học'}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-white/20 backdrop-blur">
                              <div className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-[#24dfba]' : 'bg-[#ffc080]'}`} style={{ width: `${progressPercent}%` }} />
                            </div>
                            <p className="mt-1 font-mono text-[11px] text-white/60">
                              {progress ? `${progress.completed_lessons}/${progress.total_lessons} bài · ${progressPercent}% hoàn thành` : 'Đang cập nhật tiến độ...'}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 space-y-1 font-mono text-[11px] text-white/65">
                            <p className="truncate">Người tạo: {creator}</p>
                            <p className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[16px]">timer</span>
                              Nội dung tự học
                            </p>
                          </div>
                          <button
                            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2.5 font-mono text-[12px] font-bold shadow-lg shadow-black/20 transition-all active:scale-95 ${
                              isPendingEnrollment
                                ? 'cursor-not-allowed border border-[#ffd29a]/45 bg-[#07101a]/70 text-[#ffd29a] opacity-85 backdrop-blur-md'
                                : studentAction.tone === 'active'
                                  ? 'bg-[#c5d9ff] text-[#002b62] hover:shadow-[0_0_24px_rgba(197,217,255,0.45)] hover:brightness-110'
                                  : 'border border-[#c5d9ff]/70 bg-[#07101a]/60 text-[#e3ecff] backdrop-blur-md hover:bg-[#c5d9ff]/20'
                            }`}
                            type="button"
                            disabled={isPendingEnrollment}
                            onClick={() => handleCourseAction(course)}
                          >
                            {canStudy(user) && studentAction.tone === 'active' && (
                              <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                            )}
                            {canStudy(user)
                              ? studentAction.label
                              : canManageCourse
                                ? 'Quản lý'
                                : canModerate
                                  ? 'Kiểm duyệt'
                                  : 'Xem thêm'}
                          </button>
                        </div>
                      </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </main>

      <SphereAIButton />
    </div>
  );
}
