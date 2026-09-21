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
import { DashboardSkeletonComponent } from './dashboard-skeleton.component';
import { ListPageSkeletonComponent } from './list-page-skeleton.component';

@Component({
  selector: 'app-route-content-placeholder',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    ListSkeletonComponent,
    StatPillSkeletonComponent,
    DashboardSkeletonComponent,
    ListPageSkeletonComponent,
  ],
  template: `
    <div
      class="text-white/85"
      data-testid="route-content-placeholder"
      aria-busy="true"
      aria-live="polite"
    >
      <app-page-header
        [title]="meta().title"
        [subtitle]="meta().subtitle"
        [icon]="meta().icon"
      >
        @if (meta().skeleton !== 'dashboard') {
          <div
            class="h-9 w-32 animate-pulse rounded-xl border border-white/10 bg-white/5"
          ></div>
        }
      </app-page-header>

      <div class="mt-2 space-y-6 sm:mt-8 sm:space-y-8">
        @switch (meta().skeleton) {
          @case ('dashboard') {
            <app-dashboard-skeleton></app-dashboard-skeleton>
          }
          @case ('list') {
            <app-list-page-skeleton
              [rows]="6"
              [kpiCount]="meta().listKpiCount ?? 6"
            ></app-list-page-skeleton>
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
