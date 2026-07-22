import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppHeader } from '../components/AppHeader';
import { AppToast } from '../components/AppToast';
import { SphereAIButton } from '../components/SphereAIButton';
import { RoleSidebar } from '../components/RoleSidebar';
import { canManageContent, canModerateCourse, canStudy, getRoleLabel, getRoleNav, isCourseOwner } from '../lib/roleAccess';
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
  return `/lesson-detail?course_id=${encodeURIComponent(courseId)}`;
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
    if (!canManageContent(user)) return;
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
      await loadCourses();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể tạo khóa học');
    } finally {
      setIsCreating(false);
    }
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
    const lessonDetailUrl = getCourseHref(course._id);
    const status = enrollmentStatusByCourseId[course._id];

    if (canStudy(user)) {
      if (status === 'active') {
        window.location.assign(lessonDetailUrl);
      } else if (status !== 'pending') {
        void handleEnroll(course._id);
      }
      return;
    }

    if (isCourseOwner(user, course) || canModerateCourse(user, course)) {
      window.location.assign(`/lesson-management?course_id=${encodeURIComponent(course._id)}`);
      return;
    }

    window.location.assign(lessonDetailUrl);
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

          {canManageContent(user) && (
            <form className="grid gap-4 rounded-xl border border-white/5 bg-[#161c28] p-5 md:grid-cols-[1fr_1fr_180px_auto_auto]" onSubmit={handleCreateCourse}>
              <input className="rounded-lg border border-[#414754] bg-[#0d131f] px-4 py-3 text-[#dde2f4] outline-none placeholder:text-[#8b90a0] focus:border-[#adc7ff]" placeholder="Tên khóa học" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
              <input className="rounded-lg border border-[#414754] bg-[#0d131f] px-4 py-3 text-[#dde2f4] outline-none placeholder:text-[#8b90a0] focus:border-[#adc7ff]" placeholder="Mô tả ngắn" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
              <select className="rounded-lg border border-[#414754] bg-[#0d131f] px-4 py-3 text-[#dde2f4] outline-none focus:border-[#adc7ff]" value={form.enrollment_type} onChange={(event) => setForm((current) => ({ ...current, enrollment_type: event.target.value as EnrollmentType }))}>
                <option value="open">Đăng ký mở</option>
                <option value="approval_required">Cần duyệt</option>
              </select>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#414754] bg-[#0d131f] px-4 py-3 font-mono text-[13px] text-[#adc7ff] transition hover:bg-[#242a37]">
                <span className="material-symbols-outlined text-[18px]">image</span>
                <span className="max-w-[120px] truncate">{thumbnailFile ? thumbnailFile.name : 'Ảnh thumbnail'}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => setThumbnailFile(event.target.files?.[0] ?? null)} />
              </label>
              <button className="rounded-lg bg-[#adc7ff] px-5 py-3 font-mono text-[13px] font-bold text-[#002e68] transition hover:brightness-110 disabled:opacity-60" type="submit" disabled={isCreating}>
                {isCreating ? 'Đang tạo...' : 'Tạo khóa học'}
              </button>
            </form>
          )}

          <AppToast message={message} tone={message.startsWith('Đang ') ? 'loading' : 'warning'} onClose={() => setMessage('')} />

          {isLoading && (
            <div className="rounded-lg border border-white/5 bg-[#161c28] px-4 py-3 font-mono text-[12px] text-[#ffc080]">
              Đang tải khóa học...
            </div>
          )}

          <section className="relative">
            <div className="relative min-w-0">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="mb-1 font-mono text-[12px] uppercase text-[#8b90a0]">{getRoleLabel(user?.role)}</p>
                  <h2 className="text-[28px] font-semibold text-[#dde2f4]">Khóa học hiện có</h2>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
                  const lessonDetailUrl = getCourseHref(course._id);
                  const studentAction = getStudentAction(course);
                  const canOpenDetail = isActiveEnrollment || !canStudy(user);
                  const badgeTone = index % 3 === 0 ? 'text-[#ffc080]' : index % 3 === 1 ? 'text-[#24dfba]' : 'text-[#adc7ff]';
                  const progress = progressByCourseId[course._id];
                  const progressPercent = progress?.progress_percent ?? 0;
                  const isCompleted = isActiveEnrollment && progressPercent >= 100;

                  return (
                    <article key={course._id} className="group flex h-full flex-col rounded-xl border border-white/5 bg-[#1a202c] p-4 transition-all hover:border-[#adc7ff]/30">
                      <div className="relative mb-4 aspect-video overflow-hidden rounded-lg bg-[#242a37]">
                        <a className="block h-full w-full" href={canOpenDetail ? lessonDetailUrl : '#'} onClick={(event) => { if (!canOpenDetail) event.preventDefault(); }}>
                          {thumbnailUrls[course._id] ? (
                            <div className="h-full w-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105" style={{ backgroundImage: `url(${thumbnailUrls[course._id]})` }} />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(173,199,255,0.24),transparent_34%),linear-gradient(135deg,#080e1a,#242a37)] text-[#8b90a0]">
                              <span className="material-symbols-outlined text-[48px] text-[#adc7ff]/70">school</span>
                            </div>
                          )}
                        </a>
                        <span className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-[#0d131f]/90 px-2 py-1 font-mono text-[11px] font-bold backdrop-blur ${badgeTone}`}>
                          <span className="material-symbols-outlined text-[14px]">{course.enrollment_type === 'approval_required' ? 'verified_user' : 'bolt'}</span>
                          {enrollmentType}
                        </span>

                        {(canManageCourse || canModerate) && (
                          <label className="absolute right-2 top-2 flex cursor-pointer items-center gap-1.5 rounded-md bg-[#0d131f]/80 px-2.5 py-1 font-mono text-[11px] text-[#adc7ff] opacity-0 backdrop-blur transition hover:bg-[#0d131f] group-hover:opacity-100">
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

                      <a className="block" href={canOpenDetail ? lessonDetailUrl : '#'} onClick={(event) => { if (!canOpenDetail) event.preventDefault(); }}>
                        <h3 className="mb-2 text-[22px] font-semibold leading-7 text-[#dde2f4] transition-colors group-hover:text-[#adc7ff]">{course.title}</h3>
                        <p className="mb-4 line-clamp-2 flex-grow text-[14px] leading-6 text-[#c1c6d7]">
                          {course.description || 'Chưa có mô tả cho khóa học này.'}
                        </p>
                      </a>

                      <div className="mt-auto space-y-4">
                        {isActiveEnrollment && canStudy(user) && (
                          <div>
                            <div className={`mb-1.5 flex justify-between font-mono text-[11px] ${isCompleted ? 'text-[#24dfba]' : 'text-[#ffc080]'}`}>
                              <span>Trạng thái học</span>
                              <span>{isCompleted ? 'Hoàn thành' : 'Đang học'}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-[#2f3542]">
                              <div className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-[#24dfba]' : 'bg-[#ffc080]'}`} style={{ width: `${progressPercent}%` }} />
                            </div>
                            <p className="mt-1 font-mono text-[11px] text-[#8b90a0]">
                              {progress ? `${progress.completed_lessons}/${progress.total_lessons} bài · ${progressPercent}% hoàn thành` : 'Đang cập nhật tiến độ...'}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 space-y-1 font-mono text-[11px] text-[#8b90a0]">
                            <p className="truncate">Người tạo: {creator}</p>
                            <p className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[16px]">timer</span>
                              Nội dung tự học
                            </p>
                          </div>
                          <button
                            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2.5 font-mono text-[12px] font-bold shadow-lg shadow-black/20 transition-all active:scale-95 ${
                              isPendingEnrollment
                                ? 'cursor-not-allowed border border-[#ffc080]/40 bg-[#ffc080]/10 text-[#ffc080] opacity-85'
                                : studentAction.tone === 'active'
                                  ? 'bg-[#adc7ff] text-[#002e68] hover:shadow-[0_0_22px_rgba(173,199,255,0.35)] hover:brightness-110'
                                  : 'border border-[#adc7ff] bg-[#adc7ff]/5 text-[#adc7ff] hover:bg-[#adc7ff]/15'
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
