import { useState, type FormEvent } from 'react';
import { api } from '../services/api';

export function ResetPasswordPage() {
  const params = new URLSearchParams(window.location.search);
  const pathToken = window.location.pathname.match(/^\/reset-password\/([^/]+)\/?$/)?.[1];
  const token = pathToken ?? params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (!token) {
      setMessage('Token không hợp lệ hoặc đã hết hạn.');
      return;
    }

    if (password.length < 6) {
      setMessage('Mật khẩu mới phải từ 6 ký tự trở lên.');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Mật khẩu nhập lại không khớp.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await api.resetPassword(token, password);
      setMessage(result.message || 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập lại.');
      setIsSuccess(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Đặt lại mật khẩu thất bại');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0d131f] text-[#dde2f4]">
      <header className="sticky top-0 z-50 flex w-full items-center justify-between px-4 py-6 md:px-8 lg:px-10">
        <a className="flex items-center gap-2" href="/">
          <span className="material-symbols-outlined text-[30px] text-[#adc7ff]" style={{ fontVariationSettings: '"FILL" 1' }}>
            school
          </span>
          <span className="text-[24px] font-bold text-[#adc7ff]">LearnSphere</span>
        </a>
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-120px)] items-center justify-center px-4 py-10 md:px-8 lg:px-10">
        <div className="w-full max-w-[480px] space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-[32px] font-semibold leading-10 tracking-[-0.01em] text-[#dde2f4]">Đặt lại mật khẩu</h1>
            <p className="text-[16px] leading-6 text-[#c1c6d7]">Nhập mật khẩu mới cho tài khoản của bạn.</p>
          </div>

          <div className="auth-card glow-subtle rounded-xl p-8 border border-[#414754]/50 bg-[#161c28]">
            {isSuccess ? (
              <div className="space-y-6 text-center">
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-400">
                  {message}
                </div>
                <a
                  href="/login"
                  className="block w-full rounded-lg bg-[#adc7ff] py-4 font-bold text-[#00285b] hover:bg-[#4a8eff] transition"
                >
                  Đến trang Đăng nhập
                </a>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit}>
                {message && (
                  <div className="rounded-lg border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 px-4 py-3 text-sm text-[#ffb4ab]">
                    {message}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[12px] font-medium uppercase tracking-wider text-[#8b90a0]">
                    Mật khẩu mới
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-[#8b90a0]">
                      lock
                    </span>
                    <input
                      className="w-full rounded-lg border border-[#414754] bg-[#080e1a] py-3 pl-12 pr-12 text-[#dde2f4] focus:border-[#adc7ff] focus:outline-none"
                      placeholder="••••••••"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8b90a0]"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[12px] font-medium uppercase tracking-wider text-[#8b90a0]">
                    Xác nhận mật khẩu mới
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-[#8b90a0]">
                      lock_reset
                    </span>
                    <input
                      className="w-full rounded-lg border border-[#414754] bg-[#080e1a] py-3 pl-12 pr-4 text-[#dde2f4] focus:border-[#adc7ff] focus:outline-none"
                      placeholder="••••••••"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#adc7ff] py-4 font-bold text-[#00285b] transition-all hover:bg-[#4a8eff] disabled:opacity-70"
                  type="submit"
                  disabled={isSubmitting}
                >
                  <span>{isSubmitting ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
