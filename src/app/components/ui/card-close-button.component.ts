import { Component, EventEmitter, Output } from '@angular/core';
import { AppIconComponent } from '@/app/components/ui/app-icon.component';

/** Collapses an expanded list card; place left of Edit in card footers. */
@Component({
  selector: 'app-card-close-button',
  standalone: true,
  imports: [AppIconComponent],
  template: `
    <button
      type="button"
      class="eh-action-btn eh-action-btn-outline"
      aria-label="Close Details"
      (click)="closed.emit()"
    >
      <lucide-icon name="x" [size]="14"></lucide-icon>
      <span>Close</span>
    </button>
  `,
})
export class CardCloseButtonComponent {
  @Output() closed = new EventEmitter<void>();
}
