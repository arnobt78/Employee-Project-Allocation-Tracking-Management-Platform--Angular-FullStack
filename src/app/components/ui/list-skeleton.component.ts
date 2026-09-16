import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-list-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="animate-pulse space-y-6" [attr.aria-hidden]="true">
      <div
        *ngFor="let row of rowsArray"
        class="flex flex-col gap-3 rounded-[28px] border border-white/10 bg-white/5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-4"
      >
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <div class="h-10 w-10 shrink-0 rounded-full bg-white/10"></div>
          <div class="min-w-0 flex-1 space-y-2">
            <div class="flex items-center gap-2">
              <div class="h-3 w-10 rounded-full bg-white/10"></div>
              <div class="h-4 w-36 max-w-[50%] rounded-full bg-white/10"></div>
            </div>
            <div class="flex flex-wrap gap-2">
              <div class="h-6 w-20 rounded-full bg-white/10"></div>
              <div class="h-6 w-24 rounded-full bg-white/10"></div>
              <div class="h-6 w-28 rounded-full bg-white/10"></div>
            </div>
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <div class="h-6 w-28 rounded-full bg-white/10"></div>
          <div class="h-8 w-20 rounded-full bg-white/10"></div>
        </div>
      </div>
    </div>
  `,
})
export class ListSkeletonComponent {
  @Input() rows = 3;

  get rowsArray(): number[] {
    return Array.from({ length: this.rows }, (_, index) => index);
  }
}

@Component({
  selector: 'app-stat-pill-skeleton',
  standalone: true,
  imports: [CommonModule],
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
