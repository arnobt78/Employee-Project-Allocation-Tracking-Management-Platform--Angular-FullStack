import { CommonModule, Location } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { resolvePrivatePageMeta } from '@/app/constants/private-page-meta';
import { resolveBrowserPath } from '@/app/constants/primary-navigation';
import { PageHeaderComponent } from './page-header.component';
import { ListSkeletonComponent } from './list-skeleton.component';
import { DashboardSkeletonComponent } from './dashboard-skeleton.component';
import { ListPageSkeletonComponent } from './list-page-skeleton.component';
import { ProjectDetailSkeletonComponent } from './project-detail-skeleton.component';
import { InsightsSkeletonComponent } from './insights-skeleton.component';
import { CalendarSkeletonComponent } from './calendar-skeleton.component';
import { ApiDocSkeletonComponent } from './api-doc-skeleton.component';
import { ApiStatusSkeletonComponent } from './api-status-skeleton.component';

@Component({
  selector: 'app-route-content-placeholder',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    ListSkeletonComponent,
    DashboardSkeletonComponent,
    ListPageSkeletonComponent,
    ProjectDetailSkeletonComponent,
    InsightsSkeletonComponent,
    CalendarSkeletonComponent,
    ApiDocSkeletonComponent,
    ApiStatusSkeletonComponent,
  ],
  template: `
    <div
      data-testid="route-content-placeholder"
      aria-busy="true"
      aria-live="polite"
    >
      @switch (meta().skeleton) {
        @case ('project-detail') {
          <app-project-detail-skeleton
            [mode]="meta().projectMode ?? 'edit'"
          ></app-project-detail-skeleton>
        }
        @case ('insights') {
          <app-insights-skeleton></app-insights-skeleton>
        }
        @case ('calendar') {
          <app-calendar-skeleton></app-calendar-skeleton>
        }
        @case ('api-doc') {
          <app-api-doc-skeleton></app-api-doc-skeleton>
        }
        @case ('api-status') {
          <app-api-status-skeleton></app-api-status-skeleton>
        }
        @default {
          <div class="text-white/85">
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

            <div class="eh-content-stack">
              @switch (meta().skeleton) {
                @case ('dashboard') {
                  <app-dashboard-skeleton></app-dashboard-skeleton>
                }
                @case ('list') {
                  <app-list-page-skeleton
                    [rows]="6"
                    [kpiCount]="meta().listKpiCount ?? 6"
                    [filterCount]="meta().listFilterCount ?? 3"
                    [showPagination]="meta().listShowPagination ?? false"
                    [tabCount]="meta().listTabCount ?? 0"
                    [rowVariant]="meta().listRowVariant ?? 'default'"
                  ></app-list-page-skeleton>
                }
                @default {
                  <app-list-skeleton [rows]="4"></app-list-skeleton>
                }
              }
            </div>
          </div>
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
