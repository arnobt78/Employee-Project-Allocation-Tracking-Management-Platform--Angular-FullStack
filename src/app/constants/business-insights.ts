import type { KpiStatTone } from '@/app/components/ui/kpi-stat-card.component';
import { PORTFOLIO_KPIS, type PortfolioKpi } from './portfolio-kpis';
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

const pick = ({ label, icon, tone }: PortfolioKpi) => ({ label, icon, tone });

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
  { key: 'draft', ...pick(PORTFOLIO_KPIS.planning) },
  { key: 'in_progress', ...pick(PORTFOLIO_KPIS.inFlight) },
  { key: 'completed', label: 'Completed', icon: 'circle-check', tone: 'sky' },
  { key: 'on_hold', ...pick(PORTFOLIO_KPIS.onHold) },
  { key: 'cancelled', label: 'Cancelled', icon: 'circle-x', tone: 'rose' },
];
