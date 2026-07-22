import { useEffect, useState, type ReactNode } from 'react';
import { HomePage } from './pages/HomePage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { CourseCatalogPage } from './pages/CourseCatalogPage';
import { DashboardPage } from './pages/DashboardPage';
import { LessonDetailPage } from './pages/LessonDetailPage';
import { LessonManagementPage } from './pages/LessonManagementPage';
import { LockedCoursesPage } from './pages/LockedCoursesPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { QuizPage } from './pages/QuizPage';
import { QuestionBuilderPage } from './pages/QuestionBuilderPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SignupPage } from './pages/SignupPage';
import { SystemMonitoringPage } from './pages/SystemMonitoringPage';
import { api, clearSession, getToken, saveSession, type Role, type User } from './services/api';

type RouteDefinition = {
  element: ReactNode;
  requiresAuth?: boolean;
  roles?: Role[];
};

function LoadingScreen({ message = 'Đang xác thực phiên đăng nhập...' }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d131f] px-4 text-[#dde2f4]">
      <div className="text-center">
        <span className="material-symbols-outlined mb-3 animate-spin text-[42px] text-[#adc7ff]">progress_activity</span>
        <p className="font-mono text-[13px] text-[#8b90a0]">{message}</p>
      </div>
    </div>
  );
}

function Redirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return <LoadingScreen message="Đang chuyển trang..." />;
}

function AccessDenied({ user }: { user: User }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d131f] px-4 text-[#dde2f4]">
      <section className="max-w-md rounded-xl border border-[#414754] bg-[#161c28] p-8 text-center">
        <span className="material-symbols-outlined mb-4 text-[48px] text-[#ffb4ab]">lock</span>
        <h1 className="text-[26px] font-semibold">Không có quyền truy cập</h1>
        <p className="mt-2 text-[#c1c6d7]">
          Tài khoản {user.full_name} không có quyền mở trang này.
        </p>
        <a className="mt-6 inline-flex rounded-lg bg-[#adc7ff] px-5 py-3 font-bold text-[#002e68]" href="/dashboard">
          Về bảng điều khiển
        </a>
      </section>
    </div>
  );
}

function getRoute(pathname: string): RouteDefinition {
  if (/^\/reset-password(?:\/[^/]+)?\/?$/.test(pathname)) {
    return { element: <ResetPasswordPage /> };
  }

  const routes: Record<string, RouteDefinition> = {
    '/': { element: <HomePage /> },
    '/login': { element: <LoginPage /> },
    '/signup': { element: <SignupPage /> },
    '/dashboard': { element: <DashboardPage />, requiresAuth: true },
    '/ai-assistant': { element: <AIAssistantPage />, requiresAuth: true, roles: ['student'] },
    '/courses': { element: <CourseCatalogPage /> },
    '/lesson-detail': { element: <LessonDetailPage />, requiresAuth: true },
    '/lesson-management': { element: <LessonManagementPage />, requiresAuth: true, roles: ['tutor', 'admin'] },
    '/locked-courses': { element: <LockedCoursesPage />, requiresAuth: true, roles: ['tutor', 'admin'] },
    '/quiz': { element: <QuizPage />, requiresAuth: true },
    '/question-builder': { element: <QuestionBuilderPage />, requiresAuth: true, roles: ['tutor', 'admin'] },
    '/system-monitoring': { element: <SystemMonitoringPage />, requiresAuth: true, roles: ['admin'] },
    '/admin-users': { element: <AdminUsersPage />, requiresAuth: true, roles: ['admin'] },
    '/profile': { element: <ProfilePage />, requiresAuth: true },
  };

  return routes[pathname] ?? routes['/'];
}

export default function App() {
  const pathname = window.location.pathname;
  const route = getRoute(pathname);
  const [authState, setAuthState] = useState<{ isLoading: boolean; user: User | null }>({
    isLoading: true,
    user: null,
  });

  useEffect(() => {
    let isActive = true;

    function markAnonymous() {
      if (isActive) setAuthState({ isLoading: false, user: null });
    }

    async function bootstrapAuth() {
      const token = getToken();
      if (!token) {
        clearSession();
        markAnonymous();
        return;
      }

      try {
        const user = await api.me();
        if (!isActive) return;

        saveSession({ access_token: token, token_type: 'bearer', user });
        setAuthState({ isLoading: false, user });
      } catch {
        clearSession();
        markAnonymous();
      }
    }

    window.addEventListener('learnsphere:unauthorized', markAnonymous);
    void bootstrapAuth();

    return () => {
      isActive = false;
      window.removeEventListener('learnsphere:unauthorized', markAnonymous);
    };
  }, []);

  if (authState.isLoading) {
    return <LoadingScreen />;
  }

  if (route.requiresAuth && !authState.user) {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    return <Redirect to={`/login?return_to=${encodeURIComponent(returnTo)}`} />;
  }

  if (authState.user && route.roles && !route.roles.includes(authState.user.role)) {
    return <AccessDenied user={authState.user} />;
  }

  if (authState.user && (pathname === '/login' || pathname === '/signup')) {
    return <Redirect to="/dashboard" />;
  }

  return route.element;
}
