import type { KpiStatTone } from '@/app/components/ui/kpi-stat-card.component';

export interface PortfolioKpi {
  label: string;
  hint: string;
  icon: string;
  tone: KpiStatTone;
}

/** Copy for KPIs shown on several pages; values come from `lib/status/portfolio-stats`. */
export const PORTFOLIO_KPIS = {
  inFlight: { label: 'In Flight', hint: 'Approved or in review', icon: 'zap', tone: 'emerald' },
  planning: { label: 'Planning', hint: 'Draft or planning', icon: 'pencil', tone: 'violet' },
  onHold: { label: 'On Hold', hint: 'Paused projects', icon: 'pause-circle', tone: 'amber' },
  archived: { label: 'Archived', hint: 'Restorable from the Archived tab', icon: 'archive', tone: 'slate' },
} as const satisfies Record<string, PortfolioKpi>;
