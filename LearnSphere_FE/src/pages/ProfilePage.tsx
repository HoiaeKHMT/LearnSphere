import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { AppHeader } from '../components/AppHeader';
import { RoleSidebar } from '../components/RoleSidebar';
import { api, clearSession, getStoredUser, getToken, saveSession, type User } from '../services/api';

const fallbackAvatarSrc =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAK3DeXFfcU7eoLcYm0J-P0geFc_1SNB3sOpbZdSgXNGYGNkWLvpydHgoO3teNd6SCKCfYzJzNrs1AB7P8Pu74X-3istluRsHM1oPvbEs2nLPM2cHWOxHmwakxXKAZY99rZGG-p9kypULkAvH9bkTxwS1EgNluYqYhNlGpql2gZkqIWaOYk5FWOQvYjhFI2VJivahYgEOwamgFB5MZtSI9a-fovv-ztHAlZ1TjPwNnEgpB773mBUptA6A';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function formatDate(value?: string) {
  if (!value) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function getRoleLabel(role?: string) {
  if (role === 'admin') return 'Quản trị viên';
  if (role === 'tutor') return 'Giảng viên';
  return 'Học viên';
}

function getStatusLabel(status?: string) {
  if (status === 'pending') return 'Chờ duyệt';
  if (status === 'blocked') return 'Bị khóa';
  return 'Đang hoạt động';
}

export function ProfilePage() {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [fullName, setFullName] = useState(() => getStoredUser()?.full_name ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(getStoredUser()));
  const [isSaving, setIsSaving] = useState(false);

  async function loadAvatar(profile: User) {
    if (!profile.avatar_key) {
      setAvatarUrl('');
      return;
    }

    try {
      const result = await api.getProfileAvatar();
      setAvatarUrl(result.download_url);
    } catch {
      setAvatarUrl('');
    }
  }

  useEffect(() => {
    if (!getStoredUser()) {
      setIsLoading(false);
      return;
    }

    api.me()
      .then(async (profile) => {
        setUser(profile);
        setFullName(profile.full_name);
        const token = getToken();
        if (token) saveSession({ access_token: token, token_type: 'bearer', user: profile });
        await loadAvatar(profile);
      })
      .catch((err) => {
        setIsError(true);
        setMessage(err instanceof Error ? err.message : 'Không thể tải thông tin tài khoản');
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  const initials = useMemo(
    () => (user?.full_name ?? 'LearnSphere User').split(' ').filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase(),
    [user?.full_name],
  );

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setIsError(true);
      setMessage('Avatar chỉ hỗ trợ JPEG, PNG hoặc WebP.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      setIsError(true);
      setMessage('Avatar không được vượt quá 5 MB.');
      event.target.value = '';
      return;
    }

    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setMessage('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = fullName.trim();

    if (normalizedName.length < 2 || normalizedName.length > 100) {
      setIsError(true);
      setMessage('Họ và tên phải có từ 2 đến 100 ký tự.');
      return;
    }

    setIsSaving(true);
    setIsError(false);
    setMessage('');

    try {
      let avatarKey: string | undefined;
      if (avatarFile) {
        const presigned = await api.createProfileAvatarUpload(avatarFile);
        await api.uploadFileToS3(presigned.upload_url, avatarFile);
        avatarKey = presigned.file_key;
      }

      const result = await api.updateProfile({
        full_name: normalizedName,
        ...(avatarKey ? { avatar_key: avatarKey } : {}),
      });

      const token = getToken();
      if (token) saveSession({ access_token: token, token_type: 'bearer', user: result.user });
      setUser(result.user);
      setFullName(result.user.full_name);
      setAvatarFile(null);
      setAvatarPreview('');
      await loadAvatar(result.user);
      setMessage('Cập nhật hồ sơ thành công.');
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : 'Không thể cập nhật hồ sơ');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveAvatar() {
    setIsSaving(true);
    setIsError(false);
    setMessage('');

    try {
      const result = await api.updateProfile({ avatar_key: null });
      const token = getToken();
      if (token) saveSession({ access_token: token, token_type: 'bearer', user: result.user });
      setUser(result.user);
      setAvatarFile(null);
      setAvatarPreview('');
      setAvatarUrl('');
      setMessage('Đã gỡ ảnh đại diện.');
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : 'Không thể gỡ ảnh đại diện');
    } finally {
      setIsSaving(false);
    }
  }

  function handleLogout() {
    clearSession();
    window.location.assign('/login');
  }

  if (!user && !isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d131f] px-4 text-[#dde2f4]">
        <section className="w-full max-w-md rounded-xl border border-[#414754] bg-[#161c28] p-8 text-center">
          <span className="material-symbols-outlined mb-4 text-[48px] text-[#adc7ff]">lock</span>
          <h1 className="mb-2 text-[28px] font-semibold">Cần đăng nhập</h1>
          <a className="mt-5 inline-flex rounded-lg bg-[#adc7ff] px-6 py-3 font-bold text-[#002e68]" href="/login">Đăng nhập</a>
        </section>
      </div>
    );
  }

  const displayedAvatar = avatarPreview || avatarUrl;

  return (
    <div className="min-h-screen bg-[#0d131f] text-[#dde2f4]">
      <AppHeader user={user} roleLabel={getRoleLabel(user?.role)} avatarSrc={displayedAvatar || fallbackAvatarSrc} />
      <RoleSidebar activePath="/profile" user={user} />

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-8 md:pl-72 md:pr-8 lg:grid-cols-12">
        <aside className="lg:col-span-4">
          <section className="overflow-hidden rounded-2xl border border-white/5 bg-[#161c28]">
            <div className="h-28 bg-[linear-gradient(135deg,#adc7ff_0%,#24dfba_52%,#ffc080_100%)] opacity-90" />
            <div className="px-6 pb-6">
              <div className="relative z-10 -mt-16 mb-5 flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border-4 border-[#161c28] bg-[#0d131f] text-[28px] font-bold text-[#adc7ff] shadow-xl">
                {displayedAvatar ? <img className="h-full w-full object-cover" src={displayedAvatar} alt={user?.full_name ?? 'Avatar'} /> : initials}
              </div>
              <h1 className="text-[28px] font-semibold">{user?.full_name ?? 'Đang tải...'}</h1>
              <p className="mt-1 text-[#c1c6d7]">{user?.email}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-[#adc7ff]/10 px-3 py-1 font-mono text-[12px] text-[#adc7ff]">{getRoleLabel(user?.role)}</span>
                <span className="rounded-full bg-[#24dfba]/10 px-3 py-1 font-mono text-[12px] text-[#24dfba]">{getStatusLabel(user?.account_status)}</span>
              </div>
              <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-[#ffb4ab]/30 px-4 py-3 font-mono text-[14px] text-[#ffb4ab] hover:bg-[#ffb4ab]/10" type="button" onClick={handleLogout}>
                <span className="material-symbols-outlined text-[18px]">logout</span>Đăng xuất
              </button>
            </div>
          </section>
        </aside>

        <section className="space-y-6 lg:col-span-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { icon: 'verified_user', label: 'Trạng thái', value: getStatusLabel(user?.account_status), tone: 'text-[#24dfba]' },
              { icon: 'badge', label: 'Vai trò', value: getRoleLabel(user?.role), tone: 'text-[#adc7ff]' },
              { icon: 'event', label: 'Ngày tham gia', value: formatDate(user?.created_at), tone: 'text-[#ffc080]' },
            ].map((item) => (
              <article key={item.label} className="rounded-xl border border-white/5 bg-[#161c28] p-5">
                <span className={`material-symbols-outlined mb-3 text-[28px] ${item.tone}`}>{item.icon}</span>
                <p className="font-mono text-[11px] uppercase tracking-wider text-[#8b90a0]">{item.label}</p>
                <p className="mt-1 text-[17px] font-semibold">{item.value}</p>
              </article>
            ))}
          </div>

          <form className="rounded-2xl border border-white/5 bg-[#161c28] p-6 md:p-8" onSubmit={handleSubmit}>
            <div className="mb-7">
              <h2 className="text-[24px] font-semibold">Chỉnh sửa hồ sơ</h2>
              <p className="mt-2 text-[14px] text-[#8b90a0]">Cập nhật tên hiển thị và ảnh đại diện của tài khoản.</p>
            </div>

            {message && <div className={`mb-6 rounded-lg border px-4 py-3 text-[14px] ${isError ? 'border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-[#ffb4ab]' : 'border-[#24dfba]/30 bg-[#24dfba]/10 text-[#24dfba]'}`}>{message}</div>}

            <div className="space-y-6">
              <div>
                <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-[#8b90a0]">Ảnh đại diện</p>
                <div className="flex flex-col gap-4 rounded-xl border border-[#414754] bg-[#0d131f]/60 p-4 sm:flex-row sm:items-center">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#242a37] font-bold text-[#adc7ff]">
                    {displayedAvatar ? <img className="h-full w-full object-cover" src={displayedAvatar} alt="Xem trước avatar" /> : initials}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-3">
                      <label className="cursor-pointer rounded-lg bg-[#adc7ff] px-4 py-2.5 font-bold text-[#002e68] hover:brightness-110">
                        Chọn ảnh
                        <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} />
                      </label>
                      {(user?.avatar_key || avatarFile) && <button className="rounded-lg border border-[#414754] px-4 py-2.5 text-[#c1c6d7] hover:border-[#ffb4ab]/50 hover:text-[#ffb4ab]" type="button" disabled={isSaving} onClick={() => void handleRemoveAvatar()}>Gỡ ảnh</button>}
                    </div>
                    <p className="mt-2 text-[12px] text-[#8b90a0]">JPEG, PNG hoặc WebP · tối đa 5 MB.</p>
                  </div>
                </div>
              </div>

              <label className="block space-y-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#8b90a0]">Họ và tên</span>
                <input className="w-full rounded-lg border border-[#414754] bg-[#0d131f] px-4 py-3 outline-none focus:border-[#adc7ff] focus:ring-2 focus:ring-[#adc7ff]/20" value={fullName} minLength={2} maxLength={100} required onChange={(event) => setFullName(event.target.value)} />
              </label>

              <label className="block space-y-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#8b90a0]">Email</span>
                <input className="w-full rounded-lg border border-[#414754] bg-[#0d131f] px-4 py-3 text-[#8b90a0]" value={user?.email ?? ''} readOnly />
              </label>

              <div className="flex justify-end border-t border-[#414754] pt-6">
                <button className="inline-flex items-center gap-2 rounded-lg bg-[#adc7ff] px-6 py-3 font-bold text-[#002e68] disabled:cursor-wait disabled:opacity-60" type="submit" disabled={isSaving || isLoading}>
                  {isSaving && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                  {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
