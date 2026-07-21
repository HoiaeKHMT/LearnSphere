import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppHeader } from '../components/AppHeader';
import { SphereAIButton } from '../components/SphereAIButton';
import { RoleSidebar } from '../components/RoleSidebar';
import { canManageContent, canModerateCourse, canStudy, getRoleLabel, getRoleNav, isCourseOwner } from '../lib/roleAccess';
import { api, getStoredUser, type Course, type EnrollmentType } from '../services/api';

const avatarSrc =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAK3DeXFfcU7eoLcYm0J-P0geFc_1SNB3sOpbZdSgXNGYGNkWLvpydHgoO3teNd6SCKCfYzJzNrs1AB7P8Pu74X-3istluRsHM1oPvbEs2nLPM2cHWOxHmwakxXKAZY99rZGG-p9kypULkAvH9bkTxwS1EgNluYqYhNlGpql2gZkqIWaOYk5FWOQvYjhFI2VJivahYgEOwamgFB5MZtSI9a-fovv-ztHAlZ1TjPwNnEgpB773mBUptA6A';

type CourseForm = {
  title: string;
  description: string;
  enrollment_type: EnrollmentType;
};

export function CourseCatalogPage() {
  const user = getStoredUser();
  const navItems = useMemo(() => getRoleNav(user), [user]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<CourseForm>({
    title: '',
    description: '',
    enrollment_type: 'open',
  });

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  async function loadCourses() {
    setIsLoading(true);
    setMessage('');

    try {
      const items = await api.getCourses();
      setCourses(items);

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
      setMessage(err instanceof Error ? err.message : 'Không thể tải khóa học');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadCourses();
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
          setMessage('Tạo khóa học thành công nhưng không thể tải lên thumbnail.');
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
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể đăng ký khóa học');
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0d131f] text-[#dde2f4] selection:bg-[#4a8eff] selection:text-[#00285b]">
      <AppHeader user={user} roleLabel={getRoleLabel(user?.role)} avatarSrc={avatarSrc} />
      <RoleSidebar activePath="/courses" items={navItems} user={user} />

      <main className="mx-auto w-full max-w-7xl flex-grow space-y-8 px-4 py-8 md:pl-72 md:pr-8">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 font-mono text-[12px] uppercase tracking-wider text-[#8b90a0]">{getRoleLabel(user?.role)}</p>
            <h1 className="text-[32px] font-semibold text-[#dde2f4]">Khóa học</h1>
          </div>
          <span className="rounded-lg border border-white/5 bg-[#161c28] px-4 py-2 font-mono text-[12px] text-[#8b90a0]">
            {courses.length} khóa học
          </span>
        </section>

        {canManageContent(user) && (
          <form className="grid gap-4 rounded-xl border border-white/5 bg-[#161c28] p-5 md:grid-cols-[1fr_1fr_180px_auto_auto]" onSubmit={handleCreateCourse}>
            <input
              className="rounded-lg border border-[#414754] bg-[#0d131f] px-4 py-3 text-[#dde2f4] placeholder:text-[#8b90a0]"
              placeholder="Tên khóa học"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            />
            <input
              className="rounded-lg border border-[#414754] bg-[#0d131f] px-4 py-3 text-[#dde2f4] placeholder:text-[#8b90a0]"
              placeholder="Mô tả ngắn"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
            <select
              className="rounded-lg border border-[#414754] bg-[#0d131f] px-4 py-3 text-[#dde2f4]"
              value={form.enrollment_type}
              onChange={(event) => setForm((current) => ({ ...current, enrollment_type: event.target.value as EnrollmentType }))}
            >
              <option value="open">Đăng ký mở</option>
              <option value="approval_required">Cần duyệt</option>
            </select>

            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#414754] bg-[#0d131f] px-4 py-3 text-[13px] font-mono text-[#adc7ff] hover:bg-[#242a37]">
              <span className="material-symbols-outlined text-[18px]">image</span>
              <span className="truncate max-w-[100px]">{thumbnailFile ? thumbnailFile.name : 'Ảnh thumbnail'}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <button className="rounded-lg bg-[#adc7ff] px-5 py-3 font-mono text-[13px] font-bold text-[#00285b] disabled:opacity-60" type="submit" disabled={isCreating}>
              {isCreating ? 'Đang tạo...' : 'Tạo khóa học'}
            </button>
          </form>
        )}

        {(isLoading || message) && (
          <div className="rounded-lg border border-white/5 bg-[#161c28] px-4 py-3 font-mono text-[12px] text-[#ffc080]">
            {isLoading ? 'Đang tải khóa học...' : message}
          </div>
        )}

        {!isLoading && !courses.length && (
          <div className="rounded-xl border border-dashed border-[#414754] bg-[#161c28] p-10 text-center">
            <span className="material-symbols-outlined mb-3 text-[44px] text-[#8b90a0]">school</span>
            <h2 className="text-[22px] font-semibold text-[#dde2f4]">Chưa có khóa học nào</h2>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => {
            const creator = typeof course.created_by === 'object' ? course.created_by.full_name : 'Chưa rõ';
            const enrollmentType = course.enrollment_type === 'approval_required' ? 'Cần duyệt' : 'Mở';
            const canManageCourse = isCourseOwner(user, course);
            const canModerate = canModerateCourse(user, course);

            return (
              <article key={course._id} className="flex h-full flex-col rounded-xl border border-white/5 bg-[#1a202c] p-4">
                <div className="relative mb-4 aspect-video overflow-hidden rounded-lg border border-[#414754] bg-[#242a37]">
                  <a className="block h-full w-full" href={`/lesson-detail?course_id=${encodeURIComponent(course._id)}`}>
                    {thumbnailUrls[course._id] ? (
                      <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${thumbnailUrls[course._id]})` }} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[#8b90a0]">
                        <span className="material-symbols-outlined text-[48px]">school</span>
                      </div>
                    )}
                  </a>

                  {(canManageCourse || canModerate) && (
                    <label className="absolute top-2 right-2 flex cursor-pointer items-center gap-1.5 rounded-md bg-[#0d131f]/80 px-2.5 py-1 text-[11px] font-mono text-[#adc7ff] backdrop-blur hover:bg-[#0d131f] transition">
                      <span className="material-symbols-outlined text-[15px]">upload</span>
                      Đổi Thumbnail
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              setMessage('Đang upload thumbnail...');
                              await uploadCourseThumbnail(course._id, file);
                              await loadCourses();
                              setMessage('Cập nhật Thumbnail thành công!');
                            } catch (err) {
                              setMessage(err instanceof Error ? err.message : 'Không thể cập nhật thumbnail');
                            }
                          }
                        }}
                      />
                    </label>
                  )}
                </div>

                <a className="block" href={`/lesson-detail?course_id=${encodeURIComponent(course._id)}`}>
                  <h2 className="mb-2 text-[22px] font-semibold leading-7 text-[#dde2f4]">{course.title}</h2>
                  <p className="mb-4 line-clamp-3 flex-grow text-[15px] leading-6 text-[#c1c6d7]">
                    {course.description || 'Chưa có mô tả cho khóa học này.'}
                  </p>
                </a>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1 font-mono text-[12px] text-[#8b90a0]">
                    <p>Người tạo: {creator}</p>
                    <p>Đăng ký: {enrollmentType}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canStudy(user) && (
                      <a
                        className="rounded-lg border border-[#24dfba]/50 px-3 py-2 font-mono text-[13px] font-bold text-[#24dfba] transition-colors hover:bg-[#24dfba]/10"
                        href={`/quiz?course_id=${encodeURIComponent(course._id)}`}
                      >
                        Làm Quiz
                      </a>
                    )}
                    <button
                      className="rounded-lg border border-[#adc7ff] px-4 py-2 font-mono text-[13px] font-bold text-[#adc7ff] transition-colors hover:bg-[#adc7ff]/10"
                      type="button"
                      onClick={() => {
                        if (canStudy(user)) {
                          void handleEnroll(course._id);
                        } else if (canManageCourse || canModerate) {
                          window.location.assign(`/lesson-management?course_id=${encodeURIComponent(course._id)}`);
                        } else {
                          window.location.assign(`/lesson-detail?course_id=${encodeURIComponent(course._id)}`);
                        }
                      }}
                    >
                      {canStudy(user) ? 'Đăng ký' : canManageCourse ? 'Quản lý nội dung' : canModerate ? 'Kiểm duyệt' : 'Xem chi tiết'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>

      <SphereAIButton />
    </div>
  );
}
