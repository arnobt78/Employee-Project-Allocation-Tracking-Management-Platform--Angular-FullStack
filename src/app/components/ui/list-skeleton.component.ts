import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-list-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="animate-pulse space-y-4" [attr.aria-hidden]="true">
      <div
        *ngFor="let row of rowsArray"
        class="rounded-[28px] border border-white/10 bg-white/5 px-2 sm:px-4 py-2 sm:py-4"
      >
        <div class="flex items-center justify-between gap-4">
          <div class="h-4 rounded-full bg-white/10" [style.width.%]="70"></div>
          <div class="h-6 w-20 rounded-full bg-white/10"></div>
        </div>
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <div class="h-10 rounded-xl bg-white/10"></div>
          <div class="h-10 rounded-xl bg-white/10"></div>
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
