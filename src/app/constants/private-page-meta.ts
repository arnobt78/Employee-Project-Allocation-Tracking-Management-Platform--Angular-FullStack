export interface PrivatePageMeta {
  title: string;
  subtitle: string;
  icon: string;
}

/** Static page chrome for instant refresh paint (matches app-page-header copy). */
export const PRIVATE_PAGE_META: Record<string, PrivatePageMeta> = {
  '/dashboard': {
    title: 'Dashboard',
    subtitle:
      'Monitor workforce, projects, and assignment health in one place',
    icon: 'layout-dashboard',
  },
  '/employee': {
    title: 'Employees',
    subtitle: 'Search, add, and manage your organisation workforce',
    icon: 'users',
  },
  '/projects': {
    title: 'Projects',
    subtitle: 'Create, track, and update project delivery status',
    icon: 'folder-kanban',
  },
  '/new-project': {
    title: 'Untitled project',
    subtitle:
      'Configure the essentials before rolling the project out to your teams. Organize the information into focused sections, edit inline, and save when you are ready.',
    icon: 'folder-kanban',
  },
  '/update-project': {
    title: 'Project setup',
    subtitle:
      'Configure the essentials before rolling the project out to your teams. Organize the information into focused sections, edit inline, and save when you are ready.',
    icon: 'pencil',
  },
  '/project-employee': {
    title: 'Project Team',
    subtitle: 'Assign teammates to projects and track allocation',
    icon: 'contact',
  },
  '/business-insights': {
    title: 'Business Insights',
    subtitle: 'Analytics and reporting for projects, resources, and performance',
    icon: 'chart-column',
  },
  '/calendar-timeline': {
    title: 'Calendar & Timeline',
    subtitle: 'View project milestones, timelines, and due date reminders',
    icon: 'calendar-range',
  },
  '/api-doc': {
    title: 'API Documentation',
    subtitle: 'Complete API reference for Employee Management System',
    icon: 'file-text',
  },
  '/api-status': {
    title: 'API Status',
    subtitle: 'Monitor API health, performance, and activity in real-time',
    icon: 'activity',
  },
};

const DEFAULT_PAGE_META: PrivatePageMeta = {
  title: 'EmpowerHub',
  subtitle: 'Loading workspace…',
  icon: 'layout-dashboard',
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
