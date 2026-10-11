export type CalendarTabId = 'calendar' | 'timeline' | 'gantt';

export const CALENDAR_TABS: ReadonlyArray<{
  id: CalendarTabId;
  label: string;
  icon: string;
}> = [
  { id: 'calendar', label: 'Calendar View', icon: 'calendar-days' },
  { id: 'timeline', label: 'Timeline View', icon: 'calendar-range' },
  { id: 'gantt', label: 'Gantt View', icon: 'chart-column' },
];

export const CALENDAR_TAB_ACTIVE_CLASS =
  'inline-flex items-center gap-2 border-b-2 border-primary px-4 py-2 text-sm font-medium text-primary';

export const CALENDAR_TAB_IDLE_CLASS =
  'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white';
