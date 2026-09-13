import { CommonModule, Location } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { resolvePrivatePageMeta } from '@/app/constants/private-page-meta';
import { resolveBrowserPath } from '@/app/constants/primary-navigation';
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
      class="space-y-6 text-white/85 sm:space-y-8"
      data-testid="route-content-placeholder"
      aria-busy="true"
      aria-live="polite"
    >
      <app-page-header
        [title]="meta().title"
        [subtitle]="meta().subtitle"
        [icon]="meta().icon"
      >
        <div
          class="h-9 w-32 animate-pulse rounded-xl border border-white/10 bg-white/5"
        ></div>
      </app-page-header>

      @switch (meta().skeleton) {
        @case ('dashboard') {
          <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            @for (card of [1, 2, 3]; track card) {
              <article
                class="animate-pulse rounded-[24px] border border-white/10 bg-white/5 p-3 sm:p-4"
              >
                <div class="h-3 w-24 rounded-full bg-white/10"></div>
                <div class="mt-3 h-8 w-16 rounded-full bg-white/10"></div>
              </article>
            }
          </section>
          <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            @for (card of [1, 2, 3, 4, 5, 6]; track card) {
              <article
                class="animate-pulse rounded-[24px] border border-white/10 bg-white/5 p-3"
              >
                <div class="h-3 w-28 rounded-full bg-white/10"></div>
                <div class="mt-3 h-7 w-12 rounded-full bg-white/10"></div>
              </article>
            }
          </section>
          <app-list-skeleton [rows]="4"></app-list-skeleton>
        }
        @case ('list') {
          <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            @for (card of [1, 2, 3]; track card) {
              <article
                class="animate-pulse rounded-[24px] border border-white/10 bg-white/5 p-3 sm:p-4"
              >
                <div class="h-3 w-24 rounded-full bg-white/10"></div>
                <div class="mt-3 h-8 w-14 rounded-full bg-white/10"></div>
              </article>
            }
          </section>
          <section
            class="flex flex-col gap-3 rounded-[28px] border border-white/10 bg-white/5/70 px-2 py-2 sm:flex-row sm:items-center sm:px-4 sm:py-3"
          >
            <div
              class="h-11 w-full animate-pulse rounded-2xl border border-white/10 bg-white/5 sm:max-w-sm"
            ></div>
            <div
              class="h-11 w-full animate-pulse rounded-2xl border border-white/10 bg-white/5 sm:w-52"
            ></div>
            <app-stat-pill-skeleton [width]="120"></app-stat-pill-skeleton>
          </section>
          <app-list-skeleton [rows]="6"></app-list-skeleton>
        }
        @case ('insights') {
          <div class="flex flex-wrap gap-3">
            <app-stat-pill-skeleton [width]="120"></app-stat-pill-skeleton>
            <app-stat-pill-skeleton [width]="140"></app-stat-pill-skeleton>
            <app-stat-pill-skeleton [width]="100"></app-stat-pill-skeleton>
          </div>
          <app-list-skeleton [rows]="5"></app-list-skeleton>
        }
        @default {
          <app-list-skeleton [rows]="4"></app-list-skeleton>
        }
      }
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
    return resolveBrowserPath(
      this.location.path(),
      this.router.url,
      '/dashboard'
    );
  }
}
