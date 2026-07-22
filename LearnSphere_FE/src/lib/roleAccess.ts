import type { Course, Role, User } from '../services/api';

export type NavItem = {
  href: string;
  icon: string;
  label: string;
  roles?: Role[];
};

export const roleLabels: Record<Role, string> = {
  student: 'Học viên',
  tutor: 'Giảng viên',
  admin: 'Quản trị viên',
};

export function getRoleLabel(role?: string) {
  if (role === 'student' || role === 'tutor' || role === 'admin') {
    return roleLabels[role];
  }

  return 'Khách';
}

export function getUserId(user?: User | null) {
  return user?._id ?? user?.id ?? '';
}

export function canManageContent(user?: User | null) {
  return user?.role === 'tutor' || user?.role === 'admin';
}

export function canManageSystem(user?: User | null) {
  return user?.role === 'admin';
}

export function canStudy(user?: User | null) {
  return user?.role === 'student';
}

export function getCourseOwnerId(course: Course) {
  return (typeof course.created_by === 'object' ? course.created_by._id : course.created_by) ?? '';
}

export function isCourseOwner(user: User | null | undefined, course: Course) {
  if (user?.role !== 'tutor') return false;

  const userId = getUserId(user);
  const creatorId = getCourseOwnerId(course);

  return Boolean(userId && creatorId && userId === creatorId);
}

export function canModerateCourse(user: User | null | undefined, course: Course) {
  return user?.role === 'admin' && !isCourseOwner(user, course);
}

export function getRoleNav(user?: User | null): NavItem[] {
	const role = user?.role;
	if (!role) {
		return [{ href: "/courses", icon: "school", label: "Khóa học" }];
	}

	const items: NavItem[] = [
    { href: '/dashboard', icon: 'dashboard', label: 'Bảng điều khiển' },
    { href: '/courses', icon: 'school', label: 'Khóa học' },
    { href: '/my-courses', icon: 'menu_book', label: 'Khóa học của tôi', roles: ['student'] },
    { href: '/ai-assistant', icon: 'smart_toy', label: 'Trợ lý AI', roles: ['student'] },
    { href: '/quiz', icon: 'quiz', label: 'Quiz', roles: ['student'] },
    { href: '/lesson-management', icon: 'auto_stories', label: 'Quản lý khóa học', roles: ['tutor', 'admin'] },
    { href: '/locked-courses', icon: 'lock_open', label: 'Khóa học bị khóa', roles: ['tutor', 'admin'] },
    { href: '/question-builder', icon: 'quiz', label: 'Quản lý quiz', roles: ['tutor', 'admin'] },
    { href: '/admin-users', icon: 'group', label: 'Quản lý tài khoản', roles: ['admin'] },
    { href: '/system-monitoring', icon: 'monitoring', label: 'Giám sát hệ thống', roles: ['admin'] },
    { href: '/profile', icon: 'person', label: 'Hồ sơ' },
  ];

  return items.filter((item) => !item.roles || item.roles.includes(role));
}
