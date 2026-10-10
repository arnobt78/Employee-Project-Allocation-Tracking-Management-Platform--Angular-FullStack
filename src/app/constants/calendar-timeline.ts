export type CalendarTabId = 'calendar' | 'timeline' | 'gantt';

export const CALENDAR_TABS: ReadonlyArray<{ id: CalendarTabId; label: string }> =
  [
    { id: 'calendar', label: 'Calendar View' },
    { id: 'timeline', label: 'Timeline View' },
    { id: 'gantt', label: 'Gantt View' },
  ];

export const CALENDAR_TAB_ACTIVE_CLASS =
  'border-b-2 border-primary px-4 py-2 text-sm font-medium text-primary';

export const CALENDAR_TAB_IDLE_CLASS =
  'px-4 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white';
