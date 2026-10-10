export type CalendarEventType = 'milestone' | 'due-date' | 'reminder';

export interface ICalendarDay {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
}

/** Six weeks so every month renders the same grid height. */
const CALENDAR_GRID_DAYS = 42;

export const CALENDAR_WEEKDAYS = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;

export const CALENDAR_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const CALENDAR_EVENT_TYPE_COLORS: Record<CalendarEventType, string> = {
  milestone: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'due-date': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  reminder: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export const CALENDAR_UNKNOWN_EVENT_COLOR =
  'bg-gray-500/20 text-gray-400 border-gray-500/30';

export const CALENDAR_LEGEND: ReadonlyArray<{
  type: CalendarEventType;
  label: string;
}> = [
  { type: 'milestone', label: 'Milestone' },
  { type: 'due-date', label: 'Due Date' },
  { type: 'reminder', label: 'Reminder' },
];

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

export function formatCalendarTitle(date: Date): string {
  return `${CALENDAR_MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

export function buildCalendarDays(year: number, month: number): ICalendarDay[] {
  const startingDayOfWeek = new Date(year, month, 1).getDay();
  return Array.from({ length: CALENDAR_GRID_DAYS }, (_, index) => {
    const date = new Date(year, month, index - startingDayOfWeek + 1);
    return {
      date,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
    };
  });
}

export function calendarDayCellTone(day: ICalendarDay): string {
  if (!day.isCurrentMonth) return 'border-white/5 bg-white/2';
  return isSameDay(day.date, new Date())
    ? 'border-primary bg-primary/10'
    : 'border-white/10 bg-white/5';
}

export function calendarDayNumberTone(day: ICalendarDay): string {
  if (!day.isCurrentMonth) return 'text-white/40';
  return isSameDay(day.date, new Date()) ? 'text-primary' : 'text-white';
}
