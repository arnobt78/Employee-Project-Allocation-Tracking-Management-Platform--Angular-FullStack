import { Component, input, output } from '@angular/core';
import { AppIconComponent } from './app-icon.component';

/** Inline text link that resets a filter row; no button shell. */
@Component({
  selector: 'app-clear-filters-button',
  standalone: true,
  imports: [AppIconComponent],
  host: { class: 'inline-flex' },
  template: `
    <button
      type="button"
      class="-mx-1 inline-flex shrink-0 items-center gap-1.5 rounded-md px-1 text-xs font-medium text-sky-300/90 transition hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 sm:text-sm"
      (click)="cleared.emit()"
    >
      <lucide-icon [name]="icon()" [size]="14" aria-hidden="true"></lucide-icon>
      <span>{{ label() }}</span>
    </button>
  `,
})
export class ClearFiltersButtonComponent {
  readonly label = input('Reset Filters');
  readonly icon = input('rotate-ccw');
  readonly cleared = output<void>();
}
