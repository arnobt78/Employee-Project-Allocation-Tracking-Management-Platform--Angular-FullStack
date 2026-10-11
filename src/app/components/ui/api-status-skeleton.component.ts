import { Component } from '@angular/core';
import {
  API_STATUS_COPY,
  API_STATUS_DATA_CARDS,
  API_STATUS_DELIVERY_SKELETON_ROWS,
  API_STATUS_METRIC_CARDS,
  API_STATUS_SECTION_ICONS,
  API_STATUS_TABS,
  API_STATUS_TAB_ACTIVE_CLASS,
  API_STATUS_TAB_IDLE_CLASS,
} from '@/app/constants/api-status';
import { PRIVATE_PAGE_META } from '@/app/constants/private-page-meta';
import { AppIconComponent } from './app-icon.component';
import { KpiStatCardComponent } from './kpi-stat-card.component';
import { PageHeaderComponent } from './page-header.component';
import { TextStubComponent } from './text-stub.component';
import { DeliveryRowSkeletonComponent } from './delivery-row-skeleton.component';

/**
 * Full-page loading mirror of api-status (overview tab). Rendered by both the
 * route placeholder and the page's cold-load branch so refresh shows a single
 * skeleton layer. Keep in sync with api-status.component.html.
 */
@Component({
  selector: 'app-api-status-skeleton',
  standalone: true,
  imports: [
    AppIconComponent,
    KpiStatCardComponent,
    PageHeaderComponent,
    TextStubComponent,
    DeliveryRowSkeletonComponent,
  ],
  host: { class: 'block' },
  template: `
    <div class="text-white/85" data-testid="api-status-skeleton" aria-busy="true">
      <app-page-header
        [title]="meta.title"
        [subtitle]="meta.subtitle"
        [icon]="meta.icon"
      >
        <button type="button" disabled class="eh-action-btn eh-action-btn-outline">
          <lucide-icon name="loader-circle" [size]="16" class="animate-spin"></lucide-icon>
          <span>{{ copy.refreshing }}</span>
        </button>
      </app-page-header>

      <div class="eh-content-stack">
        <section class="eh-section-card">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="eh-section-heading !mb-2">
                <lucide-icon [name]="icons.overallStatus" [size]="18"></lucide-icon>
                <span>{{ copy.overallStatus }}</span>
              </h2>
              <div class="flex flex-wrap items-center gap-3">
                <span class="eh-badge eh-badge-neutral w-28 animate-pulse">&nbsp;</span>
                <span class="flex items-center gap-1.5 text-sm text-white/60">
                  <lucide-icon name="clock" [size]="14"></lucide-icon>
                  {{ copy.lastUpdated }}
                  <span
                    class="inline-block h-3 w-24 animate-pulse rounded-full bg-white/10 align-middle"
                    aria-hidden="true"
                  ></span>
                </span>
              </div>
            </div>
            <div class="text-right">
              <app-text-stub
                class="ml-auto block w-16 text-xl font-medium leading-none sm:text-2xl"
                bar="inset-y-0 right-0 my-auto h-5 w-16 rounded-full sm:h-6"
              ></app-text-stub>
              <div class="mt-1 flex items-center justify-end gap-1.5 text-xs text-white/60 sm:text-sm">
                <lucide-icon name="percent" [size]="14"></lucide-icon>
                {{ copy.successRate }}
              </div>
            </div>
          </div>
        </section>

        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          @for (card of metricCards; track card.label) {
            <app-kpi-stat-card
              [label]="card.label"
              value=""
              [hint]="card.hint ?? 'Loading…'"
              [icon]="card.icon"
              [tone]="card.tone"
              [loading]="true"
            ></app-kpi-stat-card>
          }
        </div>

        <section class="eh-section-card">
          <div class="mb-6 flex flex-wrap gap-2 border-b border-white/10">
            @for (tab of tabs; track tab.id; let first = $first) {
              <span [class]="first ? activeTabClass : idleTabClass">
                <lucide-icon [name]="tab.icon" [size]="14"></lucide-icon>
                {{ tab.label }}
              </span>
            }
          </div>

          <div class="space-y-6">
            <div>
              <h3 class="eh-section-heading">
                <lucide-icon [name]="icons.systemHealth" [size]="18"></lucide-icon>
                <span>{{ copy.systemHealth }}</span>
              </h3>
              <div class="grid gap-4 sm:grid-cols-2">
                @for (service of healthCards; track service.title) {
                  <div class="eh-panel">
                    <div class="mb-2 flex items-center justify-between gap-2">
                      <span class="flex items-center gap-2 text-sm font-medium text-white">
                        <lucide-icon [name]="service.icon" [size]="16"></lucide-icon>
                        {{ service.title }}
                      </span>
                      <span class="eh-badge eh-badge-neutral w-24 animate-pulse">&nbsp;</span>
                    </div>
                    @for (line of service.lines; track line) {
                      <div class="text-xs text-white/60 sm:text-sm">
                        {{ line }}
                        <span
                          class="inline-block h-3 w-12 animate-pulse rounded-full bg-white/10 align-middle"
                          aria-hidden="true"
                        ></span>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>

            <div>
              <h3 class="eh-section-heading">
                <lucide-icon [name]="icons.dataStatistics" [size]="18"></lucide-icon>
                <span>{{ copy.dataStatistics }}</span>
              </h3>
              <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                @for (card of dataCards; track card.label) {
                  <app-kpi-stat-card
                    [label]="card.label"
                    value=""
                    [icon]="card.icon"
                    [tone]="card.tone"
                    [loading]="true"
                  ></app-kpi-stat-card>
                }
              </div>
            </div>

            <div>
              <h3 class="eh-section-heading">
                <lucide-icon [name]="icons.deliveries" [size]="18"></lucide-icon>
                <span>{{ copy.deliveries }}</span>
              </h3>
              <div class="space-y-2">
                @for (row of deliveryRows; track row) {
                  <app-delivery-row-skeleton></app-delivery-row-skeleton>
                }
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  `,
})
export class ApiStatusSkeletonComponent {
  readonly meta = PRIVATE_PAGE_META['/api-status'];
  readonly copy = API_STATUS_COPY;
  readonly icons = API_STATUS_SECTION_ICONS;
  readonly tabs = API_STATUS_TABS;
  readonly activeTabClass = API_STATUS_TAB_ACTIVE_CLASS;
  readonly idleTabClass = API_STATUS_TAB_IDLE_CLASS;
  readonly metricCards = API_STATUS_METRIC_CARDS;
  readonly dataCards = API_STATUS_DATA_CARDS;
  readonly deliveryRows = API_STATUS_DELIVERY_SKELETON_ROWS;
  readonly healthCards = [
    {
      title: API_STATUS_COPY.database,
      icon: API_STATUS_SECTION_ICONS.database,
      lines: [API_STATUS_COPY.responseTime, API_STATUS_COPY.connected],
    },
    {
      title: API_STATUS_COPY.apiService,
      icon: API_STATUS_SECTION_ICONS.apiService,
      lines: [API_STATUS_COPY.uptime, API_STATUS_COPY.avgResponse],
    },
  ];
}
