import { useEffect, useMemo, useState } from 'react';
import { AppHeader } from '../components/AppHeader';
import { RoleSidebar } from '../components/RoleSidebar';
import { canManageSystem, getRoleLabel, getRoleNav } from '../lib/roleAccess';
import { api, getStoredUser, type SystemStats } from '../services/api';

const avatarSrc =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCJoFDj_0QC113oXEglqawaRx_p6aj65L4yuLN_52cJ7ZIsSBwJOLuDBdEOjZO4FGAYbIdjFRiTlh8P2s0viUatzxsXtdGT_HsugoXIhqhwVN_Dw3tV9dDK8jwLYtcCNANCSZMe4LpwBeZ_9u6z_nbGgFvzsUsVhmefvWWra3Gr3YxrVvyeFBabLR6ZaLPdihuammwZ1Kx-7DMoW1tlYifLN7bf0t5jAQwLgAkqx_v0jfzWhkcx2DbATA';

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value);
}

function formatBytes(value: number | null) {
  if (value === null) return 'Không khả dụng';
  if (value === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** unitIndex;
  return `${amount.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ${units[unitIndex]}`;
}

function formatDate(value: string, includeTime = false) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit', second: '2-digit' } : {}),
  }).format(new Date(value));
}

type MetricCardProps = {
  icon: string;
  label: string;
  value: string;
  detail: string;
  tone: string;
};

function MetricCard({ icon, label, value, detail, tone }: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-white/5 bg-[#161c28] p-5 shadow-lg shadow-black/10">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
          <span className="material-symbols-outlined text-[25px]">{icon}</span>
        </div>
        <span className="h-2 w-2 rounded-full bg-[#24dfba] shadow-[0_0_12px_rgba(36,223,186,0.8)]" />
      </div>
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#8b90a0]">{label}</p>
      <p className="mt-2 text-[30px] font-semibold tracking-tight text-[#dde2f4]">{value}</p>
      <p className="mt-2 text-[13px] text-[#8b90a0]">{detail}</p>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-[#414754] bg-[#161c28]">
      <div className="text-center">
        <span className="material-symbols-outlined animate-spin text-[42px] text-[#adc7ff]">progress_activity</span>
        <p className="mt-3 font-mono text-[12px] text-[#8b90a0]">Đang tổng hợp dữ liệu hệ thống...</p>
      </div>
    </div>
  );
}

export function SystemMonitoringPage() {
  const user = getStoredUser();
  const navItems = getRoleNav(user);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadStats() {
    setIsLoading(true);
    setError('');

    try {
      setStats(await api.getSystemStats());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu giám sát');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (canManageSystem(user)) {
      void loadStats();
    } else {
      setIsLoading(false);
    }
  }, [user?.role]);

  const maxDailyRequests = useMemo(
    () => Math.max(1, ...(stats?.traffic.daily_requests.map((item) => item.requests) ?? [1])),
    [stats],
  );

  if (!canManageSystem(user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d131f] px-4 text-[#dde2f4]">
        <section className="max-w-md rounded-xl border border-[#414754] bg-[#161c28] p-8 text-center">
          <span className="material-symbols-outlined mb-4 text-[48px] text-[#ffb4ab]">lock</span>
          <h1 className="text-[26px] font-semibold">Không có quyền truy cập</h1>
          <p className="mt-2 text-[#c1c6d7]">Chỉ admin được giám sát và quản trị hệ thống.</p>
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
      <RoleSidebar activePath="/system-monitoring" items={navItems} user={user} />

      <main className="min-h-screen pb-16 md:pl-64">
        <div className="mx-auto max-w-7xl space-y-7 p-4 md:p-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[#24dfba]">Admin control center</p>
              <h1 className="text-[32px] font-semibold tracking-tight">Giám sát Hệ thống</h1>
              <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#8b90a0]">
                Tổng quan lưu lượng API, tài khoản, nội dung học tập và tài nguyên lưu trữ.
              </p>
            </div>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#414754] bg-[#161c28] px-4 py-3 font-mono text-[12px] text-[#c1c6d7] transition-colors hover:border-[#adc7ff]/60 hover:text-[#adc7ff] disabled:cursor-wait disabled:opacity-60"
              type="button"
              disabled={isLoading}
              onClick={() => void loadStats()}
            >
              <span className={`material-symbols-outlined text-[18px] ${isLoading ? 'animate-spin' : ''}`}>refresh</span>
              Làm mới dữ liệu
            </button>
          </header>

          {error && (
            <section className="flex items-center justify-between gap-4 rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 px-5 py-4 text-[#ffb4ab]">
              <p className="text-[14px]">{error}</p>
              <button className="font-mono text-[12px] underline" type="button" onClick={() => void loadStats()}>Thử lại</button>
            </section>
          )}

          {isLoading && !stats && <LoadingState />}

          {stats && (
            <>
              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard icon="ads_click" label="API hôm nay" value={formatNumber(stats.traffic.today_requests)} detail={`${formatNumber(stats.traffic.total_requests)} request đã ghi nhận`} tone="bg-[#adc7ff]/10 text-[#adc7ff]" />
                <MetricCard icon="verified_user" label="User hoạt động" value={formatNumber(stats.users.active)} detail={`${formatNumber(stats.users.total)} tài khoản toàn hệ thống`} tone="bg-[#24dfba]/10 text-[#24dfba]" />
                <MetricCard icon="school" label="Khóa học" value={formatNumber(stats.content.active_courses)} detail={`${formatNumber(stats.content.total_lessons)} bài học · ${formatNumber(stats.content.total_quizzes)} quiz`} tone="bg-[#ffc080]/10 text-[#ffc080]" />
                <MetricCard icon="speed" label="Phản hồi trung bình" value={`${formatNumber(stats.traffic.average_response_ms)} ms`} detail={`Tỷ lệ lỗi ${stats.traffic.error_rate_percent.toLocaleString('vi-VN')}%`} tone="bg-[#d5b8ff]/10 text-[#d5b8ff]" />
              </section>

              <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                <article className="rounded-2xl border border-white/5 bg-[#161c28] p-5 md:p-6 xl:col-span-2">
                  <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#8b90a0]">Traffic analytics</p>
                      <h2 className="mt-2 text-[22px] font-semibold">Lượt gọi API trong 7 ngày</h2>
                    </div>
                    <span className="rounded-full bg-[#24dfba]/10 px-3 py-1 font-mono text-[11px] text-[#24dfba]">
                      {formatNumber(stats.traffic.unique_users_7d)} user duy nhất
                    </span>
                  </div>

                  <div className="flex h-64 items-end gap-2 border-b border-l border-[#414754]/70 px-3 pt-4 sm:gap-4">
                    {stats.traffic.daily_requests.map((item) => {
                      const heightPercent = item.requests ? Math.max(8, (item.requests / maxDailyRequests) * 100) : 2;
                      return (
                        <div key={item.date} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                          <div className="relative flex w-full flex-1 items-end justify-center">
                            <div
                              className="w-full max-w-12 rounded-t-lg bg-gradient-to-t from-[#4a8eff] to-[#24dfba] transition-all duration-500 group-hover:brightness-125"
                              style={{ height: `${heightPercent}%` }}
                            >
                              <span className="absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-[#0d131f] px-2 py-1 font-mono text-[10px] text-[#dde2f4] shadow-xl group-hover:block">
                                {formatNumber(item.requests)} request
                              </span>
                            </div>
                          </div>
                          <span className="pb-2 font-mono text-[10px] text-[#8b90a0]">{formatDate(item.date)}</span>
                        </div>
                      );
                    })}
                  </div>
                </article>

                <article className="rounded-2xl border border-white/5 bg-[#161c28] p-5 md:p-6">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#8b90a0]">Amazon S3</p>
                  <h2 className="mt-2 text-[22px] font-semibold">Dung lượng lưu trữ</h2>
                  <div className="mt-8 flex justify-center">
                    <div className="relative flex h-44 w-44 items-center justify-center rounded-full" style={{ background: `conic-gradient(#24dfba ${(stats.storage.usage_percent ?? 0) * 3.6}deg, #2f3542 0deg)` }}>
                      <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-[#161c28] text-center">
                        <strong className="text-[26px]">{stats.storage.usage_percent === null ? '—' : `${stats.storage.usage_percent}%`}</strong>
                        <span className="mt-1 font-mono text-[10px] uppercase text-[#8b90a0]">đã sử dụng</span>
                      </div>
                    </div>
                  </div>
                  <dl className="mt-7 space-y-3 text-[13px]">
                    <div className="flex justify-between gap-4"><dt className="text-[#8b90a0]">Đã dùng</dt><dd>{formatBytes(stats.storage.used_bytes)}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-[#8b90a0]">Hạn mức cấu hình</dt><dd>{formatBytes(stats.storage.capacity_bytes)}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-[#8b90a0]">Số object</dt><dd>{stats.storage.object_count === null ? '—' : formatNumber(stats.storage.object_count)}</dd></div>
                  </dl>
                  {stats.storage.message && <p className="mt-5 rounded-lg bg-[#ffc080]/10 px-3 py-2 text-[11px] leading-5 text-[#ffc080]">{stats.storage.message}</p>}
                </article>
              </section>

              <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <article className="rounded-2xl border border-white/5 bg-[#161c28] p-5">
                  <h2 className="text-[18px] font-semibold">Tài khoản theo vai trò</h2>
                  <div className="mt-5 space-y-4">
                    {[
                      ['Học viên', stats.users.by_role.student, '#adc7ff'],
                      ['Giảng viên', stats.users.by_role.tutor, '#24dfba'],
                      ['Quản trị viên', stats.users.by_role.admin, '#ffc080'],
                    ].map(([label, value, color]) => {
                      const numericValue = Number(value);
                      const percent = stats.users.total ? (numericValue / stats.users.total) * 100 : 0;
                      return (
                        <div key={String(label)}>
                          <div className="mb-2 flex justify-between text-[13px]"><span className="text-[#c1c6d7]">{label}</span><strong>{formatNumber(numericValue)}</strong></div>
                          <div className="h-2 overflow-hidden rounded-full bg-[#2f3542]"><div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: String(color) }} /></div>
                        </div>
                      );
                    })}
                  </div>
                </article>

                <article className="rounded-2xl border border-white/5 bg-[#161c28] p-5">
                  <h2 className="text-[18px] font-semibold">Enrollment</h2>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-[#24dfba]/10 p-4"><p className="font-mono text-[10px] uppercase text-[#24dfba]">Đang học</p><strong className="mt-2 block text-[28px]">{formatNumber(stats.content.enrollments.active)}</strong></div>
                    <div className="rounded-xl bg-[#ffc080]/10 p-4"><p className="font-mono text-[10px] uppercase text-[#ffc080]">Chờ duyệt</p><strong className="mt-2 block text-[28px]">{formatNumber(stats.content.enrollments.pending)}</strong></div>
                  </div>
                  <div className="mt-4 flex justify-between border-t border-[#414754] pt-4 text-[13px]"><span className="text-[#8b90a0]">Course đã xóa mềm</span><strong>{formatNumber(stats.content.deleted_courses)}</strong></div>
                </article>

                <article className="rounded-2xl border border-white/5 bg-[#161c28] p-5">
                  <h2 className="text-[18px] font-semibold">Quiz attempt</h2>
                  <dl className="mt-5 space-y-3 text-[13px]">
                    <div className="flex items-center justify-between rounded-lg bg-[#adc7ff]/5 px-4 py-3"><dt className="text-[#c1c6d7]">Đang làm</dt><dd className="font-semibold text-[#adc7ff]">{formatNumber(stats.content.quiz_attempts.in_progress)}</dd></div>
                    <div className="flex items-center justify-between rounded-lg bg-[#24dfba]/5 px-4 py-3"><dt className="text-[#c1c6d7]">Đã nộp</dt><dd className="font-semibold text-[#24dfba]">{formatNumber(stats.content.quiz_attempts.submitted)}</dd></div>
                    <div className="flex items-center justify-between rounded-lg bg-[#ffb4ab]/5 px-4 py-3"><dt className="text-[#c1c6d7]">Hết hạn</dt><dd className="font-semibold text-[#ffb4ab]">{formatNumber(stats.content.quiz_attempts.expired)}</dd></div>
                  </dl>
                </article>
              </section>

              <p className="text-right font-mono text-[10px] text-[#8b90a0]">Cập nhật lúc {formatDate(stats.generated_at, true)}</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
