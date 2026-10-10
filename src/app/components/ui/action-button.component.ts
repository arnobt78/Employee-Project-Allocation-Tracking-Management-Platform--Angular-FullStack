import {
  Component,
  DestroyRef,
  ElementRef,
  booleanAttribute,
  inject,
  input,
} from '@angular/core';
import { AppIconComponent } from './app-icon.component';

/**
 * Native `<button>` with an inline pending state: spinner + pending label and
 * `aria-busy`. While pending the button stays focusable (`aria-disabled`, not
 * native `disabled`, which would drop keyboard focus to `<body>`) and swallows
 * clicks/submits. Idle content is projected.
 *
 * Usage: `<button ehAction class="eh-action-btn …" icon="save" [pending]="…" pendingLabel="Saving…">Save</button>`
 */
@Component({
  selector: 'button[ehAction]',
  standalone: true,
  imports: [AppIconComponent],
  host: {
    '[disabled]': 'disabled() && !pending()',
    '[attr.aria-disabled]': 'pending() || null',
    '[attr.aria-busy]': 'pending() || null',
  },
  template: `
    @if (pending()) {
      <lucide-icon name="loader-circle" [size]="iconSize()" class="animate-spin" />
      <span>{{ pendingLabel() }}</span>
    } @else {
      @if (icon()) {
        <lucide-icon [name]="icon()" [size]="iconSize()" />
      }
      <ng-content />
    }
  `,
})
export class ActionButtonComponent {
  readonly pending = input(false, { transform: booleanAttribute });
  readonly pendingLabel = input('Working…');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly icon = input('');
  readonly iconSize = input(14);

  constructor() {
    const button = inject<ElementRef<HTMLButtonElement>>(ElementRef).nativeElement;
    // Capture phase runs before the host's own (click) bindings and form submit.
    const blockWhilePending = (event: Event) => {
      if (this.pending()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    button.addEventListener('click', blockWhilePending, { capture: true });
    inject(DestroyRef).onDestroy(() =>
      button.removeEventListener('click', blockWhilePending, { capture: true })
    );
  }
}
