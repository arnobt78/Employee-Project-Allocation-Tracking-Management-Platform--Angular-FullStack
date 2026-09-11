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
      class="eh-btn-icon rounded-xl border border-white/20 px-4 py-2 text-xs text-white/70 transition hover:border-white/40 hover:text-white"
      aria-label="Close Details"
      (click)="closed.emit()"
    >
      <lucide-icon name="x" [size]="16"></lucide-icon>
      <span>Close</span>
    </button>
  `,
})
export class CardCloseButtonComponent {
  @Output() closed = new EventEmitter<void>();
}
