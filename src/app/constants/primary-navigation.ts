export interface PrimaryNavItem {
  label: string;
  route: string;
  exact?: boolean;
  iconName: string;
}

/** Main app destinations shown in the shell header (and mobile drawer). */
export const PRIMARY_NAVIGATION_ITEMS: PrimaryNavItem[] = [
  {
    label: 'Dashboard',
    route: '/dashboard',
    exact: true,
    iconName: 'layout-dashboard',
  },
  {
    label: 'Employees',
    route: '/employee',
    iconName: 'users',
  },
  {
    label: 'Projects',
    route: '/projects',
    iconName: 'folder-kanban',
  },
  {
    label: 'Project Team',
    route: '/project-employee',
    iconName: 'contact',
  },
  {
    label: 'Business Insights',
    route: '/business-insights',
    iconName: 'chart-column',
  },
  {
    label: 'Calendar & Timeline',
    route: '/calendar-timeline',
    iconName: 'calendar-range',
  },
];

export const HELP_URL = 'https://www.arnobmahmud.com/';

/** Paths that should paint private chrome immediately (before NavigationEnd). */
export const PRIVATE_SHELL_PREFIXES = [
  '/dashboard',
  '/employee',
  '/projects',
  '/new-project',
  '/update-project',
  '/project-employee',
  '/business-insights',
  '/calendar-timeline',
  '/api-doc',
  '/api-status',
] as const;

export function isPrivateShellUrl(url: string): boolean {
  const path = url.split('?')[0];
  if (path === '/' || path.startsWith('/login')) {
    return false;
  }
  return PRIVATE_SHELL_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}
