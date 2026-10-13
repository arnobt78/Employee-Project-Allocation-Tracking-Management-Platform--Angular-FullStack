import type { KpiStatTone } from '@/app/components/ui/kpi-stat-card.component';

export interface PortfolioKpi {
  label: string;
  hint: string;
  icon: string;
  tone: KpiStatTone;
}

/** Copy for KPIs shown on several pages; values come from `lib/status/portfolio-stats`. */
export const PORTFOLIO_KPIS = {
  inFlight: { label: 'In Flight', hint: 'Approved, in delivery', icon: 'zap', tone: 'emerald' },
  planning: { label: 'Planning', hint: 'Draft, in review or rejected', icon: 'pencil', tone: 'violet' },
  onHold: { label: 'On Hold', hint: 'Paused projects', icon: 'pause-circle', tone: 'amber' },
  completed: { label: 'Completed', hint: 'Delivered projects', icon: 'circle-check', tone: 'sky' },
  cancelled: { label: 'Cancelled', hint: 'Stopped after approval', icon: 'circle-x', tone: 'rose' },
  closed: { label: 'Closed', hint: 'Completed or cancelled', icon: 'circle-check', tone: 'sky' },
} as const satisfies Record<string, PortfolioKpi>;

/** Lead name, or this when a project has none (or its lead was deleted). */
export const NO_LEAD_LABEL = 'No lead';
