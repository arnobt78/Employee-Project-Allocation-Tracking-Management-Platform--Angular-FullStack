import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppIconComponent } from './app-icon.component';

/**
 * Project detail header actions (Back link + one-line readiness meter).
 * The readiness row is a single text line so it sits on the subtitle's last line
 * when the page header uses `actionsAlign="end"`.
 * Shared by the live page and its loading mirror; `progress === null` renders stubs.
 */
@Component({
  selector: 'app-project-header-meta',
  standalone: true,
  imports: [RouterLink, AppIconComponent],
  host: { class: 'block w-full sm:w-64' },
  template: `
    <div class="flex flex-col gap-1.5" data-testid="project-header-meta">
      <a
        routerLink="/projects"
        class="eh-btn-icon self-start text-xs sm:text-sm font-medium leading-5 text-white/60 transition hover:text-white sm:self-end"
      >
        <lucide-icon name="chevron-left" [size]="14"></lucide-icon>
        <span>Back to Projects</span>
      </a>
      <div
        class="flex items-center gap-1.5 text-xs sm:text-sm leading-5 text-white/70"
        data-testid="project-header-readiness"
      >
        <span class="shrink-0">Readiness Level</span>
        <div class="h-1.5 min-w-0 flex-1 rounded-full bg-white/10">
          @if (progress !== null) {
            <div
              class="h-1.5 rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 transition-all duration-300"
              [style.width.%]="progress"
            ></div>
          } @else {
            <div class="h-1.5 w-full animate-pulse rounded-full bg-white/5"></div>
          }
        </div>
        @if (progress === null) {
          <span
            class="h-4 w-9 shrink-0 animate-pulse rounded-full bg-white/10"
            aria-hidden="true"
          ></span>
        } @else {
          <span class="w-9 shrink-0 text-right font-medium text-white">{{ progress }}%</span>
        }
      </div>
    </div>
  `,
})
export class ProjectHeaderMetaComponent {
  @Input() progress: number | null = null;
}
