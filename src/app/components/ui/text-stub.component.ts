import { Component, input } from '@angular/core';

/**
 * Loading stand-in for a line of text. The host keeps the caller's text classes
 * (font size, line-height, display, width) and holds a non-breaking space so it
 * reserves the exact line box of the real text; `bar` positions the pulse.
 */
@Component({
  selector: 'app-text-stub',
  standalone: true,
  host: { class: 'relative', 'aria-hidden': 'true' },
  template: `&nbsp;<span
      class="absolute animate-pulse bg-white/10"
      [class]="bar()"
    ></span>`,
})
export class TextStubComponent {
  readonly bar = input('inset-0 rounded-full');
}
