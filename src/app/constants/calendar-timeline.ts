import { TAB_ACTIVE_CLASS, TAB_IDLE_CLASS } from './tabs';

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

export const CALENDAR_TAB_ACTIVE_CLASS = TAB_ACTIVE_CLASS;

export const CALENDAR_TAB_IDLE_CLASS = TAB_IDLE_CLASS;
