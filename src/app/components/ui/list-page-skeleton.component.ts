import { Component, Input } from '@angular/core';
import { ListPageRowVariant } from '@/app/constants/private-page-meta';
import { ListSkeletonComponent } from './list-skeleton.component';

/**
 * List-page content skeleton (KPI tiles + toolbar + rows).
 * Used by route placeholder and list pages while isLoading / no peek.
 * Keep structure aligned with list-page-shell warm layout.
 */
@Component({
  selector: 'app-list-page-skeleton',
  standalone: true,
  imports: [ListSkeletonComponent],
  host: { class: 'block' },
  template: `
    <div
      class="eh-section-stack"
      data-testid="list-page-skeleton"
      aria-hidden="true"
    >
      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        @for (card of kpiCards; track card) {
          <article
            class="animate-pulse flex items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-white/5 p-3 sm:p-4"
          >
            <div class="min-w-0 flex-1 space-y-3">
              <div class="h-3 w-24 rounded-full bg-white/10"></div>
              <div class="h-8 w-14 rounded-full bg-white/10"></div>
              <div class="h-3 w-28 rounded-full bg-white/10"></div>
            </div>
            <div class="h-10 w-10 shrink-0 rounded-2xl bg-white/10"></div>
          </article>
        }
      </section>
      <section
        class="flex flex-col gap-3 rounded-[28px] border border-white/10 bg-white/5/70 px-2 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3"
      >
        <div
          class="h-11 w-full animate-pulse rounded-2xl border border-white/10 bg-white/5 sm:max-w-sm"
        ></div>
        <div class="flex flex-wrap items-center gap-2">
          @for (pill of filterPills; track pill) {
            <div
              class="h-11 w-36 animate-pulse rounded-2xl border border-white/10 bg-white/5"
            ></div>
          }
          @if (showPagination) {
            <div
              class="h-11 w-28 animate-pulse rounded-2xl border border-white/10 bg-white/5"
            ></div>
          }
        </div>
      </section>
      <app-list-skeleton
        [rows]="rows"
        [rowVariant]="rowVariant"
      ></app-list-skeleton>
    </div>
  `,
})
export class ListPageSkeletonComponent {
  @Input() rows = 6;
  @Input() showPagination = false;
  @Input() rowVariant: ListPageRowVariant = 'default';

  /** Match live KPI tile count (list pages use 6). */
  @Input() set kpiCount(value: number) {
    const n = Number.isFinite(value) && value > 0 ? Math.floor(value) : 6;
    this.kpiCards = Array.from({ length: n }, (_, i) => i + 1);
  }

  @Input() set filterCount(value: number) {
    const n = Number.isFinite(value) && value > 0 ? Math.floor(value) : 3;
    this.filterPills = Array.from({ length: n }, (_, i) => i + 1);
  }

  kpiCards = [1, 2, 3, 4, 5, 6];
  filterPills = [1, 2, 3];
}
