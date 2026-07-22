import { Fragment, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { AppHeader } from '../components/AppHeader';
import { AppToast } from '../components/AppToast';
import { RoleSidebar } from '../components/RoleSidebar';
import { SphereAIButton } from '../components/SphereAIButton';
import { api, getAIErrorMessage, getStoredUser, type AISummaryResponse, type CourseDiscussion, type CourseProgress, type Lesson } from '../services/api';

const avatarSrc =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBoBuRJI1yShmJcMfHY1XLGNg58oqoS5MyV6HQICcczCWG7fu-lzanV_5ir_WBXQB19zta9onD5oKMvRyXiRpCjARwoUGMeyA0WX3cZa4UuBn_ZNEIt7g-llR2NmJcFr5na00oENmk4NouYphWdHgtSlu0awtCw8ILcImQS45sYgmsPBdDBehw';

function getRoleLabel(role?: string) {
  if (role === 'admin') return 'Quản trị viên';
  if (role === 'tutor') return 'Giảng viên';
  if (role === 'student') return 'Học viên';
  return 'Khách';
}

function renderSummaryInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|<sub>[^<]*<\/sub>|<sup>[^<]*<\/sup>)/gi).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${part}-${index}`} className="font-semibold text-[#f0f4ff]">{renderSummaryInline(part.slice(2, -2))}</strong>;
    }
    const subscript = part.match(/^<sub>([^<]*)<\/sub>$/i);
    if (subscript) {
      return <sub key={`${part}-${index}`} className="text-[0.72em] leading-none">{subscript[1]}</sub>;
    }
    const superscript = part.match(/^<sup>([^<]*)<\/sup>$/i);
    if (superscript) {
      return <sup key={`${part}-${index}`} className="text-[0.72em] leading-none">{superscript[1]}</sup>;
    }
    return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });
}

function SummaryContent({ content }: { content: string }) {
  return (
    <div className="space-y-2 break-words text-[15px] leading-7 text-[#d8e0f2] md:text-[16px]">
      {content.replace(/\r\n/g, '\n').split('\n').map((rawLine, index) => {
        const line = rawLine.trim();
        if (!line) return <div key={`space-${index}`} className="h-1" />;

        const heading = line.match(/^(#{1,6})\s+(.+)$/);
        if (heading) {
          return (
            <h3 key={`heading-${index}`} className="mb-2 mt-5 text-[19px] font-bold leading-7 text-[#adc7ff] first:mt-0 md:text-[21px]">
              {renderSummaryInline(heading[2])}
            </h3>
          );
        }

        if (/^\*\*[^*]+\*\*$/.test(line)) {
          return (
            <h3 key={`bold-heading-${index}`} className="mb-2 mt-5 text-[19px] font-bold leading-7 text-[#adc7ff] first:mt-0 md:text-[21px]">
              {line.slice(2, -2)}
            </h3>
          );
        }

        const bullet = rawLine.match(/^(\s*)[-*+]\s+(.+)$/);
        if (bullet) {
          const nested = bullet[1].length >= 2;
          return (
            <div key={`bullet-${index}`} className={`flex items-start gap-3 ${nested ? 'ml-6' : ''}`}>
              <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#24dfba]" />
              <p className="min-w-0 flex-1">{renderSummaryInline(bullet[2])}</p>
            </div>
          );
        }

        const ordered = line.match(/^(\d+)[.)]\s+(.+)$/);
        if (ordered) {
          return (
            <div key={`ordered-${index}`} className="flex items-start gap-3">
              <span className="min-w-6 font-mono font-bold text-[#24dfba]">{ordered[1]}.</span>
              <p className="min-w-0 flex-1">{renderSummaryInline(ordered[2])}</p>
            </div>
          );
        }

        return <p key={`paragraph-${index}`}>{renderSummaryInline(line)}</p>;
      })}
    </div>
  );
}

export function LessonDetailPage() {
  const params = new URLSearchParams(window.location.search);
  const courseId = params.get('course_id');
  const lessonId = params.get('lesson_id');
  const user = getStoredUser();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [discussions, setDiscussions] = useState<CourseDiscussion[]>([]);
  const [discussionContent, setDiscussionContent] = useState('');
  const [replyContentByDiscussionId, setReplyContentByDiscussionId] = useState<Record<string, string>>({});
  const [sendingReplyId, setSendingReplyId] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [isDiscussionLoading, setIsDiscussionLoading] = useState(false);
  const [isSendingDiscussion, setIsSendingDiscussion] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(courseId || lessonId));
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState<AISummaryResponse | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const activeCourseId = useMemo(() => courseId ?? lesson?.course_id ?? '', [courseId, lesson?.course_id]);

  useEffect(() => {
    setSummary(null);
  }, [lesson?._id]);

  useEffect(() => {
    if (courseId && !lessonId) {
      window.location.replace(`/course-detail?course_id=${encodeURIComponent(courseId)}`);
    }
  }, [courseId, lessonId]);

  useEffect(() => {
    if (!courseId) return;

    setIsLoading(true);
    api.getLessons(courseId)
      .then((items) => {
        setLessons(items);
      })
      .catch((err) => setMessage(err instanceof Error ? err.message : 'Không thể tải danh sách bài học'))
      .finally(() => setIsLoading(false));
  }, [courseId, lessonId]);

  useEffect(() => {
    if (!lessonId) return;

      setIsLoading(true);
      api.getLesson(lessonId)
        .then(setLesson)
        .catch((err) => setMessage(err instanceof Error ? err.message : 'Không thể tải bài học'))
        .finally(() => setIsLoading(false));
  }, [lessonId]);

  useEffect(() => {
    if (!courseId || user?.role !== 'student') return;

    api.getCourseProgress(courseId)
      .then(setProgress)
      .catch(() => setProgress(null));
  }, [courseId, user?.role]);

  useEffect(() => {
    let isActive = true;
    setVideoUrl('');

    if (!lesson?._id || !lesson.video_key) {
      setIsVideoLoading(false);
      return () => { isActive = false; };
    }

    setIsVideoLoading(true);
    api.createPresignedDownload(lesson._id, 'video')
      .then((result) => {
        if (isActive) setVideoUrl(result.download_url);
      })
      .catch((err) => {
        if (isActive) setMessage(err instanceof Error ? err.message : 'Không thể tải video bài học');
      })
      .finally(() => {
        if (isActive) setIsVideoLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [lesson?._id, lesson?.video_key]);

  async function loadDiscussions(targetCourseId = activeCourseId) {
    if (!targetCourseId || !user) return;

    setIsDiscussionLoading(true);
    try {
      setDiscussions(await api.getCourseDiscussions(targetCourseId));
    } catch (err) {
      setDiscussions([]);
      setMessage(err instanceof Error ? err.message : 'Không thể tải thảo luận khóa học');
    } finally {
      setIsDiscussionLoading(false);
    }
  }

  useEffect(() => {
    void loadDiscussions(activeCourseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCourseId, user?.role]);

  async function handleSendDiscussion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCourseId) return;

    const normalizedContent = discussionContent.trim();
    if (!normalizedContent) {
      setMessage('Vui lòng nhập nội dung thảo luận.');
      return;
    }
    if (normalizedContent.length > 2000) {
      setMessage('Nội dung thảo luận không được vượt quá 2000 ký tự.');
      return;
    }

    setIsSendingDiscussion(true);
    try {
      const result = await api.createCourseDiscussion(activeCourseId, normalizedContent);
      setDiscussions((current) => [...current, result.discussion]);
      setDiscussionContent('');
      setMessage(result.message);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể gửi thảo luận');
    } finally {
      setIsSendingDiscussion(false);
    }
  }

  async function handleSendDiscussionReply(event: FormEvent<HTMLFormElement>, discussionId: string) {
    event.preventDefault();
    if (!activeCourseId) return;

    const normalizedContent = (replyContentByDiscussionId[discussionId] ?? '').trim();
    if (!normalizedContent) {
      setMessage('Vui lòng nhập nội dung trả lời.');
      return;
    }
    if (normalizedContent.length > 2000) {
      setMessage('Nội dung trả lời không được vượt quá 2000 ký tự.');
      return;
    }

    setSendingReplyId(discussionId);
    try {
      const result = await api.createCourseDiscussionReply(activeCourseId, discussionId, normalizedContent);
      setDiscussions((current) => current.map((item) => item._id === discussionId ? result.discussion : item));
      setReplyContentByDiscussionId((current) => ({ ...current, [discussionId]: '' }));
      setMessage(result.message);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể gửi trả lời');
    } finally {
      setSendingReplyId('');
    }
  }

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

  const currentLessonIndex = lessons.findIndex((item) => item._id === lesson?._id);
  const previousLesson = currentLessonIndex > 0 ? lessons[currentLessonIndex - 1] : null;
  const nextLesson = currentLessonIndex >= 0 && currentLessonIndex < lessons.length - 1 ? lessons[currentLessonIndex + 1] : null;
  const progressPercent = progress?.progress_percent ?? 0;

  async function handleOpenLessonFile(targetType: 'video' | 'document') {
    if (!lesson?._id) return;

    try {
      const res = await api.createPresignedDownload(lesson._id, targetType);
      window.open(res.download_url, '_blank');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : targetType === 'video' ? 'Không thể lấy liên kết tải video' : 'Không thể lấy liên kết tải tài liệu');
    }
  }

  async function handleSummarizeLesson() {
    if (!lesson?._id || isSummarizing) return;

    setIsSummarizing(true);
    setMessage('');
    setSummary(null);
    try {
      const result = await api.summarizeLesson(lesson._id);
      setSummary(result);
      setLesson((current) => current ? {
        ...current,
        ai_index_status: result.ai_index_status ?? current.ai_index_status,
        ai_indexed_at: result.ai_indexed_at ?? current.ai_indexed_at,
        ai_index_error: result.ai_index_error ?? '',
      } : current);
    } catch (error) {
      setMessage(getAIErrorMessage(error, 'Không thể tóm tắt bài học bằng AI.'));
    } finally {
      setIsSummarizing(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#070d19] text-[#e7ecff] selection:bg-[#adc7ff]/30">
      <AppHeader user={user} roleLabel={getRoleLabel(user?.role)} avatarSrc={avatarSrc} />
      <AppToast message={message} tone="warning" onClose={() => setMessage('')} />

      <RoleSidebar activePath="/courses" user={user} />

      <main className="min-h-screen px-4 pb-16 pt-6 md:ml-64 md:px-6">
        <div className="mx-auto max-w-7xl">
          <nav className="mb-4 flex flex-wrap items-center gap-2 font-mono text-[12px] text-[#8b90a0]">
            <a className="transition hover:text-[#adc7ff]" href="/courses">Khóa học</a>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
			{activeCourseId && (
			  <>
				<a className="transition hover:text-[#adc7ff]" href={`/course-detail?course_id=${encodeURIComponent(activeCourseId)}`}>Thông tin khóa học</a>
				<span className="material-symbols-outlined text-[14px]">chevron_right</span>
			  </>
			)}
            <span className="text-[#c1c6d7]">Bài học</span>
            {lesson && (
              <>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                <span className="text-[#e7ecff]">Bài {lesson.order_index}</span>
              </>
            )}
          </nav>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <section className="min-w-0 space-y-6 lg:col-span-8">
          {!lesson && !isLoading && (
            <div className="rounded-2xl border border-dashed border-[#354055] bg-[#111827]/92 p-10 text-center shadow-xl shadow-black/20">
              <span className="material-symbols-outlined mb-3 text-[44px] text-[#8b90a0]">auto_stories</span>
              <h2 className="text-[22px] font-semibold text-[#dde2f4]">Chưa có dữ liệu bài học</h2>
            </div>
          )}

          {lesson && (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-[30px] font-semibold leading-10 text-[#e7ecff] md:text-[34px]">{lesson.title}</h1>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#adc7ff]/40 bg-[#adc7ff]/10 px-5 py-3 font-bold text-[#adc7ff] transition hover:bg-[#adc7ff]/20 disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    disabled={isSummarizing || !lesson.document_key}
                    onClick={() => void handleSummarizeLesson()}
                  >
                    <span className={`material-symbols-outlined text-[20px] ${isSummarizing ? 'animate-spin' : ''}`}>
                      {isSummarizing ? 'progress_activity' : 'auto_awesome'}
                    </span>
                    {isSummarizing ? 'AI đang đọc document...' : 'Tóm tắt document bằng AI'}
                  </button>
                </div>
              </div>

              <section className="overflow-hidden rounded-xl border border-[#414754] bg-[#080e1a] shadow-[0_0_40px_-10px_rgba(74,142,255,0.35)]">
                <div className="relative aspect-video bg-[radial-gradient(circle_at_50%_35%,rgba(74,142,255,0.28),transparent_34%),linear-gradient(135deg,#080e1a,#1a202c)]">
                  {videoUrl ? (
                    <video
                      className="h-full w-full bg-black object-contain"
                      controls
                      controlsList="nodownload"
                      preload="metadata"
                      src={videoUrl}
                    >
                      Trình duyệt của bạn không hỗ trợ phát video.
                    </video>
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(36,223,186,0.18),transparent_24%),linear-gradient(120deg,rgba(173,199,255,0.12),transparent_45%)] opacity-80" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                        <span className="flex h-20 w-20 items-center justify-center rounded-full border border-[#adc7ff]/40 bg-[#adc7ff]/20 text-[#adc7ff] backdrop-blur-md">
                          <span className="material-symbols-outlined text-[52px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                            {isVideoLoading ? 'progress_activity' : 'play_arrow'}
                          </span>
                        </span>
                        <p className="font-mono text-[12px] text-[#c1c6d7]">
                          {isVideoLoading ? 'Đang tải video...' : lesson.video_key ? 'Không thể hiển thị video lúc này.' : 'Bài học này chưa có video.'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </section>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <a
                  className={`inline-flex items-center justify-center gap-2 rounded-lg border px-5 py-3 font-mono text-[13px] font-bold transition ${
                    previousLesson ? 'border-[#414754] text-[#e7ecff] hover:bg-[#2f3542]' : 'pointer-events-none border-[#253047] text-[#657188] opacity-60'
                  }`}
                  href={previousLesson ? `/lesson-detail?course_id=${encodeURIComponent(previousLesson.course_id)}&lesson_id=${encodeURIComponent(previousLesson._id)}` : '#'}
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  Bài học trước
                </a>
                <a
                  className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 font-mono text-[13px] font-bold transition ${
                    nextLesson ? 'bg-[#adc7ff] text-[#002e68] hover:shadow-[0_0_20px_rgba(173,199,255,0.35)]' : 'pointer-events-none bg-[#2f3542] text-[#8b90a0] opacity-60'
                  }`}
                  href={nextLesson ? `/lesson-detail?course_id=${encodeURIComponent(nextLesson.course_id)}&lesson_id=${encodeURIComponent(nextLesson._id)}` : '#'}
                >
                  Bài học tiếp theo
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </a>
              </div>

              {summary && (
                <section className="rounded-xl border border-[#24dfba]/30 bg-[#24dfba]/5 p-6 shadow-xl shadow-black/15">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 text-[21px] font-semibold text-[#24dfba]">
                      <span className="material-symbols-outlined">auto_awesome</span>
                      Tóm tắt bởi Sphere AI
                    </h2>
                    <span className="font-mono text-[10px] text-[#738098]">
                      AI đã xử lý {(summary.usage?.total_tokens ?? 0).toLocaleString('vi-VN')} token
                    </span>
                  </div>
                  <SummaryContent content={summary.summary} />
                </section>
              )}

              <article className="rounded-xl border border-[#414754] bg-[#1a202c] p-6 shadow-xl shadow-black/20 md:p-8">
                <h2 className="mb-3 text-[24px] font-semibold text-[#adc7ff]">Nội dung bài học</h2>
                {lesson.content ? (
                  <p className="whitespace-pre-wrap text-[16px] leading-8 text-[#c1c6d7]">{lesson.content}</p>
                ) : (
                  <p className="rounded-lg border border-dashed border-[#414754] p-4 text-[#c1c6d7]">Bài học này chưa có nội dung.</p>
                )}
              </article>
            </>
          )}

          {activeCourseId && (
            <section className="space-y-5 border-t border-[#414754] pt-8">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="mb-2 font-mono text-[12px] uppercase tracking-wider text-[#8b90a0]">Discussion</p>
                  <h2 className="text-[24px] font-semibold text-[#dde2f4]">Hỏi bài và trao đổi với gia sư</h2>
                  <p className="mt-1 text-[14px] leading-6 text-[#c1c6d7]">
                    Đặt câu hỏi về bài học, chia sẻ vướng mắc hoặc phản hồi để mọi người trong khóa cùng theo dõi.
                  </p>
                </div>
                <button
                  className="inline-flex w-fit items-center gap-2 rounded-lg border border-[#adc7ff]/40 bg-[#adc7ff]/10 px-4 py-2 font-mono text-[12px] font-bold text-[#adc7ff] transition hover:bg-[#adc7ff]/20"
                  type="button"
                  onClick={() => void loadDiscussions(activeCourseId)}
                >
                  <span className="material-symbols-outlined text-[16px]">refresh</span>
                  Làm mới
                </button>
              </div>

              <form className="rounded-xl border border-[#414754] bg-[#161c28] p-5" onSubmit={handleSendDiscussion}>
                <label className="block">
                  <span className="mb-2 block font-mono text-[12px] uppercase tracking-wider text-[#8b90a0]">Nội dung</span>
                  <textarea
                    className="min-h-28 w-full resize-y rounded-xl border border-[#354055] bg-[#0d1422] px-4 py-3 text-[15px] leading-6 text-[#e7ecff] outline-none transition placeholder:text-[#7f8aa3] focus:border-[#8fb7ff] focus:ring-2 focus:ring-[#8fb7ff]/20"
                    maxLength={2000}
                    placeholder="Nhập câu hỏi hoặc phản hồi của bạn..."
                    value={discussionContent}
                    onChange={(event) => setDiscussionContent(event.target.value)}
                  />
                </label>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-mono text-[11px] text-[#8b90a0]">{discussionContent.trim().length}/2000</span>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#24dfba] px-5 py-3 font-mono text-[12px] font-black uppercase tracking-wide text-[#00382c] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    type="submit"
                    disabled={isSendingDiscussion}
                  >
                    <span className="material-symbols-outlined text-[17px]">send</span>
                    {isSendingDiscussion ? 'Đang gửi...' : 'Gửi thảo luận'}
                  </button>
                </div>
              </form>

              <div className="mt-5 space-y-3">
                {isDiscussionLoading && (
                  <p className="rounded-lg border border-[#ffc080]/30 bg-[#ffc080]/10 px-4 py-3 font-mono text-[12px] text-[#ffc080]">
                    Đang tải thảo luận...
                  </p>
                )}

                {!isDiscussionLoading && !discussions.length && (
                  <div className="rounded-xl border border-dashed border-[#354055] p-6 text-center text-[#c1c6d7]">
                    <span className="material-symbols-outlined mb-2 text-[36px] text-[#8b90a0]">forum</span>
                    <p>Chưa có thảo luận nào. Hãy mở đầu bằng câu hỏi đầu tiên.</p>
                  </div>
                )}

                {discussions.map((discussion) => {
                  const author = typeof discussion.author_id === 'object' ? discussion.author_id : null;
                  const authorName = author?.full_name ?? 'Người dùng';
                  const authorRole = author?.role === 'tutor' ? 'Gia sư' : author?.role === 'admin' ? 'Admin' : 'Học viên';
                  const replies = discussion.replies ?? [];
                  const replyContent = replyContentByDiscussionId[discussion._id] ?? '';
                  const isOwnMessage = typeof discussion.author_id === 'object'
                    ? (discussion.author_id._id === user?._id || discussion.author_id._id === user?.id)
                    : false;

                  return (
                    <article
                      key={discussion._id}
                      className={`rounded-xl border p-4 ${
                        isOwnMessage
                          ? 'border-[#24dfba]/25 bg-[#24dfba]/8'
                          : 'border-[#354055] bg-[#070d19]'
                      }`}
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`flex h-9 w-9 items-center justify-center rounded-full border font-bold ${
                            author?.role === 'tutor'
                              ? 'border-[#ffc080]/30 bg-[#ffc080]/10 text-[#ffc080]'
                              : author?.role === 'admin'
                                ? 'border-[#adc7ff]/30 bg-[#adc7ff]/10 text-[#adc7ff]'
                                : 'border-[#24dfba]/30 bg-[#24dfba]/10 text-[#24dfba]'
                          }`}>
                            {authorName.split(' ').filter(Boolean).slice(-1)[0]?.[0]?.toUpperCase() ?? 'U'}
                          </span>
                          <div>
                            <p className="font-semibold text-[#e7ecff]">{authorName}</p>
                            <p className="font-mono text-[11px] text-[#8b90a0]">{authorRole}</p>
                          </div>
                        </div>
                        <time className="font-mono text-[11px] text-[#8b90a0]">
                          {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(discussion.createdAt))}
                        </time>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-[#c1c6d7]">{discussion.content}</p>

                      <div className="mt-4 border-t border-[#354055] pt-4">
                        <div className="mb-3 flex items-center gap-2 font-mono text-[12px] text-[#8b90a0]">
                          <span className="material-symbols-outlined text-[16px]">forum</span>
                          {replies.length} trả lời
                        </div>

                        {replies.length > 0 && (
                          <div className="mb-4 space-y-3">
                            {replies.map((reply) => {
                              const replyAuthor = typeof reply.author_id === 'object' ? reply.author_id : null;
                              const replyAuthorName = replyAuthor?.full_name ?? 'Người dùng';
                              const replyAuthorRole = replyAuthor?.role === 'tutor' ? 'Gia sư' : replyAuthor?.role === 'admin' ? 'Admin' : 'Học viên';

                              return (
                                <div key={reply._id} className="rounded-lg border border-[#354055] bg-[#0d1422] p-3">
                                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className={`flex h-8 w-8 items-center justify-center rounded-full border text-[12px] font-bold ${
                                        replyAuthor?.role === 'tutor'
                                          ? 'border-[#ffc080]/30 bg-[#ffc080]/10 text-[#ffc080]'
                                          : replyAuthor?.role === 'admin'
                                            ? 'border-[#adc7ff]/30 bg-[#adc7ff]/10 text-[#adc7ff]'
                                            : 'border-[#24dfba]/30 bg-[#24dfba]/10 text-[#24dfba]'
                                      }`}>
                                        {replyAuthorName.split(' ').filter(Boolean).slice(-1)[0]?.[0]?.toUpperCase() ?? 'U'}
                                      </span>
                                      <div>
                                        <p className="text-[14px] font-semibold text-[#e7ecff]">{replyAuthorName}</p>
                                        <p className="font-mono text-[10px] text-[#8b90a0]">{replyAuthorRole}</p>
                                      </div>
                                    </div>
                                    <time className="font-mono text-[10px] text-[#8b90a0]">
                                      {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(reply.created_at))}
                                    </time>
                                  </div>
                                  <p className="whitespace-pre-wrap break-words text-[14px] leading-6 text-[#c1c6d7]">{reply.content}</p>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <form className="rounded-lg border border-[#354055] bg-[#070d19] p-3" onSubmit={(event) => void handleSendDiscussionReply(event, discussion._id)}>
                          <label className="block">
                            <span className="mb-2 block font-mono text-[11px] uppercase tracking-wider text-[#8b90a0]">Trả lời câu hỏi này</span>
                            <textarea
                              className="min-h-20 w-full resize-y rounded-lg border border-[#354055] bg-[#0d1422] px-3 py-2 text-[14px] leading-6 text-[#e7ecff] outline-none placeholder:text-[#7f8aa3] focus:border-[#8fb7ff]"
                              maxLength={2000}
                              placeholder="Nhập câu trả lời..."
                              value={replyContent}
                              onChange={(event) => setReplyContentByDiscussionId((current) => ({ ...current, [discussion._id]: event.target.value }))}
                            />
                          </label>
                          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <span className="font-mono text-[10px] text-[#8b90a0]">{replyContent.trim().length}/2000</span>
                            <button
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#adc7ff]/40 bg-[#adc7ff]/10 px-4 py-2 font-mono text-[11px] font-bold text-[#adc7ff] transition hover:bg-[#adc7ff]/20 disabled:cursor-not-allowed disabled:opacity-60"
                              type="submit"
                              disabled={sendingReplyId === discussion._id}
                            >
                              <span className="material-symbols-outlined text-[15px]">reply</span>
                              {sendingReplyId === discussion._id ? 'Đang gửi...' : 'Trả lời'}
                            </button>
                          </div>
                        </form>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
            </section>

            <aside className="space-y-5 lg:sticky lg:top-24 lg:col-span-4">
              <section className="rounded-xl border border-[#414754] bg-[#161c28] p-5 shadow-xl shadow-black/20">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-mono text-[12px] font-bold uppercase tracking-wider text-[#8b90a0]">Course Modules</h2>
                  <span className="font-mono text-[12px] text-[#adc7ff]">{lessons.length}</span>
                </div>
                {isLoading && <p className="font-mono text-[12px] text-[#8b90a0]">Đang tải bài học...</p>}
                {!isLoading && !lessons.length && (
                  <p className="rounded-lg border border-dashed border-[#414754] p-4 text-[14px] text-[#c1c6d7]">Chưa có bài học nào.</p>
                )}
                <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                  {lessons.map((item) => (
                    <a
                      key={item._id}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-3 transition ${
                        lesson?._id === item._id
                          ? 'border-[#adc7ff]/40 bg-[#adc7ff]/10 text-[#adc7ff]'
                          : 'border-transparent text-[#c1c6d7] hover:bg-[#2f3542] hover:text-[#e7ecff]'
                      }`}
                      href={`/lesson-detail?course_id=${encodeURIComponent(item.course_id)}&lesson_id=${encodeURIComponent(item._id)}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">{lesson?._id === item._id ? 'play_circle' : 'radio_button_unchecked'}</span>
                      <span className="min-w-0 flex-1 truncate text-[14px]">{item.order_index}. {item.title}</span>
                    </a>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-[#414754] bg-[#161f2e] p-5 shadow-xl shadow-black/20">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-mono text-[12px] font-bold uppercase tracking-wider text-[#adc7ff]">Lesson Progress</h2>
                  <span className="text-[26px] font-bold text-[#24dfba]">{progressPercent}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#2f3542]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#adc7ff] to-[#24dfba] shadow-[0_0_12px_rgba(36,223,186,0.45)]" style={{ width: `${progressPercent}%` }} />
                </div>
                <p className="mt-3 font-mono text-[12px] text-[#c1c6d7]">
                  {progress ? `Đã hoàn thành ${progress.completed_lessons}/${progress.total_lessons} bài học.` : 'Tiến độ sẽ hiển thị khi học viên tham gia khóa học.'}
                </p>
                {user?.role === 'student' && lesson && (
                  <button
                    className="mt-4 w-full rounded-lg bg-[#24dfba] px-4 py-3 font-mono text-[12px] font-bold text-[#00382c] transition hover:brightness-110"
                    type="button"
                    onClick={handleCompleteLesson}
                  >
                    Hoàn thành bài học
                  </button>
                )}
              </section>

              {courseId && (
                <section className="rounded-xl border border-[#414754] bg-[#242a37] p-5 text-center shadow-xl shadow-black/20">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#ffc080]/25 bg-[#ffc080]/10 text-[#ffc080]">
                    <span className="material-symbols-outlined text-[34px]" style={{ fontVariationSettings: '"FILL" 1' }}>quiz</span>
                  </div>
                  <h2 className="text-[22px] font-semibold text-[#e7ecff]">Knowledge Check</h2>
                  <p className="mt-2 text-[14px] leading-6 text-[#c1c6d7]">Kiểm tra mức độ hiểu bài sau khi học xong nội dung chính.</p>
                  <a
                    className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#ffc080] px-5 py-3 font-bold text-[#4a2800] transition hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(255,192,128,0.3)]"
                    href={`/quiz?course_id=${encodeURIComponent(courseId)}`}
                  >
                    Làm quiz
                  </a>
                </section>
              )}

              <section className="rounded-xl border border-[#414754] bg-[#1a202c] p-5 shadow-xl shadow-black/20">
                <h2 className="mb-4 flex items-center gap-2 font-mono text-[12px] font-bold uppercase tracking-wider text-[#c1c6d7]">
                  <span className="material-symbols-outlined text-[16px]">link</span>
                  Resources
                </h2>
                {lesson?.document_key && (
                  <div className="mb-4 rounded-xl border border-[#adc7ff]/25 bg-[#adc7ff]/5 p-3">
                    <div className="flex items-center gap-2 text-[13px] font-semibold text-[#adc7ff]">
                      <span className={`material-symbols-outlined text-[18px] ${lesson.ai_index_status === 'processing' ? 'animate-spin' : ''}`}>
                        {lesson.ai_index_status === 'ready'
                          ? 'check_circle'
                          : lesson.ai_index_status === 'partial'
                            ? 'warning'
                            : lesson.ai_index_status === 'failed'
                              ? 'error'
                              : lesson.ai_index_status === 'processing'
                                ? 'progress_activity'
                                : 'smart_toy'}
                      </span>
					  {lesson.ai_index_status === 'ready'
						? 'AI đã đọc document'
						: lesson.ai_index_status === 'partial'
						  ? 'AI mới đọc được một phần document'
						  : lesson.ai_index_status === 'failed'
							? 'AI chưa xử lý được document'
							: lesson.ai_index_status === 'processing'
							  ? 'AI đang xử lý document'
							  : 'Document chưa được phân tích cho AI'}
                    </div>
                    {lesson.ai_index_error && <p className="mt-2 text-[12px] leading-5 text-[#ffb4ab]">{lesson.ai_index_error}</p>}
                  </div>
                )}
                <div className="space-y-3">
                  <button
                    className="flex w-full items-center gap-3 rounded-xl border border-[#24dfba]/30 bg-[#24dfba]/10 px-4 py-4 text-left transition hover:bg-[#24dfba]/16 disabled:cursor-not-allowed disabled:border-[#414754] disabled:bg-[#0d131f] disabled:opacity-60"
                    type="button"
                    disabled={!lesson?.document_key}
                    onClick={() => void handleOpenLessonFile('document')}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#24dfba] text-[#00382c]">
                      <span className="material-symbols-outlined text-[23px]">description</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-[#e7ecff]">Tải tài liệu</span>
                      <span className="mt-0.5 block text-[12px] text-[#8b90a0]">{lesson?.document_key ? 'Mở tài liệu học tập trong tab mới' : 'Chưa có tài liệu'}</span>
                    </span>
                    {lesson?.document_key && <span className="material-symbols-outlined text-[18px] text-[#8b90a0]">download</span>}
                  </button>
                </div>
              </section>

            </aside>
          </div>
        </div>
      </main>

      <SphereAIButton href={`/ai-assistant?course_id=${encodeURIComponent(activeCourseId)}${lesson?._id ? `&lesson_id=${encodeURIComponent(lesson._id)}` : ''}`} />
    </div>
  );
}
