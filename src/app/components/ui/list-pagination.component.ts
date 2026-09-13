import { Component, input, output } from '@angular/core';
import { UbButtonDirective } from './button';
import { AppIconComponent } from './app-icon.component';

@Component({
  selector: 'app-list-pagination',
  standalone: true,
  imports: [UbButtonDirective, AppIconComponent],
  template: `
    @if (totalPages() > 1) {
      <div
        class="flex items-center gap-2"
        role="navigation"
        aria-label="List pagination"
      >
        <button
          type="button"
          ubButton
          size="sm"
          variant="secondary"
          class="eh-btn-icon"
          [disabled]="page() <= 1"
          (click)="pageChange.emit(page() - 1)"
          aria-label="Previous page"
        >
          <lucide-icon name="chevron-left" [size]="16"></lucide-icon>
        </button>
        <span class="text-xs font-medium text-white/60">
          Page {{ page() }} / {{ totalPages() }}
        </span>
        <button
          type="button"
          ubButton
          size="sm"
          variant="secondary"
          class="eh-btn-icon"
          [disabled]="page() >= totalPages()"
          (click)="pageChange.emit(page() + 1)"
          aria-label="Next page"
        >
          <lucide-icon name="chevron-right" [size]="16"></lucide-icon>
        </button>
      </div>
    }
  `,
})
export class ListPaginationComponent {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly pageChange = output<number>();
}
