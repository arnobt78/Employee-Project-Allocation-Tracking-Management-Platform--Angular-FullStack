import { Component } from '@angular/core';

/**
 * Pixel-aligned dashboard loading mirror — used by route placeholder and page isLoading.
 * Keep structure in sync with dashboard.component.html loaded layout.
 * Host is display:block so parent space-y-* gap under page-header applies.
 */
@Component({
  selector: 'app-dashboard-skeleton',
  standalone: true,
  host: { class: 'block' },
  template: `
    <div
      class="space-y-6 sm:space-y-8"
      data-testid="dashboard-skeleton"
      aria-hidden="true"
    >
      <!-- Hero banner -->
      <section
        class="animate-pulse rounded-[28px] border border-white/10 bg-white/5 p-2 sm:p-4"
      >
        <div class="h-3 w-28 rounded-full bg-white/10"></div>
        <div class="mt-3 h-7 w-64 max-w-full rounded-full bg-white/10"></div>
        <!-- Mirror live hero subtitle (2 lines) -->
        <div class="mt-3 max-w-2xl space-y-2">
          <div class="h-4 w-full rounded-full bg-white/10"></div>
          <div class="h-4 w-[80%] max-w-lg rounded-full bg-white/10"></div>
        </div>
        <div class="mt-5 flex flex-wrap gap-2">
          <div class="h-7 w-24 rounded-full bg-white/10"></div>
          <div class="h-7 w-28 rounded-full bg-white/10"></div>
          <div class="h-7 w-32 rounded-full bg-white/10"></div>
        </div>
      </section>

      <!-- Unified KPI grid (matches live single gap-3 grid) -->
      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        @for (card of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; track card) {
          <article
            class="animate-pulse flex items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-white/5 p-3 sm:p-4"
          >
            <div class="min-w-0 flex-1 space-y-3">
              <div class="h-3 w-28 rounded-full bg-white/10"></div>
              <div class="h-8 w-14 rounded-full bg-white/10"></div>
              <div class="h-3 w-40 rounded-full bg-white/10"></div>
            </div>
            <div class="h-10 w-10 shrink-0 rounded-2xl bg-white/10"></div>
          </article>
        }
      </section>

      <!-- Charts -->
      <section class="grid gap-6 lg:grid-cols-2">
        @for (chart of [1, 2]; track chart) {
          <article
            class="animate-pulse rounded-[28px] border border-white/10 bg-white/5/70 p-4"
          >
            <div class="mb-4 h-5 w-40 rounded-full bg-white/10"></div>
            <div class="h-56 w-full min-w-[18rem] rounded-2xl bg-white/10"></div>
          </article>
        }
      </section>

      <!-- Latest Projects + New Employees -->
      <section class="grid gap-6 lg:grid-cols-2">
        @for (panel of [1, 2]; track panel) {
          <article
            class="animate-pulse rounded-[28px] border border-white/10 bg-white/5/70 p-2 sm:p-4"
          >
            <header class="flex items-center justify-between gap-4 pb-4">
              <div class="space-y-2">
                <div class="h-5 w-36 rounded-full bg-white/10"></div>
                <div class="h-3 w-28 rounded-full bg-white/10"></div>
              </div>
              <div class="h-7 w-20 rounded-full bg-white/10"></div>
            </header>
            <ul class="space-y-2">
              @for (row of [1, 2, 3, 4, 5]; track row) {
                <li
                  class="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-2 sm:px-4 py-3"
                >
                  <div class="flex min-w-0 flex-1 items-center gap-3">
                    <div class="h-8 w-8 shrink-0 rounded-xl bg-white/10"></div>
                    <div class="min-w-0 flex-1 space-y-2">
                      <div class="h-3 w-32 rounded-full bg-white/10"></div>
                      <div class="h-2.5 w-44 rounded-full bg-white/10"></div>
                    </div>
                  </div>
                  <div class="h-6 w-20 shrink-0 rounded-full bg-white/10"></div>
                </li>
              }
            </ul>
          </article>
        }
      </section>

      <!-- Departments -->
      <section
        class="animate-pulse rounded-[28px] border border-white/10 bg-white/5/80 p-2 sm:p-4"
      >
        <header
          class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="space-y-2">
            <div class="h-5 w-48 rounded-full bg-white/10"></div>
            <div class="h-3 w-56 rounded-full bg-white/10"></div>
          </div>
          <div class="h-7 w-36 rounded-full bg-white/10"></div>
        </header>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (dept of [1, 2, 3]; track dept) {
            <div
              class="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
            >
              <div class="h-16 w-16 rounded-2xl bg-white/10"></div>
              <div class="h-3 w-24 rounded-full bg-white/10"></div>
              <div class="h-2.5 w-36 rounded-full bg-white/10"></div>
            </div>
          }
        </div>
      </section>
    </div>
  `,
})
export class DashboardSkeletonComponent {}
