import type { KpiStatTone } from '@/app/components/ui/kpi-stat-card.component';
import { TAB_ACTIVE_CLASS, TAB_IDLE_CLASS } from './tabs';

/** Static API Status copy shared by the live page and its loading mirror. */
export type ApiStatusTabId = 'overview' | 'endpoints' | 'performance' | 'activity';

export const API_STATUS_TABS: readonly { id: ApiStatusTabId; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'layout-dashboard' },
  { id: 'endpoints', label: 'Endpoints', icon: 'server' },
  { id: 'performance', label: 'Performance', icon: 'gauge' },
  { id: 'activity', label: 'Activity', icon: 'activity' },
];

export const API_STATUS_TAB_ACTIVE_CLASS = TAB_ACTIVE_CLASS;
export const API_STATUS_TAB_IDLE_CLASS = TAB_IDLE_CLASS;

export const API_STATUS_COPY = {
  refresh: 'Refresh',
  refreshing: 'Refreshing…',
  overallStatus: 'Overall Status',
  lastUpdated: 'Last Updated:',
  successRate: 'Success Rate',
  systemHealth: 'System Health',
  database: 'Database',
  apiService: 'API Service',
  responseTime: 'Response Time:',
  connected: 'Connected:',
  uptime: 'Uptime:',
  avgResponse: 'Avg Response:',
  dataStatistics: 'Data Statistics',
  endpointHealth: 'Endpoint Health by Category',
  performanceHistory: 'Performance History (Last 7 Days)',
  recentActivity: 'Recent Activity',
  refreshFailed: "Couldn't refresh. Showing data from",
  retry: 'Retry',
  deliveries: 'Recent Email Deliveries',
  deliveriesEmpty: 'No email deliveries recorded yet.',
  deliveriesFailed: "Couldn't load email deliveries.",
} as const;

export const API_STATUS_SECTION_ICONS = {
  overallStatus: 'activity',
  systemHealth: 'shield-check',
  database: 'database',
  apiService: 'server',
  dataStatistics: 'chart-column',
  deliveries: 'mail',
  endpointHealth: 'server',
  performanceHistory: 'chart-line',
  recentActivity: 'activity',
} as const;

/** Skeleton rows shown while the delivery log loads. */
export const API_STATUS_DELIVERY_SKELETON_ROWS = [0, 1, 2] as const;

/** Metric cards; a `null` hint is data-driven (active endpoint count). */
export const API_STATUS_METRIC_CARDS: ReadonlyArray<{
  label: string;
  icon: string;
  tone: KpiStatTone;
  hint: string | null;
}> = [
  { label: 'Total Endpoints', icon: 'server', tone: 'sky', hint: null },
  { label: 'Avg Response Time', icon: 'timer', tone: 'violet', hint: 'Last 24 Hours' },
  { label: 'Total Requests', icon: 'chart-line', tone: 'emerald', hint: 'Last 7 Days' },
  { label: 'Error Rate', icon: 'triangle-alert', tone: 'rose', hint: 'Requires Attention' },
];

export const API_STATUS_DATA_CARDS: ReadonlyArray<{
  label: string;
  icon: string;
  tone: KpiStatTone;
}> = [
  { label: 'Employees', icon: 'users', tone: 'emerald' },
  { label: 'Projects', icon: 'folder-kanban', tone: 'sky' },
  { label: 'Assignments', icon: 'briefcase', tone: 'violet' },
  { label: 'Departments', icon: 'building-2', tone: 'amber' },
];
