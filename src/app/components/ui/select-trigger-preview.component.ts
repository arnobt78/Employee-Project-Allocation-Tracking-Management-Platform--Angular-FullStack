import { Component, Input } from '@angular/core';
import { AppIconComponent } from './app-icon.component';

/** Static, non-interactive replica of the `app-select-menu` trigger for loading mirrors. */
@Component({
  selector: 'app-select-trigger-preview',
  standalone: true,
  imports: [AppIconComponent],
  host: { class: 'block w-full' },
  template: `
    <div class="eh-select-trigger" aria-hidden="true">
      <span class="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        @if (icon) {
          <lucide-icon
            [name]="icon"
            [size]="20"
            class="shrink-0 text-white/70"
          ></lucide-icon>
        }
        <span
          class="min-w-0 flex-1 truncate whitespace-nowrap text-left text-sm font-normal leading-none"
        >
          <span class="text-white">{{ label }}</span>
        </span>
      </span>
      <lucide-icon
        name="chevron-down"
        [size]="16"
        class="shrink-0 text-white/60"
      ></lucide-icon>
    </div>
  `,
})
export class SelectTriggerPreviewComponent {
  @Input() label = '';
  @Input() icon = '';
}
