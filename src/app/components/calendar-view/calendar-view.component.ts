import {
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
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

const COLLAPSE_DELAY_MS = 200;

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

  private collapseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancelCollapse());
  }

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
    this.cancelCollapse();
    this.expandedDateSignal.set(this.isDateExpanded(date) ? null : date);
  }

  /** Hover-expand for mouse only: on touch the emulated hover would race the tap's toggle. */
  onMorePointerEnter(event: PointerEvent, date: Date): void {
    if (event.pointerType !== 'mouse') {
      return;
    }
    this.cancelCollapse();
    this.expandedDateSignal.set(date);
  }

  /** Delay lets the pointer move onto the expanded list without closing it. */
  onMoreMouseLeave(): void {
    this.cancelCollapse();
    this.collapseTimer = setTimeout(() => this.collapse(), COLLAPSE_DELAY_MS);
  }

  cancelCollapse(): void {
    if (this.collapseTimer !== null) {
      clearTimeout(this.collapseTimer);
      this.collapseTimer = null;
    }
  }

  collapse(): void {
    this.cancelCollapse();
    this.expandedDateSignal.set(null);
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
    this.shiftMonth(-1);
  }

  nextMonth(): void {
    this.shiftMonth(1);
  }

  goToToday(): void {
    this.collapse();
    this.currentDateSignal.set(new Date());
  }

  private shiftMonth(delta: number): void {
    this.collapse();
    const current = this.currentDateSignal();
    this.currentDateSignal.set(
      new Date(current.getFullYear(), current.getMonth() + delta, 1),
    );
  }
}
