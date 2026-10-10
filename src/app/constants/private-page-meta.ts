import { PROJECT_DETAIL_SUBTITLE } from './project-detail';

export type PrivateSkeletonKind =
  | 'dashboard'
  | 'list'
  | 'project-detail'
  | 'insights'
  | 'calendar'
  | 'api-doc'
  | 'api-status'
  | 'simple';

export type ProjectDetailMode = 'create' | 'edit';

export type ListPageRowVariant = 'default' | 'employee' | 'project' | 'assignment';

export interface PrivatePageMeta {
  title: string;
  subtitle: string;
  icon: string;
  /** Loading mirror for the refresh placeholder; must match the page's own cold-load skeleton. */
  skeleton: PrivateSkeletonKind;
  /** KPI tile count for `list` skeleton (default 6). */
  listKpiCount?: number;
  /** Toolbar filter pill count for `list` skeleton (default 3). */
  listFilterCount?: number;
  /** Show pagination stub in list toolbar skeleton. */
  listShowPagination?: boolean;
  /** List row chip density for skeleton mirror. */
  listRowVariant?: ListPageRowVariant;
  /** Project detail mirror mode (create shows the draft title; edit pends the project name). */
  projectMode?: ProjectDetailMode;
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
    subtitle: PROJECT_DETAIL_SUBTITLE,
    icon: 'folder-kanban',
    skeleton: 'project-detail',
    projectMode: 'create',
  },
  '/update-project': {
    title: 'Project setup',
    subtitle: PROJECT_DETAIL_SUBTITLE,
    icon: 'pencil',
    skeleton: 'project-detail',
    projectMode: 'edit',
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
    skeleton: 'calendar',
  },
  '/api-doc': {
    title: 'API Documentation',
    subtitle: 'Complete API reference for Employee Management System',
    icon: 'file-text',
    skeleton: 'api-doc',
  },
  '/api-status': {
    title: 'API Status',
    subtitle: 'Monitor API health, performance, and activity in real-time',
    icon: 'activity',
    skeleton: 'api-status',
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
  if (path.startsWith('/update-project/') || path.startsWith('/new-project/')) {
    return PRIVATE_PAGE_META['/update-project'];
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
