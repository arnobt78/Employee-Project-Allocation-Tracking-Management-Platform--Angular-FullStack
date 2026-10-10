import { Component, computed, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  CALENDAR_EVENT_TYPE_COLORS,
  CALENDAR_UNKNOWN_EVENT_COLOR,
  type CalendarEventType,
  type ICalendarDay,
  buildCalendarDays,
  calendarDayCellTone,
  calendarDayNumberTone,
  formatCalendarTitle,
  isSameDay,
} from './calendar-month';
import { CalendarMonthShellComponent } from './calendar-month-shell.component';

export interface ICalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: CalendarEventType;
  projectId: number;
  projectName: string;
  description: string;
  state?: string;
  status?: string;
}

interface ICalendarEventDay extends ICalendarDay {
  events: ICalendarEvent[];
}

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CalendarMonthShellComponent, NgTemplateOutlet, RouterLink],
  templateUrl: './calendar-view.component.html',
})
export class CalendarViewComponent {
  readonly events = input<ICalendarEvent[]>([]);

  readonly currentDateSignal = signal(new Date());
  readonly currentDate = this.currentDateSignal.asReadonly();
  readonly currentMonth = computed(() => this.currentDate().getMonth());
  readonly currentYear = computed(() => this.currentDate().getFullYear());
  readonly title = computed(() => formatCalendarTitle(this.currentDate()));

  readonly expandedDateSignal = signal<Date | null>(null);
  readonly expandedDate = this.expandedDateSignal.asReadonly();

  readonly dayCellTone = calendarDayCellTone;
  readonly dayNumberTone = calendarDayNumberTone;

  readonly calendarDays = computed<ICalendarEventDay[]>(() =>
    buildCalendarDays(this.currentYear(), this.currentMonth()).map((day) => ({
      ...day,
      events: this.getEventsForDate(day.date),
    })),
  );

  isDateExpanded(date: Date): boolean {
    const expanded = this.expandedDate();
    return expanded !== null && isSameDay(date, expanded);
  }

  toggleDateExpansion(date: Date): void {
    this.expandedDateSignal.set(this.isDateExpanded(date) ? null : date);
  }

  onMoreMouseEnter(date: Date): void {
    this.expandedDateSignal.set(date);
  }

  onMoreMouseLeave(): void {
    // Small delay before collapsing to allow moving to expanded content
    setTimeout(() => {
      this.expandedDateSignal.set(null);
    }, 200);
  }

  getEventsForDate(date: Date): ICalendarEvent[] {
    return this.events().filter((event) =>
      isSameDay(new Date(event.date), date),
    );
  }

  getEventTypeColor(type: string): string {
    return (
      CALENDAR_EVENT_TYPE_COLORS[type as CalendarEventType] ??
      CALENDAR_UNKNOWN_EVENT_COLOR
    );
  }

  previousMonth(): void {
    const current = this.currentDateSignal();
    this.currentDateSignal.set(
      new Date(current.getFullYear(), current.getMonth() - 1, 1),
    );
  }

  nextMonth(): void {
    const current = this.currentDateSignal();
    this.currentDateSignal.set(
      new Date(current.getFullYear(), current.getMonth() + 1, 1),
    );
  }

  goToToday(): void {
    this.currentDateSignal.set(new Date());
  }
}
