import { titleCaseLabel } from '../format/labels';

export type StatusTone = 'emerald' | 'amber' | 'slate' | 'violet' | 'sky' | 'rose' | 'neutral';

export interface StatusMeta {
  label: string;
  icon: string;
  tone: StatusTone;
}

/** One mapping for project / approval statuses so every page shows the same label, icon and colour. */
export function projectStatusMeta(status: string | null | undefined): StatusMeta {
  const key = (status ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const label = titleCaseLabel(key) || 'Unknown';
  if (key.includes('inactive')) return { label, icon: 'pause-circle', tone: 'slate' };
  if (key.includes('active') || key === 'approved' || key === 'in_flight') return { label, icon: 'zap', tone: 'emerald' };
  if (key.includes('review')) return { label, icon: 'git-pull-request', tone: 'amber' };
  if (key.includes('hold') || key.includes('pause')) return { label, icon: 'pause-circle', tone: 'slate' };
  if (key.includes('draft') || key.includes('plan')) return { label, icon: 'pencil', tone: 'violet' };
  if (key.includes('archiv')) return { label, icon: 'archive', tone: 'neutral' };
  if (key.includes('complete') || key.includes('done')) return { label, icon: 'circle-check', tone: 'sky' };
  if (key.includes('reject') || key.includes('cancel')) return { label, icon: 'circle-x', tone: 'rose' };
  if (key.includes('progress')) return { label, icon: 'loader', tone: 'sky' };
  return { label, icon: 'circle-dot', tone: 'sky' };
}

/** `eh-badge` modifier per tone, spelled out so Tailwind keeps every class in the build. */
export const BADGE_TONE_CLASS: Record<StatusTone, string> = {
  emerald: 'eh-badge-emerald',
  amber: 'eh-badge-amber',
  slate: 'eh-badge-slate',
  violet: 'eh-badge-violet',
  sky: 'eh-badge-sky',
  rose: 'eh-badge-rose',
  neutral: 'eh-badge-neutral',
};

/** Solid fill used by timeline dots and Gantt bars. */
export const STATUS_TONE_FILL: Record<StatusTone, string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  slate: 'bg-slate-500',
  violet: 'bg-violet-500',
  sky: 'bg-sky-500',
  rose: 'bg-rose-500',
  neutral: 'bg-white/40',
};

/** Ring colour for timeline start markers. */
export const STATUS_TONE_BORDER: Record<StatusTone, string> = {
  emerald: 'border-emerald-500',
  amber: 'border-amber-500',
  slate: 'border-slate-500',
  violet: 'border-violet-500',
  sky: 'border-sky-500',
  rose: 'border-rose-500',
  neutral: 'border-white/40',
};

/** Legend rows for charts coloured by `projectStatusMeta`. */
export const STATUS_LEGEND: ReadonlyArray<{ tone: StatusTone; label: string }> = [
  { tone: 'emerald', label: 'Approved / In Flight' },
  { tone: 'sky', label: 'Completed' },
  { tone: 'amber', label: 'In Review' },
  { tone: 'slate', label: 'On Hold' },
  { tone: 'violet', label: 'Draft / Planning' },
  { tone: 'rose', label: 'Cancelled / Rejected' },
];
