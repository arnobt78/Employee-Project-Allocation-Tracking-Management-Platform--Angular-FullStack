import { Component } from '@angular/core';

/** Loading mirror of one "Recent email deliveries" row on API Status. */
@Component({
  selector: 'app-delivery-row-skeleton',
  standalone: true,
  host: { class: 'block', 'aria-hidden': 'true' },
  template: `
    <div class="eh-panel flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <span class="eh-badge eh-badge-neutral w-16 animate-pulse">&nbsp;</span>
        <span class="inline-block h-4 w-36 animate-pulse rounded-full bg-white/10"></span>
      </div>
      <span class="inline-block h-3 w-24 animate-pulse rounded-full bg-white/10"></span>
    </div>
  `,
})
export class DeliveryRowSkeletonComponent {}
