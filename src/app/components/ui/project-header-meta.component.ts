import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Project detail header actions (Back link, mode badge, readiness bar).
 * Shared by the live page and its loading mirror; `progress === null` renders stubs.
 */
@Component({
  selector: 'app-project-header-meta',
  standalone: true,
  imports: [RouterLink],
  host: { class: 'block w-full sm:w-64' },
  template: `
    <div class="flex flex-col gap-3" data-testid="project-header-meta">
      <div class="flex items-center justify-between gap-3">
        <a
          routerLink="/projects"
          class="eh-btn-icon text-xs font-medium text-white/60 transition hover:text-white"
        >
          ← Back To Projects
        </a>
        <span
          class="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/60 sm:text-sm"
        >
          {{ modeLabel }}
        </span>
      </div>
      <div class="space-y-2 text-sm text-white/70">
        <div class="flex items-center justify-between gap-4">
          <span>Readiness</span>
          @if (progress === null) {
            <span
              class="h-4 w-10 animate-pulse rounded-full bg-white/10"
              aria-hidden="true"
            ></span>
          } @else {
            <span class="font-medium text-white">{{ progress }}%</span>
          }
        </div>
        <div class="h-2 w-full rounded-full bg-white/10">
          @if (progress !== null) {
            <div
              class="h-2 rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 transition-all duration-300"
              [style.width.%]="progress"
            ></div>
          } @else {
            <div class="h-2 w-full animate-pulse rounded-full bg-white/5"></div>
          }
        </div>
      </div>
    </div>
  `,
})
export class ProjectHeaderMetaComponent {
  @Input() modeLabel: 'Editing' | 'Draft' = 'Editing';
  @Input() progress: number | null = null;
}
