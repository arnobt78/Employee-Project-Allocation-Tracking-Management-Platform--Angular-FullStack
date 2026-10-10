import { Component } from '@angular/core';
import {
  CALENDAR_TABS,
  CALENDAR_TAB_ACTIVE_CLASS,
  CALENDAR_TAB_IDLE_CLASS,
} from '@/app/constants/calendar-timeline';
import { PRIVATE_PAGE_META } from '@/app/constants/private-page-meta';
import {
  buildCalendarDays,
  calendarDayCellTone,
  calendarDayNumberTone,
  formatCalendarTitle,
} from '../calendar-view/calendar-month';
import { CalendarMonthShellComponent } from '../calendar-view/calendar-month-shell.component';
import { PageHeaderComponent } from './page-header.component';

/**
 * Full-page loading mirror of calendar-timeline. The month grid is static
 * layout, so the shared month shell renders (inert, empty days) and only the
 * data-driven header counts pulse. Rendered by both the route placeholder and
 * the page's cold-load branch. Keep in sync with calendar-timeline.component.html.
 */
@Component({
  selector: 'app-calendar-skeleton',
  standalone: true,
  imports: [CalendarMonthShellComponent, PageHeaderComponent],
  host: { class: 'block' },
  template: `
    <div
      class="text-white/85"
      data-testid="calendar-skeleton"
      aria-busy="true"
    >
      <app-page-header
        [title]="meta.title"
        [subtitle]="meta.subtitle"
        [icon]="meta.icon"
      >
        @for (width of pillWidths; track $index) {
          <span
            class="h-6 animate-pulse rounded-full bg-white/10"
            [style.width.px]="width"
            aria-hidden="true"
          ></span>
        }
      </app-page-header>

      <div class="eh-content-stack">
        <div
          class="rounded-[28px] border border-white/10 bg-white/5/80 p-2 shadow-[0_35px_90px_rgba(9,14,33,0.55)] backdrop-blur-md sm:p-4"
        >
          <div class="mb-6 flex gap-2 border-b border-white/10">
            @for (tab of tabs; track tab.id; let first = $first) {
              <span [class]="first ? activeTabClass : idleTabClass">
                {{ tab.label }}
              </span>
            }
          </div>
          <div class="pointer-events-none space-y-4" inert>
            <app-calendar-month-shell
              [title]="monthTitle"
              [days]="days"
              [dayTemplate]="dayCell"
            ></app-calendar-month-shell>
          </div>
        </div>
      </div>
    </div>

    <ng-template #dayCell let-day>
      <div
        [class]="'min-h-[100px] rounded-xl border p-2 ' + dayCellTone(day)"
      >
        <div class="mb-1 text-sm font-medium" [class]="dayNumberTone(day)">
          {{ day.day }}
        </div>
        <div class="space-y-1"></div>
      </div>
    </ng-template>
  `,
})
export class CalendarSkeletonComponent {
  private readonly today = new Date();
  readonly monthTitle = formatCalendarTitle(this.today);
  readonly days = buildCalendarDays(
    this.today.getFullYear(),
    this.today.getMonth(),
  );
  readonly dayCellTone = calendarDayCellTone;
  readonly dayNumberTone = calendarDayNumberTone;
  readonly meta = PRIVATE_PAGE_META['/calendar-timeline'];
  readonly tabs = CALENDAR_TABS;
  readonly activeTabClass = CALENDAR_TAB_ACTIVE_CLASS;
  readonly idleTabClass = CALENDAR_TAB_IDLE_CLASS;
  readonly pillWidths = [88, 104, 100];
}
