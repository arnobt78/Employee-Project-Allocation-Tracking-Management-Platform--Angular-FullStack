import { buildCalendarDays, formatCalendarTitle } from './calendar-month';

describe('calendar-month helpers', () => {
  it('builds a six-week grid starting on the Sunday before the 1st', () => {
    const days = buildCalendarDays(2026, 9);

    expect(days.length).toBe(42);
    expect(days[0].date.getDay()).toBe(0);
    expect(days[0].isCurrentMonth).toBeFalse();
    const first = days.findIndex((d) => d.isCurrentMonth);
    expect(days[first].day).toBe(1);
    expect(days.filter((d) => d.isCurrentMonth).length).toBe(31);
  });

  it('handles year boundaries', () => {
    const days = buildCalendarDays(2026, 11);

    expect(days.filter((d) => d.isCurrentMonth).length).toBe(31);
    expect(days[41].date.getFullYear()).toBe(2027);
  });

  it('formats the month title', () => {
    expect(formatCalendarTitle(new Date(2026, 9, 10))).toBe('October 2026');
  });
});
