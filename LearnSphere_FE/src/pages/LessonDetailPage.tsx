import { useEffect, useState } from 'react';
import { AppHeader } from '../components/AppHeader';
import { RoleSidebar } from '../components/RoleSidebar';
import { SphereAIButton } from '../components/SphereAIButton';
import { api, getStoredUser, type CourseProgress, type Lesson } from '../services/api';

const avatarSrc =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBoBuRJI1yShmJcMfHY1XLGNg58oqoS5MyV6HQICcczCWG7fu-lzanV_5ir_WBXQB19zta9onD5oKMvRyXiRpCjARwoUGMeyA0WX3cZa4UuBn_ZNEIt7g-llR2NmJcFr5na00oENmk4NouYphWdHgtSlu0awtCw8ILcImQS45sYgmsPBdDBehw';

function getRoleLabel(role?: string) {
  if (role === 'admin') return 'Quản trị viên';
  if (role === 'tutor') return 'Giảng viên';
  if (role === 'student') return 'Học viên';
  return 'Khách';
}

export function LessonDetailPage() {
  const params = new URLSearchParams(window.location.search);
  const courseId = params.get('course_id');
  const lessonId = params.get('lesson_id');
  const user = getStoredUser();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(courseId || lessonId));
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (lessonId) {
      setIsLoading(true);
      api.getLesson(lessonId)
        .then(setLesson)
        .catch((err) => setMessage(err instanceof Error ? err.message : 'Không thể tải bài học'))
        .finally(() => setIsLoading(false));
      return;
    }

    if (!courseId) return;

    setIsLoading(true);
    api.getLessons(courseId)
      .then((items) => {
        setLessons(items);
        setLesson(items[0] ?? null);
      })
      .catch((err) => setMessage(err instanceof Error ? err.message : 'Không thể tải danh sách bài học'))
      .finally(() => setIsLoading(false));
  }, [courseId, lessonId]);

  useEffect(() => {
    if (!courseId || user?.role !== 'student') return;

    api.getCourseProgress(courseId)
      .then(setProgress)
      .catch(() => setProgress(null));
  }, [courseId, user?.role]);

  async function handleCompleteLesson() {
    if (!lesson?._id) return;

    try {
      const result = await api.completeLesson(lesson._id);
      setMessage(result.message);
      if (courseId) {
        setProgress(await api.getCourseProgress(courseId));
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể cập nhật tiến độ');
    }
  }

  return (
    <div className="min-h-screen bg-[#0d131f] text-[#dde2f4] selection:bg-[#adc7ff]/30">
      <AppHeader user={user} roleLabel={getRoleLabel(user?.role)} avatarSrc={avatarSrc} />

      <RoleSidebar activePath="/courses" user={user} />

      <main className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 gap-6 px-4 pb-16 pt-8 md:pl-72 md:pr-8 lg:grid-cols-12">
        <aside className="space-y-4 lg:col-span-4">
          <section className="rounded-xl border border-white/5 bg-[#161c28] p-6">
            <h1 className="mb-2 text-[24px] font-semibold text-[#dde2f4]">Bài học</h1>
          </section>

          <section className="rounded-xl border border-white/5 bg-[#161c28] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-mono text-[13px] uppercase tracking-wider text-[#8b90a0]">Danh sách bài học</h2>
              <span className="font-mono text-[12px] text-[#adc7ff]">{lessons.length}</span>
            </div>
            {isLoading && <p className="font-mono text-[12px] text-[#8b90a0]">Đang tải bài học...</p>}
            {!isLoading && !lessons.length && !lesson && (
              <p className="rounded-lg border border-dashed border-[#414754] p-4 text-[14px] text-[#c1c6d7]">
                Chưa có bài học nào hoặc bạn chưa truyền `course_id`/`lesson_id`.
              </p>
            )}
            <div className="space-y-2">
              {lessons.map((item) => (
                <a
                  key={item._id}
                  className={`block rounded-lg border px-4 py-3 transition-colors ${
                    lesson?._id === item._id
                      ? 'border-[#adc7ff]/40 bg-[#adc7ff]/10 text-[#adc7ff]'
                      : 'border-[#414754] text-[#c1c6d7] hover:bg-[#2f3542]'
                  }`}
                  href={`/lesson-detail?course_id=${encodeURIComponent(item.course_id)}&lesson_id=${encodeURIComponent(item._id)}`}
                >
                  <span className="font-mono text-[12px] text-[#8b90a0]">#{item.order_index}</span>
                  <span className="ml-2 text-[14px]">{item.title}</span>
                </a>
              ))}
            </div>
          </section>

          {progress && (
            <section className="rounded-xl border border-white/5 bg-[#161c28] p-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-mono text-[13px] uppercase tracking-wider text-[#8b90a0]">Tiến độ khóa học</h2>
                <span className="text-[24px] font-bold text-[#24dfba]">{progress.progress_percent}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-[#2f3542]">
                <div className="h-full rounded-full bg-[#24dfba]" style={{ width: `${progress.progress_percent}%` }} />
              </div>
              <p className="mt-3 font-mono text-[12px] text-[#c1c6d7]">
                Đã hoàn thành {progress.completed_lessons}/{progress.total_lessons} bài học.
              </p>
            </section>
          )}
        </aside>

        <section className="space-y-6 lg:col-span-8">
          {message && (
            <div className="rounded-lg border border-[#ffc080]/30 bg-[#ffc080]/10 px-4 py-3 text-[14px] text-[#ffc080]">
              {message}
            </div>
          )}

          {!lesson && !isLoading && (
            <div className="rounded-xl border border-dashed border-[#414754] bg-[#161c28] p-10 text-center">
              <span className="material-symbols-outlined mb-3 text-[44px] text-[#8b90a0]">auto_stories</span>
              <h2 className="text-[22px] font-semibold text-[#dde2f4]">Chưa có dữ liệu bài học</h2>
            </div>
          )}

          {lesson && (
            <article className="rounded-xl border border-white/5 bg-[#161c28] p-6 md:p-8">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="mb-2 font-mono text-[12px] uppercase tracking-wider text-[#8b90a0]">Bài học #{lesson.order_index}</p>
                  <h1 className="text-[30px] font-semibold leading-10 text-[#dde2f4]">{lesson.title}</h1>
                </div>
                {user?.role === 'student' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-lg bg-[#adc7ff] px-5 py-3 font-bold text-[#002e68] transition-colors hover:brightness-110"
                      type="button"
                      onClick={handleCompleteLesson}
                    >
                      Hoàn thành bài học
                    </button>
                    {courseId && (
                      <a
                        className="flex items-center gap-2 rounded-lg border border-[#24dfba]/40 bg-[#24dfba]/10 px-5 py-3 font-bold text-[#24dfba] transition-colors hover:bg-[#24dfba]/20"
                        href={`/quiz?course_id=${encodeURIComponent(courseId)}`}
                      >
                        <span className="material-symbols-outlined text-[20px]">quiz</span>
                        Làm Bài Kiểm Tra (Quiz)
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <section>
                  <h2 className="mb-3 text-[20px] font-semibold text-[#adc7ff]">Nội dung</h2>
                  {lesson.content ? (
                    <p className="whitespace-pre-wrap text-[16px] leading-7 text-[#c1c6d7]">{lesson.content}</p>
                  ) : (
                    <p className="rounded-lg border border-dashed border-[#414754] p-4 text-[#c1c6d7]">Bài học này chưa có nội dung.</p>
                  )}
                </section>

                <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="flex flex-col justify-between gap-3 rounded-lg border border-[#414754] p-4">
                    <div>
                      <p className="mb-1 font-mono text-[12px] uppercase tracking-wider text-[#8b90a0]">Video Bài học (S3)</p>
                      <p className="break-all font-mono text-[13px] text-[#c1c6d7]">{lesson.video_key || 'Chưa có video'}</p>
                    </div>
                    {lesson.video_key && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await api.createPresignedDownload(lesson._id, 'video');
                            window.open(res.download_url, '_blank');
                          } catch (err) {
                            setMessage(err instanceof Error ? err.message : 'Không thể lấy liên kết tải video');
                          }
                        }}
                        className="flex w-fit items-center gap-2 rounded-lg border border-[#adc7ff]/40 bg-[#adc7ff]/10 px-4 py-2 font-mono text-[12px] font-bold text-[#adc7ff] hover:bg-[#adc7ff]/20"
                      >
                        <span className="material-symbols-outlined text-[16px]">play_circle</span>
                        Xem / Tải Video
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col justify-between gap-3 rounded-lg border border-[#414754] p-4">
                    <div>
                      <p className="mb-1 font-mono text-[12px] uppercase tracking-wider text-[#8b90a0]">Tài liệu Bài học (S3)</p>
                      <p className="break-all font-mono text-[13px] text-[#c1c6d7]">{lesson.document_key || 'Chưa có tài liệu'}</p>
                    </div>
                    {lesson.document_key && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await api.createPresignedDownload(lesson._id, 'document');
                            window.open(res.download_url, '_blank');
                          } catch (err) {
                            setMessage(err instanceof Error ? err.message : 'Không thể lấy liên kết tải tài liệu');
                          }
                        }}
                        className="flex w-fit items-center gap-2 rounded-lg border border-[#adc7ff]/40 bg-[#adc7ff]/10 px-4 py-2 font-mono text-[12px] font-bold text-[#adc7ff] hover:bg-[#adc7ff]/20"
                      >
                        <span className="material-symbols-outlined text-[16px]">description</span>
                        Xem / Tải Tài liệu
                      </button>
                    )}
                  </div>
                </section>
              </div>
            </article>
          )}
        </section>
      </main>

      <SphereAIButton />
    </div>
  );
}
