export type InsightsTabId = 'overview' | 'projects' | 'resources' | 'financials';

export const INSIGHTS_TABS: ReadonlyArray<{ id: InsightsTabId; label: string }> =
  [
    { id: 'overview', label: 'Overview' },
    { id: 'projects', label: 'Projects' },
    { id: 'resources', label: 'Resources' },
    { id: 'financials', label: 'Financials' },
  ];

export const INSIGHTS_FILTER_LABELS = {
  dateRange: 'Date Range',
  department: 'Department',
} as const;

export const INSIGHTS_DEFAULT_FILTER_DISPLAY = {
  dateRange: { label: 'All Time', icon: 'infinity' },
  department: { label: 'All Departments', icon: 'building-2' },
} as const;

export const INSIGHTS_KPI_LABELS = [
  'Total Projects',
  'Total Employees',
  'Avg Readiness',
  'Resource Utilization',
] as const;

export const INSIGHTS_STATUS_DISTRIBUTION_TITLE = 'Project Status Distribution';

export const INSIGHTS_READINESS_DISTRIBUTION_TITLE =
  'Readiness Score Distribution';

export const INSIGHTS_READINESS_RANGES = [
  '0-25%',
  '26-50%',
  '51-75%',
  '76-100%',
] as const;

export type InsightsStatusKey =
  | 'draft'
  | 'in_progress'
  | 'completed'
  | 'on_hold'
  | 'cancelled';

export const INSIGHTS_STATUS_ITEMS: ReadonlyArray<{
  key: InsightsStatusKey;
  label: string;
  color: string;
}> = [
  { key: 'draft', label: 'Draft', color: 'bg-slate-500' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-blue-500' },
  { key: 'completed', label: 'Completed', color: 'bg-green-500' },
  { key: 'on_hold', label: 'On Hold', color: 'bg-yellow-500' },
  { key: 'cancelled', label: 'Cancelled', color: 'bg-red-500' },
];
