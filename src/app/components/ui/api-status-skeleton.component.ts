import { Component } from '@angular/core';
import {
  API_STATUS_COPY,
  API_STATUS_DATA_LABELS,
  API_STATUS_DELIVERY_SKELETON_ROWS,
  API_STATUS_METRIC_CARDS,
  API_STATUS_TABS,
  API_STATUS_TAB_ACTIVE_CLASS,
  API_STATUS_TAB_IDLE_CLASS,
} from '@/app/constants/api-status';
import { PRIVATE_PAGE_META } from '@/app/constants/private-page-meta';
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
  imports: [PageHeaderComponent, TextStubComponent, DeliveryRowSkeletonComponent],
  host: { class: 'block' },
  template: `
    <div class="text-white/85" data-testid="api-status-skeleton" aria-busy="true">
      <app-page-header
        [title]="meta.title"
        [subtitle]="meta.subtitle"
        [icon]="meta.icon"
      >
        <button
          type="button"
          disabled
          class="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 disabled:opacity-50"
        >
          {{ copy.refreshing }}
        </button>
      </app-page-header>

      <div class="eh-content-stack">
        <div
          class="rounded-[28px] border border-white/10 bg-white/5/80 p-2 shadow-[0_35px_90px_rgba(9,14,33,0.55)] backdrop-blur-md sm:p-4"
        >
          <div class="flex items-center justify-between">
            <div>
              <h2 class="mb-2 text-base font-medium text-white sm:text-xl">
                {{ copy.overallStatus }}
              </h2>
              <div class="flex items-center gap-3">
                <app-text-stub
                  class="inline-flex w-28 rounded-full border border-white/10 px-3 py-1 text-sm"
                ></app-text-stub>
                <span class="text-sm text-white/60">
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
              <div class="text-xs text-white/60 sm:text-sm">
                {{ copy.successRate }}
              </div>
            </div>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          @for (card of metricCards; track card.label) {
            <div class="rounded-xl border border-white/10 bg-white/5 p-4">
              <div class="mb-2 text-sm text-white/60">{{ card.label }}</div>
              <app-text-stub
                class="block text-xl font-medium leading-none sm:text-2xl"
                bar="inset-y-0 left-0 my-auto h-5 w-16 rounded-full sm:h-6"
              ></app-text-stub>
              <div class="mt-2 text-xs sm:text-sm" [class]="card.captionClass">
                @if (card.caption) {
                  {{ card.caption }}
                } @else {
                  <span
                    class="inline-block h-3 w-16 animate-pulse rounded-full bg-white/10 align-middle"
                    aria-hidden="true"
                  ></span>
                }
              </div>
            </div>
          }
        </div>

        <div
          class="rounded-[28px] border border-white/10 bg-white/5/80 p-2 shadow-[0_35px_90px_rgba(9,14,33,0.55)] backdrop-blur-md sm:p-4"
        >
          <div class="mb-6 flex flex-wrap gap-2 border-b border-white/10">
            @for (tab of tabs; track tab.id; let first = $first) {
              <span [class]="first ? activeTabClass : idleTabClass">
                {{ tab.label }}
              </span>
            }
          </div>

          <div class="space-y-6">
            <div>
              <h3 class="mb-4 text-base font-medium text-white sm:text-xl">
                {{ copy.systemHealth }}
              </h3>
              <div class="grid gap-4 sm:grid-cols-2">
                @for (service of healthCards; track service.title) {
                  <div class="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div class="mb-2 flex items-center justify-between">
                      <span class="text-sm font-medium text-white">{{
                        service.title
                      }}</span>
                      <app-text-stub
                        class="inline-flex w-20 rounded-full border border-white/10 px-2 py-0.5 text-xs"
                      ></app-text-stub>
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
              <h3 class="mb-4 text-base font-medium text-white sm:text-xl">
                {{ copy.dataStatistics }}
              </h3>
              <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                @for (label of dataLabels; track label) {
                  <div class="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div class="mb-2 text-sm text-white/60">{{ label }}</div>
                    <app-text-stub
                      class="block text-xl font-medium leading-none sm:text-2xl"
                      bar="inset-y-0 left-0 my-auto h-5 w-12 rounded-full sm:h-6"
                    ></app-text-stub>
                  </div>
                }
              </div>
            </div>

            <div>
              <h3 class="mb-4 text-base font-medium text-white sm:text-xl">
                {{ copy.deliveries }}
              </h3>
              <div class="space-y-2">
                @for (row of deliveryRows; track row) {
                  <app-delivery-row-skeleton></app-delivery-row-skeleton>
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ApiStatusSkeletonComponent {
  readonly meta = PRIVATE_PAGE_META['/api-status'];
  readonly copy = API_STATUS_COPY;
  readonly tabs = API_STATUS_TABS;
  readonly activeTabClass = API_STATUS_TAB_ACTIVE_CLASS;
  readonly idleTabClass = API_STATUS_TAB_IDLE_CLASS;
  readonly metricCards = API_STATUS_METRIC_CARDS;
  readonly dataLabels = API_STATUS_DATA_LABELS;
  readonly deliveryRows = API_STATUS_DELIVERY_SKELETON_ROWS;
  readonly healthCards = [
    {
      title: API_STATUS_COPY.database,
      lines: [API_STATUS_COPY.responseTime, API_STATUS_COPY.connected],
    },
    {
      title: API_STATUS_COPY.apiService,
      lines: [API_STATUS_COPY.uptime, API_STATUS_COPY.avgResponse],
    },
  ];
}
