import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ListPageRowVariant } from '@/app/constants/private-page-meta';
import { PageHeaderComponent } from './page-header.component';
import { ListPageSkeletonComponent } from './list-page-skeleton.component';

@Component({
  selector: 'app-list-page-shell',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, ListPageSkeletonComponent],
  template: `
    <div class="text-white/85">
      <app-page-header [title]="title" [subtitle]="subtitle" [icon]="icon">
        <ng-content select="[listShellActions]"></ng-content>
      </app-page-header>

      <div class="eh-content-stack">
        @if (contentLoading) {
          <app-list-page-skeleton
            [rows]="skeletonRows"
            [kpiCount]="skeletonKpiCount"
            [filterCount]="skeletonFilterCount"
            [showPagination]="skeletonShowPagination"
            [tabCount]="skeletonTabCount"
            [rowVariant]="skeletonRowVariant"
          ></app-list-page-skeleton>
        } @else {
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <ng-content select="[listShellKpis]"></ng-content>
          </div>

          <ng-content select="[listShellToolbar]"></ng-content>

          <div>
            <ng-content></ng-content>
          </div>
        }
      </div>
    </div>
  `,
})
export class ListPageShellComponent {
  @Input({ required: true }) title = '';
  @Input() subtitle = '';
  @Input() icon = '';
  /** When true, show list-shaped skeleton instead of KPIs/toolbar/list (cold load). */
  @Input() contentLoading = false;
  @Input() skeletonRows = 6;
  @Input() skeletonKpiCount = 6;
  @Input() skeletonFilterCount = 3;
  @Input() skeletonShowPagination = false;
  /** Tab row above the toolbar (e.g. Active / Archived); 0 renders none. */
  @Input() skeletonTabCount = 0;
  @Input() skeletonRowVariant: ListPageRowVariant = 'default';
}
