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

export default function App() {
  const pathname = window.location.pathname;

  if (pathname === '/reset-password') {
    return <ResetPasswordPage />;
  }

  if (pathname === '/dashboard') {
    return <DashboardPage />;
  }

  if (pathname === '/ai-assistant') {
    return <AIAssistantPage />;
  }

  if (pathname === '/courses') {
    return <CourseCatalogPage />;
  }

  if (pathname === '/lesson-detail') {
    return <LessonDetailPage />;
  }

  if (pathname === '/lesson-management') {
    return <LessonManagementPage />;
  }

  if (pathname === '/locked-courses') {
    return <LockedCoursesPage />;
  }

  if (pathname === '/quiz') {
    return <QuizPage />;
  }

  if (pathname === '/question-builder') {
    return <QuestionBuilderPage />;
  }

  if (pathname === '/system-monitoring') {
    return <SystemMonitoringPage />;
  }

  if (pathname === '/admin-users') {
    return <AdminUsersPage />;
  }

  if (pathname === '/login') {
    return <LoginPage />;
  }

  if (pathname === '/profile') {
    return <ProfilePage />;
  }

  if (pathname === '/signup') {
    return <SignupPage />;
  }

  return <HomePage />;
}
