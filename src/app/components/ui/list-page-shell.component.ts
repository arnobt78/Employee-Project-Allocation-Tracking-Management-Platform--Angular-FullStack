import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
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

      <div class="mt-2 space-y-6 sm:mt-8 sm:space-y-8">
        @if (contentLoading) {
          <app-list-page-skeleton
            [rows]="skeletonRows"
            [kpiCount]="skeletonKpiCount"
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
}
