import { CommonModule, Location } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { resolvePrivatePageMeta } from '@/app/constants/private-page-meta';
import { PageHeaderComponent } from './page-header.component';
import {
  ListSkeletonComponent,
  StatPillSkeletonComponent,
} from './list-skeleton.component';

@Component({
  selector: 'app-route-content-placeholder',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    ListSkeletonComponent,
    StatPillSkeletonComponent,
  ],
  template: `
    <div
      class="space-y-8 text-white/85"
      data-testid="route-content-placeholder"
      aria-busy="true"
      aria-live="polite"
    >
      <app-page-header
        [title]="meta().title"
        [subtitle]="meta().subtitle"
        [icon]="meta().icon"
      ></app-page-header>

      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        @for (card of [1, 2, 3]; track card) {
          <article
            class="animate-pulse rounded-[28px] border border-white/10 bg-white/5 p-2 sm:p-4"
          >
            <div class="h-3 w-32 rounded-full bg-white/10"></div>
            <div class="mt-4 h-10 w-20 rounded-full bg-white/10"></div>
            <div class="mt-4 h-4 w-full rounded-full bg-white/10"></div>
          </article>
        }
      </section>

      <section
        class="rounded-2xl border border-white/10 bg-white/5 px-2 py-4 sm:px-4"
      >
        <div class="flex flex-wrap gap-2">
          @for (pill of [1, 2, 3, 4, 5]; track pill) {
            <app-stat-pill-skeleton [width]="120"></app-stat-pill-skeleton>
          }
        </div>
      </section>

      <app-list-skeleton [rows]="4"></app-list-skeleton>
    </div>
  `,
})
export class RouteContentPlaceholderComponent {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  private readonly path = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.currentPath())
    ),
    { initialValue: this.currentPath() }
  );

  readonly meta = computed(() => resolvePrivatePageMeta(this.path()));

  private currentPath(): string {
    const fromLocation = this.location.path().split('?')[0];
    if (fromLocation) {
      return fromLocation.startsWith('/') ? fromLocation : `/${fromLocation}`;
    }
    const fromRouter = this.router.url.split('?')[0];
    if (fromRouter && fromRouter !== '/') {
      return fromRouter;
    }
    if (typeof window !== 'undefined' && window.location?.pathname) {
      return window.location.pathname;
    }
    return '/dashboard';
  }
}
