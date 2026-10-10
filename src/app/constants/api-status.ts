/** Static API Status copy shared by the live page and its loading mirror. */
export type ApiStatusTabId = 'overview' | 'endpoints' | 'performance' | 'activity';

export const API_STATUS_TABS: readonly { id: ApiStatusTabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'endpoints', label: 'Endpoints' },
  { id: 'performance', label: 'Performance' },
  { id: 'activity', label: 'Activity' },
];

export const API_STATUS_TAB_ACTIVE_CLASS =
  'border-b-2 border-primary px-4 py-2 text-sm font-medium text-primary';
export const API_STATUS_TAB_IDLE_CLASS =
  'px-4 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white';

export const API_STATUS_COPY = {
  refresh: 'Refresh',
  refreshing: 'Refreshing...',
  overallStatus: 'Overall Status',
  lastUpdated: 'Last updated:',
  successRate: 'Success Rate',
  systemHealth: 'System Health',
  database: 'Database',
  apiService: 'API Service',
  responseTime: 'Response Time:',
  connected: 'Connected:',
  uptime: 'Uptime:',
  avgResponse: 'Avg Response:',
  dataStatistics: 'Data Statistics',
  refreshFailed: "Couldn't refresh. Showing data from",
  retry: 'Retry',
} as const;

/** Metric cards: label + static caption (`null` caption is data-driven). */
export const API_STATUS_METRIC_CARDS = [
  { label: 'Total Endpoints', caption: null, captionClass: 'text-green-400' },
  { label: 'Avg Response Time', caption: 'Last 24 hours', captionClass: 'text-white/60' },
  { label: 'Total Requests', caption: 'Last 7 days', captionClass: 'text-white/60' },
  { label: 'Error Rate', caption: 'Requires attention', captionClass: 'text-red-400' },
] as const;

export const API_STATUS_DATA_LABELS = [
  'Employees',
  'Projects',
  'Assignments',
  'Departments',
] as const;
