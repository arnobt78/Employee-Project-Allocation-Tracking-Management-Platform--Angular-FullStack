import { Component, Input } from '@angular/core';

/**
 * Mirror of project-form readiness checklist while GetProject hydrates.
 * Used by route placeholder and project-form isLoading.
 */
@Component({
  selector: 'app-project-form-skeleton',
  standalone: true,
  host: { class: 'block' },
  template: `
    <div
      class="eh-section-stack"
      data-testid="project-form-skeleton"
      aria-hidden="true"
    >
      <section
        class="animate-pulse rounded-[28px] border border-white/10 bg-white/5/80 p-2 shadow-[0_35px_90px_rgba(9,14,33,0.55)] backdrop-blur-md sm:p-4"
      >
        <header
          class="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
        >
          <div class="space-y-2">
            <div class="h-5 w-48 rounded-full bg-white/10"></div>
            <div class="h-3 w-64 max-w-full rounded-full bg-white/10"></div>
          </div>
          <div
            class="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-2"
          >
            <div class="h-8 w-12 rounded-full bg-white/10"></div>
            <div class="space-y-2">
              <div class="h-3 w-16 rounded-full bg-white/10"></div>
              <div class="h-3 w-10 rounded-full bg-white/10"></div>
            </div>
          </div>
        </header>

        <div class="grid gap-4">
          @for (row of rows; track row) {
            <article
              class="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <div
                class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div class="space-y-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <div class="h-4 w-36 rounded-full bg-white/10"></div>
                    <div class="h-5 w-14 rounded-full bg-white/10"></div>
                    <div class="h-5 w-12 rounded-full bg-white/10"></div>
                  </div>
                  <div class="h-3 w-72 max-w-full rounded-full bg-white/10"></div>
                </div>
                <div class="h-8 w-24 shrink-0 rounded-full bg-white/10"></div>
              </div>
              <div class="grid gap-3 sm:grid-cols-3">
                <div class="h-11 rounded-2xl border border-white/10 bg-white/5"></div>
                <div class="h-11 rounded-2xl border border-white/10 bg-white/5"></div>
                <div class="h-11 rounded-2xl border border-white/10 bg-white/5"></div>
              </div>
              <div
                class="h-20 rounded-2xl border border-white/10 bg-white/5"
              ></div>
            </article>
          }
        </div>
      </section>
    </div>
  `,
})
export class ProjectFormSkeletonComponent {
  @Input() set checklistRows(value: number) {
    const n = Number.isFinite(value) && value > 0 ? Math.floor(value) : 3;
    this.rows = Array.from({ length: n }, (_, i) => i + 1);
  }

  rows = [1, 2, 3];
}
