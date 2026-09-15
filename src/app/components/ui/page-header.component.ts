import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { AppIconComponent } from './app-icon.component';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  host: { class: 'block' },
  template: `
    <div
      class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      data-testid="page-header"
    >
      <div class="flex items-start gap-3">
        @if (icon) {
          <span
            class="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white shadow-[0_12px_40px_rgba(59,130,246,0.35)] shadow-inner shadow-primary/25"
            aria-hidden="true"
          >
            <lucide-icon [name]="icon" [size]="20"></lucide-icon>
          </span>
        }
        <div>
          <h1 class="text-xl leading-tight font-medium text-white sm:text-2xl">
            {{ title }}
          </h1>
          @if (subtitle) {
            <p class="text-xs text-white/60 sm:text-sm">{{ subtitle }}</p>
          }
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2 sm:gap-3">
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class PageHeaderComponent {
  @Input({ required: true }) title = '';
  @Input() subtitle = '';
  @Input() icon = '';
}
