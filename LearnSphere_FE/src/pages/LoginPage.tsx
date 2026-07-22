import { useState, type FormEvent } from 'react';
import { BrandLogo } from '../components/BrandLogo';
import { api, saveSession } from '../services/api';

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [isSendingForgot, setIsSendingForgot] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');

    try {
      const auth = await api.login(email, password);
      saveSession(auth);
      const returnTo = new URLSearchParams(window.location.search).get('return_to');
      const safeReturnTo = returnTo?.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/dashboard';
      window.location.assign(safeReturnTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đăng nhập');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleForgotSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setForgotMessage('');
    if (!forgotEmail) return;

    setIsSendingForgot(true);
    try {
      const res = await api.forgotPassword(forgotEmail);
      setForgotMessage(res.message || 'Đã gửi liên kết đặt lại mật khẩu đến email của bạn.');
    } catch (err) {
      setForgotMessage(err instanceof Error ? err.message : 'Gửi yêu cầu thất bại');
    } finally {
      setIsSendingForgot(false);
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0d131f] text-[#dde2f4]">
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="animate-glow absolute left-[-10%] top-[-10%] h-[40%] w-[40%] rounded-full bg-[#adc7ff]/10 blur-[120px]" />
        <div
          className="animate-glow absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-[#24dfba]/10 blur-[120px]"
          style={{ animationDelay: '2s' }}
        />
      </div>

      <header className="sticky top-0 z-50 flex w-full items-center justify-between px-4 py-6 md:px-8 lg:px-10">
        <BrandLogo />
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-120px)] items-center justify-center px-4 py-10 md:px-8 lg:px-10">
        <div className="w-full max-w-[480px] space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-[32px] font-semibold leading-10 tracking-[-0.01em] text-[#dde2f4]">Chào mừng trở lại</h1>
            <p className="text-[16px] leading-6 text-[#c1c6d7]">Đăng nhập để tiếp tục hành trình học tập.</p>
          </div>

          <div className="auth-card glow-subtle rounded-xl p-8">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-lg border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 px-4 py-3 text-sm text-[#ffb4ab]">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[12px] font-medium uppercase tracking-wider text-[#8b90a0]" htmlFor="email">
                  Địa chỉ email
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-[#8b90a0]">
                    mail
                  </span>
                  <input
                    className="w-full rounded-lg border border-[#414754] bg-[#080e1a] py-3 pl-12 pr-4 text-[#dde2f4] placeholder:text-[#8b90a0]/50 focus:border-[#adc7ff] focus:outline-none focus:ring-2 focus:ring-[#adc7ff]/50"
                    id="email"
                    name="email"
                    placeholder="name@company.com"
                    type="email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-medium uppercase tracking-wider text-[#8b90a0]" htmlFor="password">
                    Mật khẩu
                  </label>
                  <button
                    type="button"
                    onClick={() => { setShowForgotModal(true); setForgotMessage(''); }}
                    className="text-[12px] font-medium text-[#adc7ff] transition-colors hover:text-[#4a8eff]"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-[#8b90a0]">
                    lock
                  </span>
                  <input
                    className="w-full rounded-lg border border-[#414754] bg-[#080e1a] py-3 pl-12 pr-12 text-[#dde2f4] placeholder:text-[#8b90a0]/50 focus:border-[#adc7ff] focus:outline-none focus:ring-2 focus:ring-[#adc7ff]/50"
                    id="password"
                    name="password"
                    placeholder="••••••••"
                    type={showPassword ? 'text' : 'password'}
                    required
                  />
                  <button
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8b90a0] transition-colors hover:text-[#dde2f4]"
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <button
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#adc7ff] py-4 font-bold text-[#00285b] transition-all hover:bg-[#4a8eff] hover:text-[#00285b] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80"
                type="submit"
                disabled={isSubmitting}
              >
                <span>{isSubmitting ? 'Đang xử lý...' : 'Đăng nhập'}</span>
                {!isSubmitting && <span className="material-symbols-outlined">arrow_forward</span>}
              </button>
            </form>
          </div>

          <p className="text-center text-[#c1c6d7]">
            Chưa có tài khoản? <a className="font-bold text-[#adc7ff] hover:underline" href="/signup">Đăng ký</a>
          </p>
        </div>
      </main>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[#414754] bg-[#161c28] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[20px] font-semibold text-[#dde2f4]">Quên mật khẩu</h3>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-[#8b90a0] hover:text-[#dde2f4]"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-[14px] text-[#c1c6d7]">
              Nhập email đăng ký tài khoản. Hệ thống sẽ gửi hướng dẫn đặt lại mật khẩu cho bạn.
            </p>

            <form onSubmit={handleForgotSubmit} className="space-y-4">
              {forgotMessage && (
                <div className="rounded-lg border border-[#adc7ff]/30 bg-[#adc7ff]/10 p-3 font-mono text-[13px] text-[#adc7ff]">
                  {forgotMessage}
                </div>
              )}

              <input
                type="email"
                required
                placeholder="name@company.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full rounded-lg border border-[#414754] bg-[#080e1a] px-4 py-3 text-[#dde2f4] focus:border-[#adc7ff] focus:outline-none"
              />

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="rounded-lg border border-[#414754] px-4 py-2 font-mono text-[13px] text-[#c1c6d7]"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSendingForgot}
                  className="rounded-lg bg-[#adc7ff] px-4 py-2 font-mono text-[13px] font-bold text-[#00285b] hover:bg-[#4a8eff] disabled:opacity-50"
                >
                  {isSendingForgot ? 'Đang gửi...' : 'Gửi yêu cầu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="z-10 flex w-full flex-col items-center justify-between gap-4 px-4 py-8 text-[#8b90a0] md:flex-row md:px-8 lg:px-10">
        <span className="text-[12px]">© 2024 LearnSphere AI. All rights reserved.</span>
        <div className="flex gap-6 text-[12px]">
          <a href="#">Chính sách bảo mật</a>
          <a href="#">Điều khoản dịch vụ</a>
          <a href="#">Hỗ trợ</a>
        </div>
      </footer>
    </div>
  );
}
