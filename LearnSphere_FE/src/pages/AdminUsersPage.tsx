import { useEffect, useMemo, useState } from 'react';
import { AppHeader } from '../components/AppHeader';
import { AppToast } from '../components/AppToast';
import { RoleSidebar } from '../components/RoleSidebar';
import { canManageSystem, getRoleLabel, getRoleNav } from '../lib/roleAccess';
import { api, getStoredUser, type AdminUser, type Role } from '../services/api';

const avatarSrc =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAK3DeXFfcU7eoLcYm0J-P0geFc_1SNB3sOpbZdSgXNGYGNkWLvpydHgoO3teNd6SCKCfYzJzNrs1AB7P8Pu74X-3istluRsHM1oPvbEs2nLPM2cHWOxHmwakxXKAZY99rZGG-p9kypULkAvH9bkTxwS1EgNluYqYhNlGpql2gZkqIWaOYk5FWOQvYjhFI2VJivahYgEOwamgFB5MZtSI9a-fovv-ztHAlZ1TjPwNnEgpB773mBUptA6A';

type StatusFilter = 'pending' | 'active' | 'blocked' | '';
type RoleFilter = Role | '';

function statusLabel(status?: string) {
  if (status === 'pending') return 'Chờ duyệt';
  if (status === 'blocked') return 'Bị khóa';
  return 'Đang hoạt động';
}

function statusClass(status?: string) {
  if (status === 'blocked') return 'border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-[#ffb4ab]';
  if (status === 'pending') return 'border-[#ffc080]/30 bg-[#ffc080]/10 text-[#ffc080]';
  return 'border-[#24dfba]/30 bg-[#24dfba]/10 text-[#24dfba]';
}

function formatDate(value?: string) {
  if (!value) return 'Chưa rõ';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function AdminUsersPage() {
  const user = getStoredUser();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [role, setRole] = useState<RoleFilter>('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navItems = useMemo(() => getRoleNav(user), [user]);

  const stats = useMemo(
    () => [
      { icon: 'group', label: 'Tổng tài khoản', value: users.length },
      { icon: 'school', label: 'Học viên', value: users.filter((item) => item.role === 'student').length },
      { icon: 'co_present', label: 'Giảng viên', value: users.filter((item) => item.role === 'tutor').length },
      { icon: 'block', label: 'Đang bị khóa', value: users.filter((item) => item.account_status === 'blocked').length },
    ],
    [users],
  );

  async function loadUsers() {
    if (!canManageSystem(user)) return;

    setIsLoading(true);
    setMessage('');
    try {
      const items = await api.getUsers({
        role: role || undefined,
        account_status: status || undefined,
      });
      setUsers(items);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể tải danh sách tài khoản');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, status]);

  async function updateUserStatus(userId: string, account_status: 'active' | 'blocked') {
    try {
      const result = await api.updateAccountStatus(userId, account_status);
      setMessage(result.message);
      await loadUsers();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái tài khoản');
    }
  }

  if (!canManageSystem(user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d131f] px-4 text-[#dde2f4]">
        <section className="max-w-md rounded-xl border border-[#414754] bg-[#161c28] p-8 text-center">
          <span className="material-symbols-outlined mb-4 text-[48px] text-[#ffb4ab]">lock</span>
          <h1 className="text-[26px] font-semibold">Không có quyền truy cập</h1>
          <p className="mt-2 text-[#c1c6d7]">Chỉ admin được quản lý tài khoản.</p>
          <a className="mt-6 inline-flex rounded-lg bg-[#adc7ff] px-5 py-3 font-bold text-[#002e68]" href="/dashboard">
            Về bảng điều khiển
          </a>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070d19] text-[#e7ecff]">
      <AppHeader user={user} roleLabel={getRoleLabel(user?.role)} avatarSrc={avatarSrc} />
      <RoleSidebar activePath="/admin-users" items={navItems} user={user} />
      <AppToast message={message} tone="warning" onClose={() => setMessage('')} />

      <main className="mx-auto w-full max-w-[1440px] space-y-5 px-4 py-6 md:pl-64 md:pr-6">
        <section className="rounded-2xl border border-[#253047] bg-[#111827]/92 p-5 shadow-xl shadow-black/20">
          <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.8fr)_minmax(560px,1.2fr)] xl:items-center">
            <div>
              <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-[#8b90a0]">Admin</p>
              <h1 className="text-[26px] font-semibold">Quản lý tài khoản</h1>
              <p className="mt-1 text-[13px] leading-5 text-[#c1c6d7]">
                Xem account hệ thống; admin có thể khóa hoặc mở khóa học viên và giảng viên.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {stats.map((item) => (
                <article key={item.label} className="min-h-[82px] min-w-0 rounded-xl border border-[#354055] bg-[#070d19] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="material-symbols-outlined text-[22px] text-[#adc7ff]">{item.icon}</span>
                    <p className="text-[24px] font-semibold leading-none">{item.value}</p>
                  </div>
                  <p className="mt-3 whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-[#8b90a0]">{item.label}</p>
                </article>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:col-span-2">
              <label className="flex h-12 min-w-0 items-center justify-between gap-3 rounded-xl border border-[#354055] bg-[#070d19] px-4">
                <span className="font-mono text-[12px] text-[#8b90a0]">Role</span>
                <select className="min-w-[150px] bg-transparent text-[14px] font-semibold text-[#dde2f4] outline-none" value={role} onChange={(event) => setRole(event.target.value as RoleFilter)}>
                  <option value="">Tất cả</option>
                  <option value="student">Học viên</option>
                  <option value="tutor">Giảng viên</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label className="flex h-12 min-w-0 items-center justify-between gap-3 rounded-xl border border-[#354055] bg-[#070d19] px-4">
                <span className="font-mono text-[12px] text-[#8b90a0]">Trạng thái</span>
                <select className="min-w-[150px] bg-transparent text-[14px] font-semibold text-[#dde2f4] outline-none" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
                  <option value="">Tất cả</option>
                  <option value="pending">Chờ duyệt</option>
                  <option value="active">Đang hoạt động</option>
                  <option value="blocked">Bị khóa</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#253047] bg-[#111827]/92 shadow-xl shadow-black/20">
          <div className="flex min-h-14 items-center justify-between border-b border-[#253047] px-5 py-3">
            <h2 className="text-[20px] font-semibold">Danh sách account</h2>
            {isLoading && <p className="font-mono text-[12px] text-[#8b90a0]">Đang tải...</p>}
          </div>

          {!isLoading && !users.length ? (
            <div className="p-10 text-center text-[#c1c6d7]">Không có tài khoản phù hợp bộ lọc hiện tại.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] table-fixed text-left">
                <colgroup>
                  <col className="w-[21%]" />
                  <col className="w-[24%]" />
                  <col className="w-[12%]" />
                  <col className="w-[16%]" />
                  <col className="w-[14%]" />
                  <col className="w-[13%]" />
                </colgroup>
                <thead className="bg-[#1a202c] font-mono text-[11px] uppercase tracking-wider text-[#8b90a0]">
                  <tr>
                    {['Họ tên', 'Email', 'Role', 'Trạng thái', 'Ngày tạo', 'Thao tác'].map((head) => (
                      <th key={head} className={`px-3 py-3 xl:px-4 ${head === 'Thao tác' ? 'sticky right-0 z-10 border-l border-[#354055] bg-[#1a202c] text-right' : ''}`}>{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#414754]/40">
                  {users.map((item) => (
                    <tr key={item._id} className="group hover:bg-[#2f3542]/20">
                      <td className="break-words px-3 py-4 font-semibold xl:px-4">{item.full_name}</td>
                      <td className="truncate px-3 py-4 text-[#c1c6d7] xl:px-4" title={item.email}>{item.email}</td>
                      <td className="px-3 py-4 text-[#c1c6d7] xl:px-4">{getRoleLabel(item.role)}</td>
                      <td className="px-3 py-4 xl:px-4">
                        <span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 font-mono text-[11px] ${statusClass(item.account_status)}`}>
                          {statusLabel(item.account_status)}
                        </span>
                      </td>
                      <td className="px-3 py-4 font-mono text-[11px] leading-5 text-[#8b90a0] xl:px-4">{formatDate(item.createdAt)}</td>
                      <td className="sticky right-0 border-l border-[#253047] bg-[#111827] px-3 py-4 transition-colors group-hover:bg-[#151d2b] xl:px-4">
                        {item.role === 'student' || item.role === 'tutor' ? (
                          <div className="flex flex-col items-stretch gap-2">
                            {item.account_status !== 'active' && (
                              <button className="whitespace-nowrap rounded-lg bg-[#24dfba] px-2 py-2 text-center font-mono text-[11px] font-bold text-[#00382c]" type="button" onClick={() => void updateUserStatus(item._id, 'active')}>
                                Mở khóa
                              </button>
                            )}
                            {item.account_status !== 'blocked' && (
                              <button className="whitespace-nowrap rounded-lg border border-[#ffb4ab]/40 px-2 py-2 text-center font-mono text-[11px] font-bold text-[#ffb4ab]" type="button" onClick={() => void updateUserStatus(item._id, 'blocked')}>
                                Khóa
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="block text-right font-mono text-[11px] text-[#8b90a0]">Chỉ xem</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
