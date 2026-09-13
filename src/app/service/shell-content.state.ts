import { Injectable, signal } from '@angular/core';

/**
 * Tracks whether a private child route is mounted in Layout's outlet.
 * Used so App can keep one continuous content placeholder until the page activates
 * (avoids early-placeholder → layout-placeholder double flash).
 */
@Injectable({ providedIn: 'root' })
export class ShellContentState {
  readonly childActive = signal(false);
}
