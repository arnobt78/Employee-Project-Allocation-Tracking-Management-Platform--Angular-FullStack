import { NgTemplateOutlet } from '@angular/common';
import { Component, TemplateRef, input, output } from '@angular/core';
import {
  CALENDAR_EVENT_TYPE_COLORS,
  CALENDAR_LEGEND,
  CALENDAR_WEEKDAYS,
  type ICalendarDay,
} from './calendar-month';

/**
 * Static month frame (title, navigation, weekday row, 6-week grid, legend)
 * shared by the live calendar view and the calendar loading skeleton, so the
 * skeleton does not pull the event-aware view into the initial bundle.
 */
@Component({
  selector: 'app-calendar-month-shell',
  standalone: true,
  imports: [NgTemplateOutlet],
  host: { class: 'block space-y-4' },
  template: `
    <div class="flex items-center justify-between">
      <h3 class="text-base font-medium text-white sm:text-xl">
        {{ title() }}
      </h3>
      <div class="flex items-center gap-2">
        <button
          type="button"
          (click)="previous.emit()"
          class="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/10"
          title="Previous month"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          type="button"
          (click)="today.emit()"
          class="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/10"
          title="Go to today"
        >
          Today
        </button>
        <button
          type="button"
          (click)="next.emit()"
          class="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/10"
          title="Next month"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>

    <div class="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
      <div class="mb-2 grid grid-cols-7 gap-2">
        @for (weekday of weekdays; track weekday) {
          <div class="py-2 text-center text-xs font-medium tracking-wider text-white/60">
            {{ weekday }}
          </div>
        }
      </div>
      <div class="relative grid grid-cols-7 gap-2">
        @for (day of days(); track day.date.getTime()) {
          <ng-container
            [ngTemplateOutlet]="dayTemplate()"
            [ngTemplateOutletContext]="{ $implicit: day }"
          ></ng-container>
        }
      </div>
    </div>

    <div class="flex flex-wrap gap-4 text-xs">
      @for (item of legend; track item.type) {
        <div class="flex items-center gap-2">
          <div class="h-3 w-3 rounded border" [class]="eventColors[item.type]"></div>
          <span class="text-white/60">{{ item.label }}</span>
        </div>
      }
    </div>
  `,
})
export class CalendarMonthShellComponent<TDay extends ICalendarDay = ICalendarDay> {
  readonly title = input.required<string>();
  readonly days = input.required<readonly TDay[]>();
  readonly dayTemplate = input.required<TemplateRef<{ $implicit: TDay }>>();
  readonly previous = output<void>();
  readonly today = output<void>();
  readonly next = output<void>();

  readonly weekdays = CALENDAR_WEEKDAYS;
  readonly legend = CALENDAR_LEGEND;
  readonly eventColors = CALENDAR_EVENT_TYPE_COLORS;
}
