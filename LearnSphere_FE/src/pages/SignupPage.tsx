import { useState, type FormEvent } from 'react';
import { api, clearSession, saveSession, type Role, type User } from '../services/api';

export function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>('student');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pendingTutor, setPendingTutor] = useState<User | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get('full_name') ?? '');
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');

    try {
      const auth = await api.register(fullName, email, password, role);

      if (!auth.access_token) {
        clearSession();

        if (auth.user.role === 'tutor' && auth.user.account_status === 'pending') {
          setPendingTutor(auth.user);
          return;
        }

        throw new Error('Đăng ký thành công nhưng hệ thống không cấp phiên đăng nhập. Vui lòng đăng nhập lại.');
      }

      saveSession({
        access_token: auth.access_token,
        token_type: auth.token_type ?? 'bearer',
        user: auth.user,
      });
      window.location.assign('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tạo tài khoản');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (pendingTutor) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d131f] px-4 text-[#dde2f4]">
        <main className="w-full max-w-lg rounded-2xl border border-[#414754] bg-[#161c28] p-8 text-center shadow-2xl md:p-10">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#ffc080]/10 text-[#ffc080]">
            <span className="material-symbols-outlined text-[36px]">hourglass_top</span>
          </div>
          <p className="mb-2 font-mono text-[12px] uppercase tracking-wider text-[#ffc080]">Đăng ký thành công</p>
          <h1 className="text-[30px] font-bold">Tài khoản đang chờ duyệt</h1>
          <p className="mt-4 leading-7 text-[#c1c6d7]">
            Tài khoản giảng viên của <strong className="text-[#dde2f4]">{pendingTutor.full_name}</strong> đã được tạo.
            Admin cần kích hoạt tài khoản trước khi bạn có thể đăng nhập.
          </p>
          <p className="mt-3 font-mono text-[13px] text-[#8b90a0]">{pendingTutor.email}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a className="rounded-lg bg-[#adc7ff] px-6 py-3 font-bold text-[#00285b]" href="/login">
              Đến trang đăng nhập
            </a>
            <a className="rounded-lg border border-[#414754] px-6 py-3 font-bold text-[#dde2f4]" href="/">
              Về trang chủ
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0d131f] px-4 py-8 text-[#dde2f4] md:px-8 md:py-10">
      <div className="mesh-gradient"></div>

      <main className="grid w-full max-w-[1200px] grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <section className="hidden flex-col gap-6 text-left lg:flex">
          <header>
            <h1 className="mb-2 text-[32px] font-bold tracking-[-0.01em] text-[#adc7ff]">LearnSphere</h1>
            <p className="max-w-md text-[18px] leading-7 text-[#c1c6d7]">
              Tham gia thế hệ chuyên gia mới đang làm chủ AI qua các lộ trình học cá nhân hóa.
            </p>
          </header>

          <div className="grid gap-6">
            {[
              {
                icon: 'psychology',
                title: 'Công cụ AI thích ứng',
                color: 'text-[#adc7ff]',
                border: 'border-l-[#adc7ff]',
                text: 'Chương trình học thay đổi theo tốc độ và khoảng trống kiến thức của bạn nhờ phản hồi LLM theo thời gian thực.',
              },
              {
                icon: 'hub',
                title: 'Hệ sinh thái cộng đồng',
                color: 'text-[#24dfba]',
                border: 'border-l-[#24dfba]',
                text: 'Kết nối với chuyên gia và bạn học trong trung tâm tài nguyên tích hợp.',
              },
            ].map((item) => (
              <div key={item.title} className={`glass-panel flex items-start gap-4 rounded-xl border-l-4 p-6 ${item.border}`}>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/5">
                  <span className={`material-symbols-outlined ${item.color}`} style={{ fontVariationSettings: '"FILL" 1' }}>
                    {item.icon}
                  </span>
                </div>
                <div>
                  <h3 className={`mb-1 text-[18px] font-bold ${item.color}`}>{item.title}</h3>
                  <p className="text-[14px] text-[#c1c6d7]">{item.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2">
            <div className="mb-4 flex -space-x-3">
              <div className="h-10 w-10 rounded-full border-2 border-[#0d131f] bg-[#2f3542]" />
              <div className="h-10 w-10 rounded-full border-2 border-[#0d131f] bg-[#242a37]" />
              <div className="h-10 w-10 rounded-full border-2 border-[#0d131f] bg-[#1a202c]" />
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#0d131f] bg-[#2f3542] text-[10px] font-bold text-[#dde2f4]">
                ...
              </div>
            </div>
            <p className="text-[12px] uppercase tracking-wider text-[#8b90a0]">Được tin dùng bởi chuyên gia trên toàn cầu</p>
          </div>
        </section>

        <section className="flex w-full justify-center">
          <div className="auth-card relative w-full max-w-md overflow-hidden rounded-2xl p-8 shadow-2xl md:p-10">
            <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-[#adc7ff]/10 blur-[80px]" />

            <div className="mb-8 text-center lg:text-left">
              <h2 className="mb-2 text-[32px] font-bold leading-10 tracking-[-0.01em] text-[#dde2f4]">Tạo tài khoản</h2>
              <p className="text-[#c1c6d7]">Bắt đầu hành trình với LearnSphere AI</p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-lg border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 px-4 py-3 text-sm text-[#ffb4ab]">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-[12px] font-medium uppercase tracking-tight text-[#c1c6d7]" htmlFor="full-name">
                  Họ và tên
                </label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-[#8b90a0] group-focus-within:text-[#adc7ff]">
                    person
                  </span>
                  <input
                    className="input-focus-ring w-full rounded-lg border border-[#414754] bg-[#080e1a] py-3 pl-10 pr-4 text-[#dde2f4] placeholder:text-[#8b90a0]/50 outline-none transition-all"
                    id="full-name"
                    name="full_name"
                    placeholder="Nguyễn Văn A"
                    type="text"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[12px] font-medium uppercase tracking-tight text-[#c1c6d7]" htmlFor="email">
                  Địa chỉ email
                </label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-[#8b90a0] group-focus-within:text-[#adc7ff]">
                    mail
                  </span>
                  <input
                    className="input-focus-ring w-full rounded-lg border border-[#414754] bg-[#080e1a] py-3 pl-10 pr-4 text-[#dde2f4] placeholder:text-[#8b90a0]/50 outline-none transition-all"
                    id="email"
                    name="email"
                    placeholder="name@company.com"
                    type="email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[12px] font-medium uppercase tracking-tight text-[#c1c6d7]" htmlFor="password">
                  Mật khẩu
                </label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-[#8b90a0] group-focus-within:text-[#adc7ff]">
                    lock
                  </span>
                  <input
                    className="input-focus-ring w-full rounded-lg border border-[#414754] bg-[#080e1a] py-3 pl-10 pr-12 text-[#dde2f4] placeholder:text-[#8b90a0]/50 outline-none transition-all"
                    id="password"
                    name="password"
                    placeholder="••••••••"
                    type={showPassword ? 'text' : 'password'}
                    required
                  />
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b90a0] transition-colors hover:text-[#dde2f4]"
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                <div className="mt-2 flex gap-1">
                  <div className="h-1 flex-1 rounded-full bg-[#adc7ff]/20" />
                  <div className="h-1 flex-1 rounded-full bg-[#2f3542]" />
                  <div className="h-1 flex-1 rounded-full bg-[#2f3542]" />
                  <div className="h-1 flex-1 rounded-full bg-[#2f3542]" />
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="block text-[12px] font-medium uppercase tracking-tight text-[#c1c6d7]">Vai trò</legend>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'student', label: 'Học viên' },
                    { value: 'tutor', label: 'Giảng viên' },
                  ].map((item) => (
                    <button
                      key={item.value}
                      className={`rounded-lg border px-4 py-3 font-mono text-[14px] transition-all ${
                        role === item.value ? 'border-[#adc7ff] bg-[#adc7ff]/10 text-[#adc7ff]' : 'border-[#414754] text-[#c1c6d7] hover:bg-[#2f3542]'
                      }`}
                      type="button"
                      onClick={() => setRole(item.value as Role)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="flex items-start gap-3 py-2">
                <input className="mt-1 h-4 w-4 cursor-pointer rounded border-[#414754] bg-[#080e1a] text-[#adc7ff] focus:ring-[#adc7ff]" id="terms" type="checkbox" required />
                <label className="select-none text-sm text-[#c1c6d7]" htmlFor="terms">
                  Tôi đồng ý với <a className="text-[#adc7ff] hover:underline" href="#">Điều khoản và điều kiện</a> cùng <a className="text-[#adc7ff] hover:underline" href="#">Chính sách bảo mật</a>.
                </label>
              </div>

              <button
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#adc7ff] py-4 font-bold text-[#00285b] shadow-lg shadow-[#adc7ff]/20 transition-all hover:shadow-[#adc7ff]/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80"
                type="submit"
                disabled={isSubmitting}
              >
                Tạo tài khoản
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
            </form>

            <div className="mt-10 text-center">
              <p className="text-[#c1c6d7]">
                Đã có tài khoản? <a className="ml-1 font-bold text-[#adc7ff] hover:underline" href="/login">Đăng nhập</a>
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-8 w-full py-8 text-center text-[12px] uppercase tracking-widest text-[#8b90a0] opacity-60">
        © 2024 LearnSphere AI. Empowering Intelligent Growth.
      </footer>
    </div>
  );
}
