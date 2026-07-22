import { BrandLogo } from '../components/BrandLogo';
import { SphereAIButton } from '../components/SphereAIButton';

const heroImage =
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1800&q=80';
const learningImage =
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80';

export function HomePage() {
  return (
    <div className="min-h-screen bg-[#0d131f] text-[#dde2f4]">
      <nav className="fixed left-0 right-0 top-0 z-50 h-20 border-b border-white/5 bg-[#0d131f]/90 shadow-sm backdrop-blur-md transition-all duration-300">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 md:px-8">
          <BrandLogo iconClassName="text-[30px]" textClassName="text-[24px]" />

          <div className="flex items-center gap-3">
            <a className="text-sm font-medium text-[#c1c6d7] transition-colors hover:text-[#adc7ff]" href="/login">
              Đăng nhập
            </a>
            <a className="rounded-lg bg-[#adc7ff] px-6 py-2.5 text-sm font-bold text-[#00285b] transition-transform active:scale-95" href="/signup">
              Đăng ký
            </a>
          </div>
        </div>
      </nav>

      <main className="relative pt-20">
        <section className="relative min-h-[calc(100vh-80px)] overflow-hidden bg-[#0d131f]">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroImage})` }} />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,19,31,0.98)_0%,rgba(13,19,31,0.88)_38%,rgba(13,19,31,0.42)_72%,rgba(13,19,31,0.78)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#0d131f] to-transparent" />

          <div className="relative z-10 mx-auto flex min-h-[calc(100vh-80px)] max-w-7xl items-center px-4 py-12 md:px-8 lg:px-10">
            <div className="relative max-w-4xl rounded-2xl border border-white/10 bg-[#0d131f]/64 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl md:p-8 lg:p-10">
              <div className="pointer-events-none absolute -inset-px rounded-2xl bg-[linear-gradient(135deg,rgba(173,199,255,0.26),rgba(36,223,186,0.1),rgba(255,192,128,0.14))] opacity-80" />

              <div className="relative space-y-7">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#24dfba]/25 bg-[#24dfba]/10 px-3 py-1 text-[#24dfba]">
                  <span className="material-symbols-outlined text-[18px]">school</span>
                  <span className="font-mono text-[12px] font-bold uppercase tracking-wide">Nền tảng học trực tuyến</span>
                </div>

                <div>
                  <h1 className="text-[44px] font-bold leading-[1.08] text-[#050a14] md:text-[64px]">
                    LearnSphere
                  </h1>
                  <p className="mt-5 max-w-3xl text-[18px] font-medium leading-8 text-[#111827] md:text-[20px]">
                    Học viên đăng ký khóa học, theo dõi tiến độ, làm quiz và nhận hỗ trợ học tập từ AI trong một không gian học tập rõ ràng, dễ sử dụng.
                  </p>
                </div>

                <div className="flex flex-wrap gap-4 pt-2">
                  <a className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#adc7ff] px-8 py-4 text-[16px] font-bold text-[#00285b] shadow-lg shadow-[#adc7ff]/25 transition-all hover:brightness-110 active:scale-95" href="/courses">
                    Khám phá khóa học
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </a>
                  <a className="inline-flex items-center justify-center rounded-xl border border-[#111827]/20 bg-white/80 px-8 py-4 text-[16px] font-semibold text-[#111827] shadow-sm backdrop-blur transition-all hover:border-[#00285b]/40 hover:bg-white" href="/login">
                    Tiếp tục học
                  </a>
                </div>

                <div className="grid max-w-3xl grid-cols-1 gap-3 pt-3 sm:grid-cols-3">
                  {[
                    ['Theo dõi', 'tiến độ học'],
                    ['Luyện tập', 'bằng quiz'],
                    ['Hỗ trợ', 'bởi AI'],
                  ].map(([title, text]) => (
                    <div key={title} className="rounded-xl border border-[#111827]/10 bg-white/75 p-4 shadow-lg shadow-black/10 backdrop-blur">
                      <strong className="block text-[20px] text-[#111827]">{title}</strong>
                      <span className="mt-1 block text-[13px] leading-5 text-[#344055]">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-y border-[#414754]/20 bg-[#161c28] py-14 md:py-16">
          <div className="mx-auto max-w-7xl px-4 md:px-8 lg:px-10">
            <div className="mb-10 max-w-3xl">
              <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-[#24dfba]">Tập trung vào việc học thật</p>
              <h2 className="mt-3 text-[32px] font-semibold leading-10 text-[#dde2f4]">Những công cụ cần thiết cho một khóa học trực tuyến</h2>
              <p className="mt-3 text-[16px] leading-7 text-[#c1c6d7]">
                LearnSphere gom các hoạt động học tập thường ngày vào một nơi: học bài, xem tài liệu, làm kiểm tra, theo dõi kết quả và nhận hỗ trợ khi cần.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  icon: 'auto_stories',
                  title: 'Khóa học có lộ trình rõ ràng',
                  text: 'Học viên xem bài học, video, tài liệu và tiếp tục học theo đúng tiến độ của mình.',
                  tone: 'text-[#adc7ff]',
                },
                {
                  icon: 'trending_up',
                  title: 'Theo dõi tiến độ học tập',
                  text: 'Mỗi khóa học hiển thị số bài đã hoàn thành, trạng thái học và mức độ hoàn thành.',
                  tone: 'text-[#24dfba]',
                },
                {
                  icon: 'quiz',
                  title: 'Quiz kiểm tra kiến thức',
                  text: 'Học viên làm bài kiểm tra, xem kết quả và biết phần nào cần ôn tập thêm.',
                  tone: 'text-[#ffc080]',
                },
                {
                  icon: 'smart_toy',
                  title: 'Trợ lý AI hỗ trợ học tập',
                  text: 'AI giúp giải thích khái niệm, gợi ý hướng học và hỗ trợ khi học viên gặp khó khăn.',
                  tone: 'text-[#d5b8ff]',
                },
              ].map((item) => (
                <article key={item.title} className="rounded-xl border border-white/5 bg-[#0d131f] p-5 shadow-xl shadow-black/20 transition hover:border-[#adc7ff]/30">
                  <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-white/5 ${item.tone}`}>
                    <span className="material-symbols-outlined text-[28px]">{item.icon}</span>
                  </div>
                  <h3 className="text-[20px] font-semibold leading-7 text-[#dde2f4]">{item.title}</h3>
                  <p className="mt-3 text-[14px] leading-6 text-[#c1c6d7]">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-[#414754]/20 bg-[#0d131f] py-14 md:py-16">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 md:px-8 lg:grid-cols-2 lg:px-10">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#161f2e]/70 shadow-2xl shadow-black/25">
              <img className="aspect-[4/3] w-full object-cover" src={learningImage} alt="Học viên học trực tuyến" />
            </div>

            <div className="space-y-6">
              <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-[#ffc080]">Dành cho từng vai trò</p>
              <h2 className="text-[32px] font-semibold leading-10 text-[#dde2f4]">Một nền tảng, nhiều luồng sử dụng rõ ràng</h2>
              <div className="space-y-4">
                {[
                  {
                    icon: 'person',
                    title: 'Học viên',
                    text: 'Đăng ký khóa học, học bài, làm quiz, theo dõi tiến độ và quay lại đúng khóa đang học.',
                  },
                  {
                    icon: 'co_present',
                    title: 'Giảng viên',
                    text: 'Tạo khóa học, thêm bài học, cập nhật thumbnail, quản lý quiz và duyệt đăng ký.',
                  },
                  {
                    icon: 'admin_panel_settings',
                    title: 'Quản trị viên',
                    text: 'Quản lý tài khoản, kiểm duyệt khóa học và theo dõi tình trạng hoạt động của hệ thống.',
                  },
                ].map((item) => (
                  <article key={item.title} className="flex gap-4 rounded-xl border border-white/5 bg-[#161c28] p-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#adc7ff]/10 text-[#adc7ff]">
                      <span className="material-symbols-outlined">{item.icon}</span>
                    </span>
                    <div>
                      <h3 className="text-[18px] font-semibold text-[#dde2f4]">{item.title}</h3>
                      <p className="mt-1 text-[14px] leading-6 text-[#c1c6d7]">{item.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 text-center md:px-8 lg:px-10">
          <div className="mx-auto max-w-3xl rounded-2xl border border-white/5 bg-[#161c28] px-6 py-12 shadow-2xl shadow-black/25">
            <h2 className="text-[36px] font-bold leading-tight text-[#dde2f4] md:text-[46px]">Bắt đầu học theo cách chủ động hơn</h2>
            <p className="mx-auto mt-4 max-w-2xl text-[17px] leading-7 text-[#c1c6d7]">
              Khám phá khóa học phù hợp và theo dõi toàn bộ hành trình học tập của bạn trong LearnSphere.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a className="rounded-xl bg-[#adc7ff] px-9 py-4 text-[15px] font-bold text-[#00285b] transition-all hover:brightness-110 active:scale-95" href="/courses">
                Xem khóa học
              </a>
              <a className="rounded-xl border border-[#414754] bg-[#242a37] px-9 py-4 text-[15px] font-semibold text-[#dde2f4] transition-all hover:border-[#adc7ff]/60 hover:text-[#adc7ff]" href="/signup">
                Tạo tài khoản
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer id="resources" className="border-t border-[#414754] bg-[#0d131f] px-4 py-10 md:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row md:items-end">
          <div className="flex flex-col items-center gap-2 md:items-start">
            <BrandLogo iconClassName="text-[30px]" textClassName="text-[24px]" />
            <p className="max-w-xs text-center text-[12px] leading-5 text-[#c1c6d7] md:text-left">
              © 2026 LearnSphere. Nền tảng học trực tuyến có AI hỗ trợ.
            </p>
          </div>
          <div className="flex gap-4 font-mono text-[12px] text-[#8b90a0]">
            <a className="hover:text-[#adc7ff]" href="/courses">Khóa học</a>
            <a className="hover:text-[#adc7ff]" href="/login">Đăng nhập</a>
            <a className="hover:text-[#adc7ff]" href="/signup">Đăng ký</a>
          </div>
        </div>
      </footer>

      <SphereAIButton />
    </div>
  );
}
