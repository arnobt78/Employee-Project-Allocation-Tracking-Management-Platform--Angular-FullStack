export type PrivateSkeletonKind =
  | 'dashboard'
  | 'list'
  | 'insights'
  | 'simple'
  | 'project-form';

export type ListPageRowVariant = 'default' | 'employee' | 'project' | 'assignment';

export interface PrivatePageMeta {
  title: string;
  subtitle: string;
  icon: string;
  /** Shape of the shared refresh placeholder (not the page’s own data skeleton). */
  skeleton: PrivateSkeletonKind;
  /** KPI tile count for `list` skeleton (default 6). */
  listKpiCount?: number;
  /** Toolbar filter pill count for `list` skeleton (default 3). */
  listFilterCount?: number;
  /** Show pagination stub in list toolbar skeleton. */
  listShowPagination?: boolean;
  /** List row chip density for skeleton mirror. */
  listRowVariant?: ListPageRowVariant;
}

/** Static page chrome for instant refresh paint (matches app-page-header copy). */
export const PRIVATE_PAGE_META: Record<string, PrivatePageMeta> = {
  '/dashboard': {
    title: 'Operations Command Center',
    subtitle:
      'Live workforce capacity, delivery health, and assignment coverage across EmpowerHub',
    icon: 'layout-dashboard',
    skeleton: 'dashboard',
  },
  '/employee': {
    title: 'Employees',
    subtitle: 'Search, add, and manage your organisation workforce',
    icon: 'users',
    skeleton: 'list',
    listKpiCount: 6,
    listFilterCount: 4,
    listShowPagination: true,
    listRowVariant: 'employee',
  },
  '/projects': {
    title: 'Projects',
    subtitle: 'Create, track, and update project delivery status',
    icon: 'folder-kanban',
    skeleton: 'list',
    listKpiCount: 6,
    listFilterCount: 2,
    listShowPagination: true,
    listRowVariant: 'project',
  },
  '/new-project': {
    title: 'Untitled project',
    subtitle:
      'Configure the essentials before rolling the project out to your teams. Organize the information into focused sections, edit inline, and save when you are ready.',
    icon: 'folder-kanban',
    skeleton: 'project-form',
  },
  '/update-project': {
    title: 'Project setup',
    subtitle:
      'Configure the essentials before rolling the project out to your teams. Organize the information into focused sections, edit inline, and save when you are ready.',
    icon: 'pencil',
    skeleton: 'project-form',
  },
  '/project-employee': {
    title: 'Project Team',
    subtitle: 'Assign teammates to projects and track allocation',
    icon: 'contact',
    skeleton: 'list',
    listKpiCount: 6,
    listFilterCount: 3,
    listShowPagination: true,
    listRowVariant: 'assignment',
  },
  '/business-insights': {
    title: 'Business Insights',
    subtitle: 'Analytics and reporting for projects, resources, and performance',
    icon: 'chart-column',
    skeleton: 'insights',
  },
  '/calendar-timeline': {
    title: 'Calendar & Timeline',
    subtitle: 'View project milestones, timelines, and due date reminders',
    icon: 'calendar-range',
    skeleton: 'insights',
  },
  '/api-doc': {
    title: 'API Documentation',
    subtitle: 'Complete API reference for Employee Management System',
    icon: 'file-text',
    skeleton: 'simple',
  },
  '/api-status': {
    title: 'API Status',
    subtitle: 'Monitor API health, performance, and activity in real-time',
    icon: 'activity',
    skeleton: 'simple',
  },
};

const DEFAULT_PAGE_META: PrivatePageMeta = {
  title: 'EmpowerHub',
  subtitle: 'Loading workspace…',
  icon: 'layout-dashboard',
  skeleton: 'simple',
};

export function resolvePrivatePageMeta(url: string): PrivatePageMeta {
  const path = url.split('?')[0] || '/';
  if (PRIVATE_PAGE_META[path]) {
    return PRIVATE_PAGE_META[path];
  }
  if (path.startsWith('/update-project/')) {
    return PRIVATE_PAGE_META['/update-project'];
  }
  if (path.startsWith('/new-project/')) {
    return PRIVATE_PAGE_META['/new-project'];
  }
  const prefixes = Object.keys(PRIVATE_PAGE_META).sort(
    (a, b) => b.length - a.length
  );
  for (const prefix of prefixes) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return PRIVATE_PAGE_META[prefix];
    }
  }
  return DEFAULT_PAGE_META;
}
