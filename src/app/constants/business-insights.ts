import type { KpiStatTone } from '@/app/components/ui/kpi-stat-card.component';
import type { StatusTone } from '@/app/lib/status/project-status';
import { TAB_ACTIVE_CLASS, TAB_IDLE_CLASS } from './tabs';

export type InsightsTabId = 'overview' | 'projects' | 'resources' | 'financials';

export const INSIGHTS_TABS: ReadonlyArray<{
  id: InsightsTabId;
  label: string;
  icon: string;
}> = [
  { id: 'overview', label: 'Overview', icon: 'layout-dashboard' },
  { id: 'projects', label: 'Projects', icon: 'folder-kanban' },
  { id: 'resources', label: 'Resources', icon: 'users' },
  { id: 'financials', label: 'Financials', icon: 'wallet' },
];

export const INSIGHTS_TAB_ACTIVE_CLASS = TAB_ACTIVE_CLASS;

export const INSIGHTS_TAB_IDLE_CLASS = TAB_IDLE_CLASS;

export const INSIGHTS_FILTER_LABELS = {
  dateRange: 'Date Range',
  department: 'Department',
  startDate: 'Start Date',
  endDate: 'End Date',
} as const;

export const INSIGHTS_FILTER_ICONS = {
  dateRange: 'calendar-range',
  department: 'building-2',
  startDate: 'calendar',
  endDate: 'calendar-check',
} as const;

export const INSIGHTS_DEFAULT_FILTER_DISPLAY = {
  dateRange: { label: 'All Time', icon: 'infinity' },
  department: { label: 'All Departments', icon: 'building-2' },
} as const;

export interface InsightsKpi {
  label: string;
  icon: string;
  tone: KpiStatTone;
}

export const INSIGHTS_KPIS: readonly InsightsKpi[] = [
  { label: 'Projects', icon: 'folder-kanban', tone: 'sky' },
  { label: 'Total Employees', icon: 'users', tone: 'emerald' },
  { label: 'Avg Readiness', icon: 'gauge', tone: 'violet' },
  { label: 'Resource Utilization', icon: 'percent', tone: 'amber' },
];

export const INSIGHTS_RESOURCE_KPIS: readonly InsightsKpi[] = [
  { label: 'Total Employees', icon: 'users', tone: 'emerald' },
  { label: 'Active Assignments', icon: 'briefcase', tone: 'sky' },
  { label: 'Average Allocation', icon: 'percent', tone: 'amber' },
  { label: 'Available Resources', icon: 'user-check', tone: 'violet' },
];

export const INSIGHTS_BUDGET_KPIS: readonly InsightsKpi[] = [
  { label: 'Total Budget', icon: 'wallet', tone: 'sky' },
  { label: 'Allocated', icon: 'briefcase', tone: 'violet' },
  { label: 'Spent', icon: 'trending-up', tone: 'amber' },
  { label: 'Remaining', icon: 'dollar-sign', tone: 'emerald' },
];

export const INSIGHTS_SECTION_ICONS = {
  status: 'chart-pie',
  readiness: 'gauge',
  departments: 'building-2',
  projectTypes: 'layers',
  resources: 'users',
  capacity: 'activity',
  budget: 'wallet',
  budgetStatus: 'info',
} as const;

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
  icon: string;
  tone: KpiStatTone;
}> = [
  { key: 'draft', label: 'Draft', icon: 'pencil', tone: 'violet' },
  { key: 'in_progress', label: 'In Progress', icon: 'loader', tone: 'sky' },
  { key: 'completed', label: 'Completed', icon: 'circle-check', tone: 'sky' },
  { key: 'on_hold', label: 'On Hold', icon: 'pause-circle', tone: 'slate' },
  { key: 'cancelled', label: 'Cancelled', icon: 'circle-x', tone: 'rose' },
];

export type InsightsCountKey =
  | 'filteredProjectCount'
  | 'archivedProjectCount'
  | 'activeProjectCount'
  | 'inactiveProjectCount'
  | 'planningProjectCount'
  | 'assignedProjectCount'
  | 'nonAssignedProjectCount';

/** Project breakdown chips; `optional` chips hide when their count is zero. */
export const INSIGHTS_BREAKDOWN_CHIPS: ReadonlyArray<{
  key: InsightsCountKey;
  label: string;
  title: string;
  icon: string;
  tone: StatusTone;
  optional: boolean;
}> = [
  {
    key: 'filteredProjectCount',
    label: 'Active',
    title: 'Active (non-archived) projects, used for all calculations below',
    icon: 'layers',
    tone: 'sky',
    optional: false,
  },
  {
    key: 'archivedProjectCount',
    label: 'Archived',
    title: 'Archived projects (excluded from calculations, display only)',
    icon: 'archive',
    tone: 'slate',
    optional: false,
  },
  {
    key: 'activeProjectCount',
    label: 'Active',
    title: 'Projects with active assignments or leads',
    icon: 'zap',
    tone: 'emerald',
    optional: false,
  },
  {
    key: 'inactiveProjectCount',
    label: 'Inactive',
    title: 'Projects with no active assignments and no lead',
    icon: 'pause-circle',
    tone: 'slate',
    optional: false,
  },
  {
    key: 'planningProjectCount',
    label: 'Planning',
    title: 'Projects with lead but no active assignments (planning/startup phase)',
    icon: 'pencil',
    tone: 'violet',
    optional: true,
  },
  {
    key: 'assignedProjectCount',
    label: 'Assigned',
    title: 'Projects with active employee assignments',
    icon: 'user-check',
    tone: 'emerald',
    optional: true,
  },
  {
    key: 'nonAssignedProjectCount',
    label: 'Non-Assigned',
    title: 'Projects with no active employee assignments',
    icon: 'user-x',
    tone: 'amber',
    optional: true,
  },
];
