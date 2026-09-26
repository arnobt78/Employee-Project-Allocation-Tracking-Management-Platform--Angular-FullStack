import { Component, Input } from '@angular/core';
import { ListPageRowVariant } from '@/app/constants/private-page-meta';

@Component({
  selector: 'app-list-skeleton',
  standalone: true,
  template: `
    <div class="animate-pulse space-y-6" [attr.aria-hidden]="true">
      @for (row of rowsArray; track row) {
        @if (rowVariant === 'employee') {
          <div
            class="flex flex-col gap-3 rounded-[28px] border border-white/10 bg-white/5 px-2 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-4"
          >
            <div
              class="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:flex-wrap md:items-center"
            >
              <div
                class="h-8 w-8 shrink-0 rounded-2xl border border-white/15 bg-white/10"
              ></div>
              <div class="h-8 w-8 shrink-0 rounded-full bg-white/10"></div>
              <div class="h-4 w-36 max-w-[50%] rounded-full bg-white/10"></div>
              <div class="flex flex-wrap gap-2">
                @for (chip of chipWidths; track $index) {
                  <div
                    class="h-6 rounded-full bg-white/10"
                    [style.width.px]="chip"
                  ></div>
                }
              </div>
              <div class="h-4 w-28 rounded-full bg-white/10"></div>
            </div>
            <div class="h-4 w-14 shrink-0 rounded-full bg-white/10"></div>
          </div>
        } @else if (rowVariant === 'assignment') {
          <div
            class="flex flex-col gap-3 rounded-[28px] border border-white/10 bg-white/5 px-2 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-4"
          >
            <div
              class="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:flex-wrap md:items-center"
            >
              @for (chip of chipWidths; track $index) {
                <div
                  class="h-7 rounded-full bg-white/10"
                  [style.width.px]="chip"
                ></div>
              }
              <div class="h-4 w-36 rounded-full bg-white/10"></div>
            </div>
            <div class="h-4 w-14 shrink-0 rounded-full bg-white/10"></div>
          </div>
        } @else if (rowVariant === 'project') {
          <div
            class="relative rounded-[28px] border border-white/10 bg-white/5 px-3 pb-5 pt-3 sm:px-4"
          >
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <div class="h-4 w-44 max-w-[55%] rounded-full bg-white/10"></div>
                <div class="flex w-[7.5rem] items-center gap-2 sm:w-[14rem]">
                  <div class="h-3 w-8 shrink-0 rounded-full bg-white/10"></div>
                  <div class="h-2 min-w-0 flex-1 rounded-full bg-white/10"></div>
                </div>
              </div>
              <div
                class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <div class="flex flex-wrap gap-2">
                  @for (chip of chipWidths; track $index) {
                    <div
                      class="h-7 rounded-full bg-white/10"
                      [style.width.px]="chip"
                    ></div>
                  }
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <div class="h-8 w-20 rounded-xl bg-white/10"></div>
                  <div class="h-8 w-16 rounded-xl bg-white/10"></div>
                </div>
              </div>
            </div>
            <div
              class="absolute bottom-0 left-1/2 z-10 h-7 w-7 -translate-x-1/2 translate-y-1/2 rounded-full border border-white/15 bg-white/10"
            ></div>
          </div>
        } @else {
          <div
            class="flex flex-col gap-3 rounded-[28px] border border-white/10 bg-white/5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-4"
          >
            <div class="flex min-w-0 flex-1 items-center gap-3">
              <div class="h-10 w-10 shrink-0 rounded-full bg-white/10"></div>
              <div class="min-w-0 flex-1 space-y-2">
                <div class="flex items-center gap-2">
                  <div class="h-3 w-10 rounded-full bg-white/10"></div>
                  <div
                    class="h-4 w-36 max-w-[50%] rounded-full bg-white/10"
                  ></div>
                </div>
                <div class="flex flex-wrap gap-2">
                  @for (chip of chipWidths; track $index) {
                    <div
                      class="h-6 rounded-full bg-white/10"
                      [style.width.px]="chip"
                    ></div>
                  }
                </div>
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <div class="h-6 w-28 rounded-full bg-white/10"></div>
              <div class="h-8 w-20 rounded-full bg-white/10"></div>
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class ListSkeletonComponent {
  @Input() rows = 3;
  @Input() rowVariant: ListPageRowVariant = 'default';

  get rowsArray(): number[] {
    return Array.from({ length: this.rows }, (_, index) => index);
  }

  get chipWidths(): number[] {
    switch (this.rowVariant) {
      case 'employee':
        return [72, 96, 112, 80, 64];
      case 'project':
        return [88, 120, 100];
      case 'assignment':
        // project, employee, role, status (+ separate date bar in template)
        return [120, 110, 96, 72];
      default:
        return [80, 96, 112];
    }
  }
}

@Component({
  selector: 'app-stat-pill-skeleton',
  standalone: true,
  template: `
    <span
      class="inline-block animate-pulse rounded-full border border-white/10 bg-white/10 px-4 py-2"
      [style.width.px]="width"
      [style.height.px]="32"
      aria-hidden="true"
    ></span>
  `,
})
export class StatPillSkeletonComponent {
  @Input() width = 120;
}
