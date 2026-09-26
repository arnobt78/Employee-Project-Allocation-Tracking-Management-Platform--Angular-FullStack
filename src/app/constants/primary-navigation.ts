export interface PrimaryNavItem {
  label: string;
  route: string;
  exact?: boolean;
  iconName: string;
}

/** Main app destinations shown in the shell header (and profile menu below xl). */
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

/**
 * Pathname usable before NavigationEnd (hard refresh).
 * Prefer Location — during bootstrap router.url can still be "/".
 */
export function resolveBrowserPath(
  locationPath: string,
  routerUrl: string,
  fallback = '/'
): string {
  const fromLocation = locationPath.split('?')[0];
  if (fromLocation) {
    return fromLocation.startsWith('/') ? fromLocation : `/${fromLocation}`;
  }

  const fromRouter = routerUrl.split('?')[0];
  if (fromRouter && fromRouter !== '/') {
    return fromRouter;
  }

  if (typeof window !== 'undefined' && window.location?.pathname) {
    return window.location.pathname;
  }

  return fallback;
}

/** Same exact/prefix rules as former routerLinkActiveOptions on primary nav. */
export function isPrimaryNavActive(
  path: string,
  item: PrimaryNavItem
): boolean {
  const current = path.split('?')[0];
  const route = item.route.startsWith('/') ? item.route : `/${item.route}`;
  if (item.exact) {
    return current === route;
  }
  return current === route || current.startsWith(`${route}/`);
}
